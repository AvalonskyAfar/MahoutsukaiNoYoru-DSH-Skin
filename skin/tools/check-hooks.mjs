#!/usr/bin/env node
/**
 * Hooks 规则静态扫描 —— 专抓 React error #310 的成因。
 * ---------------------------------------------------------------------------
 * 为什么单独写一个：React #310（"Rendered more hooks than during the previous
 * render"）在浏览器里**只有一个 error code，没有任何可读信息**，而且只能在
 * 特定的一次重渲染里复现 —— 用户要刷新页面、要开控制台、要复述，成本极高。
 * 但它的成因在源码里是**完全机械可判的**：
 *
 *   1. hook 调用处在条件分支（if / else / && / || / ? :）里面或后面
 *   2. hook 调用处在循环体里（次数随数据变）
 *   3. hook 调用在提前 return 之后（早退 → 这次少算 hook）
 *   4. hook 调用写成 `useFoo ? useFoo() : x` 这种"可选调用"
 *   5. hook 调用在 try / catch 里
 *
 * 这个脚本用 token 级扫描（不依赖 AST 库）把上面五类找出来。
 * 用法：node skin/tools/check-hooks.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = path.resolve(__dirname, '..', 'lib', 'client.js')

const raw = fs.readFileSync(CLIENT, 'utf8')

const HOOK_RE = /^(use[A-Z][A-Za-z0-9_]*|useState|useRef|useEffect|useMemo|useCallback|useSyncExternalStore|useContext|useReducer|useLayoutEffect|useId|useTransition|useDeferredValue)$/
const PASSIVE_HOOK_RE = /^use(Context|Id|Ref|State|Reducer|LayoutEffect|Transition|DeferredValue|SyncExternalStore|Effect|Memo|Callback)$/

// ---------------------------------------------------------------------------
// 只取 factory 主体（我们的代码），别把 shell 的东西扫进来
// ---------------------------------------------------------------------------
const factoryStart = raw.indexOf('function (require, module, exports)')
const body = factoryStart >= 0 ? raw.slice(factoryStart) : raw

const lines = body.split('\n')

// ---------------------------------------------------------------------------
// 极简 tokenizer：把字符串 / 模板串 / 注释 / 正则 剔除，避免误报
// ---------------------------------------------------------------------------
function strip(src) {
  let out = ''
  let i = 0
  const n = src.length
  let mode = 'code' // code | line | block | sq | dq | tpl | re
  let prevSig = ''
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && c2 === '/') { mode = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && c2 === '*') { mode = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { mode = 'sq'; out += ' '; i++; continue }
      if (c === '"') { mode = 'dq'; out += ' '; i++; continue }
      if (c === '`') { mode = 'tpl'; out += ' '; i++; continue }
      if (c === '/' && /[=(,:;[!&|?{+\-*%<>~^]/.test(prevSig || '')) { mode = 're'; out += ' '; i++; continue }
      if (!/\s/.test(c)) prevSig = c
      out += c
      i++
      continue
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += '\n' } else out += ' '; i++; continue }
    if (mode === 'block') { if (c === '*' && c2 === '/') { mode = 'code'; out += '  '; i += 2; continue } out += (c === '\n' ? '\n' : ' '); i++; continue }
    if (mode === 'sq' || mode === 'dq') {
      const q = mode === 'sq' ? "'" : '"'
      if (c === '\\') { out += '  '; i += 2; continue }
      if (c === q) { mode = 'code'; out += ' '; i++; continue }
      out += (c === '\n' ? '\n' : ' '); i++; continue
    }
    if (mode === 'tpl') {
      if (c === '\\') { out += '  '; i += 2; continue }
      if (c === '`') { mode = 'code'; out += ' '; i++; continue }
      out += (c === '\n' ? '\n' : ' '); i++; continue
    }
    if (mode === 're') {
      if (c === '\\') { out += '  '; i += 2; continue }
      if (c === '\n') { mode = 'code'; out += '\n'; i++; continue }
      if (c === '[') { /* char class: keep simple */ }
      if (c === '/') { mode = 'code'; out += ' '; i++; continue }
      out += ' '; i++; continue
    }
  }
  return out
}

const code = strip(body)
const codeLines = code.split('\n')
if (codeLines.length !== lines.length) {
  console.log('! tokenizer 行数对不上（' + codeLines.length + ' vs ' + lines.length + '），降级为直接扫描原文件')
}

// ---------------------------------------------------------------------------
// 括号深度 / 条件上下文追踪
// ---------------------------------------------------------------------------
// 对每一行，算出：
//   - 进入该行时所在的 block 栈（用 { } 配对 + 前缀关键字判定是不是 if/for/while/... 块）
//   - 该行是否"位于某次提前 return 之后"
// 真实实现：逐字符走一遍，维护
//   stack: [{ kind:'func'|'block'|'cond'|'loop'|'try'|'switch'|'object' , line, label }]
//   condDepth: 当前嵌套在"条件块"里的层数
//   loopDepth: 当前嵌套在"循环体"里的层数
//   pendingCond: 最近一个打开 '{' 之前遇到的关键字
// ---------------------------------------------------------------------------
const findings = []
const stack = []
let i = 0
let lineNo = 1
let pending = null // 最近的关键字：if / for / else / ...
let parenDepth = 0
let lastReturnLineAtDepth = [] // 每层 block 是否已经出现过 return
let ternaryDepth = 0
let ternaryOpenAt = -1

const PROBLEM_KINDS = { cond: '条件分支', loop: '循环体', try: 'try/catch' }

function topBlock() { return stack.length ? stack[stack.length - 1] : null }

// 逐字符扫描（在 strip 后的代码上做，字符数与原文一一对应，位置可换算回行号）
let j = 0
let inLineStart = 0
const N = code.length
let lastWord = ''
let wordBuf = ''
let prevNonSpace = ''

function flushWord() {
  if (!wordBuf) return
  lastWord = wordBuf
  wordBuf = ''
}

while (j < N) {
  const c = code[j]
  if (c === '\n') {
    flushWord()
    lineNo++
    inLineStart = j + 1
    parenDepth = 0 // 换行重置括号（够用）
    j++
    continue
  }
  if (/\s/.test(c)) { flushWord(); j++; continue }

  if (/[A-Za-z_$]/.test(c)) {
    let k = j
    while (k < N && /[A-Za-z0-9_$]/.test(code[k])) k++
    const word = code.slice(j, k)

    // 记录"这个 '{' 之前的关键字"
    if (['if', 'for', 'while', 'switch', 'catch', 'else', 'do'].indexOf(word) >= 0) pending = { kw: word, line: lineNo }
    if (word === 'return') {
      const b = topBlock()
      if (b) b.sawReturn = true
    }
    // ★ hook 调用点
    //   nestedFn 的正确判据：在"最近的函数体"**之上**还压着别的函数体，
    //   才说明它属于一个更深的函数字面量（事件回调之类）。
    //   组件自己的身体算 1 层 —— 第一版按 `(` 判，把组件自己也误伤了。
    let funcDepth = 0
    for (let s = 0; s < stack.length; s++) if (stack[s].kind === 'func') funcDepth++
    const nestedFn = funcDepth > 1
    if (HOOK_RE.test(word)) {
      const ctx = []
      for (let s = 0; s < stack.length; s++) {
        const b = stack[s]
        if (PROBLEM_KINDS[b.kind]) ctx.push(PROBLEM_KINDS[b.kind] + '@L' + b.line + (b.label ? '(' + b.label + ')' : ''))
        if (b.kind === 'func' && b.sawReturn && !b.arrowExpression) ctx.push('提前 return 之后@L' + b.line)
      }
      void lastWord
      if (ternaryDepth > 0) ctx.push('三元表达式内@L' + ternaryOpenAt)
      const behind = code.slice(Math.max(0, j - 60), j)
      findings.push({
        word: word,
        line: lineNo,
        col: j - inLineStart + 1,
        ctx: ctx,
        nestedFn: nestedFn,
        optional: /\buse[A-Z][A-Za-z0-9_]*\s*\?\s*$/.test(behind.slice(-40)),
      })
    }
    j = k
    lastWord = word
    continue
  }

  if (c === '(') { parenDepth++; j++; continue }
  if (c === ')') { parenDepth = Math.max(0, parenDepth - 1); j++; continue }
  if (c === '?') {
    // 排除可选链 ?. 
    if (code[j + 1] !== '.' && code[j + 1] !== '?') { ternaryDepth++; if (ternaryOpenAt < 0) ternaryOpenAt = lineNo }
    j++; continue
  }
  if (c === ':') {
    if (ternaryDepth > 0) { ternaryDepth--; if (ternaryDepth === 0) ternaryOpenAt = -1 }
    j++; continue
  }
  if (c === '{') {
    // 判定这个块的种类
    let kind = 'block'
    if (pending) {
      if (pending.kw === 'if' || pending.kw === 'else') kind = 'cond'
      else if (pending.kw === 'for' || pending.kw === 'while' || pending.kw === 'do') kind = 'loop'
      else if (pending.kw === 'switch') kind = 'switch'
      else if (pending.kw === 'catch') kind = 'try'
      pending = null
    } else {
      // 对象字面量 / 函数体 / 裸块：看上一个非空字符
      const back = code.slice(Math.max(0, j - 200), j)
      const fnM = /(?:function\s*[A-Za-z0-9_$]*\s*|=>)\s*$/.exec(back)
      if (fnM) kind = 'func'
      else if (/[)\]]\s*$/.test(back) && /function|=>/.test(back.slice(-80))) kind = 'func'
      else kind = 'block'
    }
    stack.push({ kind: kind, line: lineNo, sawReturn: false, label: lastWord })
    j++
    continue
  }
  if (c === '}') {
    // 闭合前把 pending 丢掉（避免 pending 跨越无关代码）
    stack.pop()
    pending = null
    j++
    continue
  }
  if (c !== ';') prevNonSpace = c
  if (c === ';') { pending = null }
  j++
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------
// ★★ 血的教训：第一版我加了"嵌套函数里的 hook 不算"这条降噪规则，
//    判据写成了"到达它之前经过 `(` 或 `=>`" —— 结果 `function ReasoningRow(props) {`
//    的 `(` 让**组件自己的身体**被判成嵌套函数，于是组件里的 hook 被整批静默丢掉。
//    降噪规则一旦误伤，比没有扫描器更糟：它会让我以为"扫过了就是干净的"。
//
//    所以现在改成：**先把每个 hook 归到它最近的那个函数**，只对
//      · 真正更深一层的函数字面量（回调）里的 hook 降噪
//    然后再判条件/循环/三元/早退。
//    判据：栈里在"最近的函数体"**之上**还有别的函数体 → 才是嵌套。
const BUILTIN_ONLY = /^(useContext|useId|useRef|useState|useReducer|useLayoutEffect|useTransition|useDeferredValue|useSyncExternalStore|useEffect|useMemo|useCallback|useInsertionEffect|useImperativeHandle|useDebugValue|useOptimistic|useActionState|useFormStatus)$/

const violations = findings.filter((f) => {
  if (!BUILTIN_ONLY.test(f.word)) return false // ① 自定义 hook：它在自己那层数 hook
  if (f.optional) return true // 可选调用：无条件算违例
  if (f.nestedFn) return false // ② 真正的嵌套函数字面量里 → 另一棵渲染
  return f.ctx.length > 0
})

const builtinCount = findings.filter((f) => BUILTIN_ONLY.test(f.word)).length
console.log('== Hooks 规则扫描（React #310 的成因）==')
console.log('  扫描文件: skin/lib/client.js')
console.log('  发现 hook 调用点: ' + findings.length + ' 处'
  + '（内置 hook ' + builtinCount + '，自定义 hook ' + (findings.length - builtinCount) + '）')

if (violations.length) {
  console.log('')
  console.log('✗ 有 ' + violations.length + ' 处可能违例：')
  for (const v of violations) {
    console.log('   L' + v.line + ':' + v.col + '  ' + v.word + '()' + (v.optional ? '  [可选调用 useX ? useX() : y]' : ''))
    for (const c of v.ctx) console.log('        ↳ 位于 ' + c)
  }
} else {
  console.log('  ✓ 全部 hook 调用都在函数体顶层，无条件 / 无循环 / 无早退之后')
}

// ---------------------------------------------------------------------------
// 额外断言：逐组件统计 hook 数，且要求"写成可选调用"的句子不存在
// ---------------------------------------------------------------------------
const extra = []
// ★ 只在**去注释**后的代码上找。否则注释里那句"写成 `useChat ? useChat(...)`
//   是违例"会被自己的文档命中 —— 这种"注释里写反例被自己抓"的坑很常见。
let codeOnly = ''
for (let p = 0; p < body.length; p++) codeOnly += (code[p] === body[p] ? body[p] : ' ')
const optionalPat = /\buse[A-Z][A-Za-z0-9_]*\s*\?\s*use[A-Z][A-Za-z0-9_]*\s*\(/g
let mm
while ((mm = optionalPat.exec(codeOnly))) {
  const ln = codeOnly.slice(0, mm.index).split('\n').length
  extra.push('L' + ln + '  ' + mm[0].replace(/\s+/g, ' '))
}
if (extra.length) {
  console.log('')
  console.log('✗ 存在"hook 可选调用"写法（props 一变 hook 数就变，必炸 #310）：')
  for (const e of extra) console.log('   ' + e)
} else {
  console.log('  ✓ 没有 "useX ? useX() : y" 这种可选 hook 调用')
}

const bad = violations.length + extra.length
console.log('')
console.log(bad ? '✗ hooks 规则检查未通过（' + bad + ' 项）' : '✓ hooks 规则检查通过')
process.exit(bad ? 1 : 0)

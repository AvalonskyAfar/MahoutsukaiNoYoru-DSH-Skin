#!/usr/bin/env node
/**
 * 逐组件 hook 核算 —— 独立于 check-hooks.mjs 的第二双眼睛。
 * ---------------------------------------------------------------------------
 * 为什么还要一个：check-hooks.mjs 是靠括号/关键字启发式判"这段在哪个函数里"。
 * 启发式一旦误伤（我已经被误伤过一次：整批 hook 被静默丢掉），扫描器会**撒谎**。
 * 所以这里换一条完全不同的路子：
 *   · 直接按 `function Name(` 切出每个函数的正文（按行）
 *   · 在正文里数 hook，并记下每个 hook 的行号
 *   · 找出正文里所有**顶层** `return`（缩进与函数体同级）的行号
 *   · 如果某个 hook 的行号 > 某个顶层 return 的行号 → 真·早退之后调用 hook
 * 结果按组件打印出来，人也能一眼核对。
 *
 * 用法：node skin/tools/check-hooks-per-component.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = path.resolve(__dirname, '..', 'lib', 'client.js')
const lines = fs.readFileSync(CLIENT, 'utf8').split('\n')

const HOOK_CALL = /\b(useState|useRef|useEffect|useMemo|useCallback|useSyncExternalStore|useContext|useReducer|useLayoutEffect|useId)\s*\(/g
// 我们自己的组件名：大写开头 + 后面跟 (  或 = function
const FN_DECL = /^\s{4}function ([A-Z][A-Za-z0-9_]*)\s*\(/

/** 从第 i 行开始，用大括号配对找出函数体结束行。 */
function bodyRange(startIdx) {
  let depth = 0
  let started = false
  for (let i = startIdx; i < lines.length; i++) {
    for (let c = 0; c < lines[i].length; c++) {
      const ch = lines[i][c]
      // 粗略忽略行内字符串/注释里的括号：够用（我们的代码里这类括号很少）
      if (ch === '{') { depth++; started = true } else if (ch === '}') {
        depth--
        if (started && depth === 0) return { from: startIdx, to: i }
      }
    }
  }
  return { from: startIdx, to: lines.length - 1 }
}

/** 提取函数体的基准缩进（body 第一行的缩进 + 2）。 */
function baseIndent(from, to) {
  for (let i = from + 1; i <= to; i++) {
    const m = /^(\s*)\S/.exec(lines[i])
    if (m) return m[1].length
  }
  return 0
}

const rows = []
let bad = 0
for (let i = 0; i < lines.length; i++) {
  const m = FN_DECL.exec(lines[i])
  if (!m) continue
  const name = m[1]
  const range = bodyRange(i)
  const indent = baseIndent(range.from, range.to)

  const hooks = []
  const topReturns = []
  for (let L = range.from; L <= range.to; L++) {
    const text = lines[L]
    const stripped = text.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''").replace(/"([^"]*)"/g, '""')
    // 顶层 return：缩进恰好等于函数体基准缩进
    const ind = /^(\s*)/.exec(stripped)[1].length
    if (ind === indent && /^return\b/.test(stripped.trim()) && !/\breturn\s+(h|jsx|React\.createElement|Fragment)/.test(stripped)) {
      topReturns.push(L + 1)
    }
    HOOK_CALL.lastIndex = 0
    let hm
    while ((hm = HOOK_CALL.exec(stripped))) hooks.push({ line: L + 1, name: hm[1] })
  }

  const early = topReturns.length
    ? hooks.filter((hk) => hk.line > topReturns[topReturns.length - 1])
    : []
  const isComponent = hooks.length > 0 || topReturns.length > 0
  if (!isComponent) continue
  rows.push({ name, from: range.from + 1, to: range.to + 1, hooks, topReturns, early })
  if (early.length) bad++
}

console.log('== 逐组件 hook 核算（按"函数正文 + 顶层 return 行号"直接比对）==')
console.log('')
for (const r of rows) {
  const flag = r.early.length ? '✗' : (r.topReturns.length ? '•' : '✓')
  const hookTxt = r.hooks.length
    ? r.hooks.map((k) => k.name + '@L' + k.line).join(', ')
    : '(无 hook)'
  console.log(flag + ' ' + r.name + '()  L' + r.from + '-L' + r.to)
  console.log('    hooks: ' + hookTxt)
  if (r.topReturns.length) console.log('    顶层 return 于: L' + r.topReturns.join(', L'))
  if (r.early.length) {
    console.log('    ✗✗ 这些 hook 排在提前 return 之后：'
      + r.early.map((k) => k.name + '@L' + k.line).join(', '))
    console.log('       → 只要那次提前 return 命中，本次渲染就少算 hook，下次渲染立刻 React #310')
  }
}

console.log('')
if (bad) {
  console.log('✗ 有 ' + bad + ' 个组件的 hook 位于提前 return 之后 —— 必须把 hook 全部提到 return 之前')
  process.exitCode = 1
} else {
  console.log('✓ 没有任何组件的 hook 排在提前 return 之后（' + rows.length + ' 个含 hook/return 的函数）')
}

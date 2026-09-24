#!/usr/bin/env node
/**
 * 未定义标识符扫描 —— 挡住"重构时删了绑定、别处还在引用"这类错误。
 *
 * 为什么需要它：
 *   连续两个 bug 都是同一类 —— `h` 绑错来源、`Fragment` 绑定被删掉。
 *   两个都在 Node 自检里**跑不出来**（Node 的 `new Function` 作用域比浏览器宽），
 *   却在浏览器里直接 `ReferenceError` 打断挂载。
 *
 * 做法：把 factory 里的**裸标识符引用**提取出来，减去
 *   ① 语言关键字/字面量  ② 声明的名字（const/let/var/function/class/参数）
 *   ③ 已知的全局对象
 * 剩下的就是可疑项。宁可多报，也不要漏 —— 漏一个就是轮次。
 *
 * 用法：node skin/tools/lint-identifiers.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = path.resolve(__dirname, '..', 'lib', 'client.js')
const src = fs.readFileSync(CLIENT, 'utf8')

// ---------------------------------------------------------------------------
// 只取 factory 体（`factory: (require) => { ... }` 到结尾的 `},\n})`）
// ---------------------------------------------------------------------------
const start = src.indexOf('factory: (require) => {')
const end = src.lastIndexOf('return module.exports')
const body = src.slice(start, end > start ? end : src.length)
if (start < 0) { console.error('找不到 factory'); process.exit(1) }
console.log(`扫描 factory 体：${body.length} 字符`)

// ---------------------------------------------------------------------------
// 关键字与字面量
// ---------------------------------------------------------------------------
const KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'get', 'set', 'of', 'as',
  'async', 'await', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  // 常见属性名/对象字面量键会被误抓，用通用白名单兜（见下）
])

const GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'console', 'fetch', 'URL', 'URLSearchParams', 'MutationObserver', 'Audio', 'Image',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Math', 'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'Function',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'structuredClone', 'queueMicrotask', 'performance', 'CSS', 'Element', 'HTMLElement',
  'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle',
  'matchMedia', 'globalThis', 'arguments', 'require', 'module', 'exports', 'process',
  'screen', 'history', 'BroadcastChannel', 'AbortController', 'TextEncoder', 'TextDecoder',
  'Blob', 'FileReader', 'AudioContext', 'requestIdleCallback', 'cancelIdleCallback',
  'ResizeObserver', 'IntersectionObserver', 'CSSStyleSheet', 'DOMParser', 'FormData',
  'ImageData', 'Path2D', 'OffscreenCanvas', 'WebSocket', 'Worker', 'crypto', 'atob', 'btoa',
])

/**
 * 已知误报的短名字（**每一项都要能解释清楚**，不许为了过闸而塞）：
 *   constructor / render / componentDidCatch / getDerivedStateFromError
 *       —— class 体里的成员方法名，扫描器抓不到"成员"这个语境
 *   New —— 字符串 "New session" 里的单词（正则切进正则字面量内部）
 *   error —— `componentDidCatch(error, info) { … }` 的**类方法参数**，
 *            扫描器的函数参数正则只认 `function name(...)`，抓不到类方法
 */
const SCAN_NOISE = new Set([
  'constructor', 'render', 'componentDidCatch', 'getDerivedStateFromError', 'New', 'error',
  // 正则字面量内部被切出来的词：/^(https?:|\/)/ 里的 https
  'https',
  /* `_` —— Markdown 解析器里作为**字符**出现的下划线，共 5 处，全在字符串或
     正则字面量内部，没有一处是标识符：
       · `'\\`*_{}[]()#+-.!|~>'.indexOf(s[i + 1])`  —— 转义字符表里的一个字符
       · `s[i] === '_'`                              —— 斜体标记判定
       · `/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/` ×2     —— 分隔线的正则
     ⚠ 与 'https' 同一类因：**扫描器切进了字面量内部**。
       加它不会掩盖真问题 —— `_` 若真的当标识符用而没声明，
       `lint` 之外还有 `check-client` 的 e2e 渲染与浏览器里的 ReferenceError 兜着。 */
  '_',
])

// ---------------------------------------------------------------------------
// 声明收集
// ---------------------------------------------------------------------------
const declared = new Set()
const DECL_RES = [
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  /function\s+([A-Za-z_$][\w$]*)/g,
  /class\s+([A-Za-z_$][\w$]*)/g,
  // 解构：const { a, b: c } = ... / const [a, b] = ...
  /(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
  /(?:const|let|var)\s*\[([^\]]*)\]\s*=/g,
  // 函数参数（保守：抓 (… ) => 和 function (…) 里的简单标识符）
  /function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g,
  // catch 绑定：catch (e) { }  —— 必须单独抓，否则 e/_e 会被当成未定义
  /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g,
  // 箭头函数参数：单个裸标识符 =>  或  (a, b) =>
  /(?:^|[\s(,=])([A-Za-z_$][\w$]*)\s*=>/g,
  /\(\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\)\s*=>/g,
]
for (const re of DECL_RES) {
  let m
  while ((m = re.exec(body))) {
    if (m[1] === undefined) continue
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(':').pop().trim().split('=')[0].trim().replace(/^\.\.\./, '')
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
    }
  }
}

// ---------------------------------------------------------------------------
// 裸标识符引用
// ---------------------------------------------------------------------------
// 先把确定不是"引用"的部分剔除：
//   · 字符串/模板字面量   · 注释   · 属性访问 `.x`   · 对象字面量的键 `x:`
let code = body
code = code.replace(/\/\*[\s\S]*?\*\//g, ' ')        // 块注释
code = code.replace(/\/\/[^\n]*/g, ' ')              // 行注释
code = code.replace(/'(?:[^'\\]|\\.)*'/g, "''")      // 单引号串
code = code.replace(/"(?:[^"\\]|\\.)*"/g, '""')      // 双引号串
code = code.replace(/`(?:[^`\\]|\\.)*`/g, '``')      // 模板串（含 ${} 里的一并吃掉，保守）

const used = new Map()   // name -> 出现次数
const IDENT_RE = /(\.\s*)?\b([A-Za-z_$][\w$]*)\b(\s*:)?/g
let mm
while ((mm = IDENT_RE.exec(code))) {
  const [, dot, name, colon] = mm
  if (dot) continue                    // 属性访问
  if (colon) continue                  // 对象键 / 标签
  if (KEYWORDS.has(name)) continue
  if (GLOBALS.has(name)) continue
  if (SCAN_NOISE.has(name)) continue
  if (declared.has(name)) continue
  used.set(name, (used.get(name) || 0) + 1)
}

const suspicious = [...used.entries()].sort((a, b) => b[1] - a[1])

console.log('')
console.log(`声明名 ${declared.size} 个，疑似未定义 ${suspicious.length} 个`)
if (suspicious.length) {
  console.log('')
  for (const [name, n] of suspicious) console.log(`  ? ${name}  ×${n}`)
  console.log('')
  console.log('上面每一项都要人工确认：')
  console.log('  · 若是真未定义 → **浏览器里必然 ReferenceError**，必须修')
  console.log('  · 若是扫描误报（对象键/标签/短属性名等）→ 加进本脚本的白名单')
  process.exitCode = 1
} else {
  console.log('')
  console.log('✓ 没有发现未定义的裸标识符。')
}

// ---------------------------------------------------------------------------
// 额外：关键绑定的存在性（针对已经踩过的坑，做硬断言）
// ---------------------------------------------------------------------------
console.log('')
console.log('== 关键绑定硬断言 ==')
let bad = 0
const must = [
  // ★ 硬要求：外壳播种的 jsx() 只吃 (type, props) 两个参数，变长 children 会被
  //   静默丢弃（实测 .myh-root 有尺寸但里面永远全空）。必须用 createElement。
  ['h = React.createElement（不要用 jsxRuntime.jsx）', /const h = React\.createElement/],
  ['Fragment 绑定', /const Fragment = /],
  ['ReactDOMClient 绑定', /const ReactDOMClient = require\('react-dom\/client'\)/],
  ['SkinErrorBoundary 声明', /class SkinErrorBoundary extends React\.Component/],
  ['SkinRoot 声明', /function SkinRoot\(\)/],
  ['mountSkinRoot 声明', /function mountSkinRoot\(\)/],
  ['auditComponentRefs 声明', /function auditComponentRefs\(\)/],
]
for (const [label, re] of must) {
  const okk = re.test(src)
  console.log(`  ${okk ? '✓' : '✗'} ${label}`)
  if (!okk) bad++
}
// auditComponentRefs 里引用的每个名字都必须在文件里绑定过
const auditFn = src.slice(src.indexOf('function auditComponentRefs'), src.indexOf('function mountSkinRoot'))
const auditNames = [...auditFn.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1])
const missing = auditNames.filter((n) => {
  if (n === 'React' || n === 'ReactDOMClient' || n === 'jsxRuntime') return !new RegExp(`const ${n} =`).test(src)
  if (n === 'h' || n === 'Fragment') return !new RegExp(`const ${n} =`).test(src)
  if (n.startsWith('jsxRuntime')) return false
  return !new RegExp(`(function|class)\\s+${n}\\b|const ${n} =`).test(src)
})
console.log(`  ${missing.length ? '✗' : '✓'} auditComponentRefs 引用的名字全部有绑定${missing.length ? '（缺：' + missing.join(', ') + '）' : ''}`)
if (missing.length) bad++

if (bad) process.exitCode = 1

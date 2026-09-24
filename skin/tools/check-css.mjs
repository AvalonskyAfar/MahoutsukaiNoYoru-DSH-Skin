#!/usr/bin/env node
/**
 * CSS 健全性检查 —— 括号配平 + 自定义变量是否都有声明。
 * ---------------------------------------------------------------------------
 * 为什么需要：我们这套 CSS 是一整个字符串数组拼出来的整屏布局。
 * **少一个 `}` 或 `{` 会把后面的规则整段吞掉**（浏览器不会报错，只会静默失效），
 * 表现出来就是"某个区块莫名其妙不见了" —— 极难从现象反推。
 * 括号配平是纯机械判定的，必须在离线做掉。
 *
 * 用法：node skin/tools/check-css.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(SKIN, 'lib', 'client.js'), 'utf8')

// 从源码里把 `const CSS = [ ... ].join('\n')` 这一段取出来
const start = src.indexOf('const CSS = [')
if (start < 0) { console.log('✗ 没找到 const CSS = ['); process.exit(1) }
const endMark = src.indexOf(".join('\\n')", start)
if (endMark < 0) { console.log('✗ 找不到 CSS 数组的 .join 结尾'); process.exit(1) }
const body = src.slice(start, endMark)

// 逐行取出数组里的字符串字面量（每行形如：  '...'，）
const parts = []
for (const raw of body.split('\n')) {
  const t = raw.trim()
  if (!t.startsWith("'")) continue
  const m = /^'(.*)'\s*,?$/.exec(t)
  if (m) parts.push(m[1])
}
const css = parts.join('\n')

let depth = 0
let minDepth = 0
for (const c of css) {
  if (c === '{') depth++
  else if (c === '}') { depth--; if (depth < minDepth) minDepth = depth }
}

const decls = new Set((css.match(/--myh-[a-z0-9-]+\s*:/g) || []).map((s) => s.replace(/\s*:$/, '').trim()))
const used = [...new Set((css.match(/var\(--myh-[a-z0-9-]+/g) || []).map((s) => s.slice(4)))]

console.log('== CSS 健全性检查 ==')
console.log('  片段数        : ' + parts.length)
console.log('  字符数        : ' + css.length)
console.log('  最终括号深度  : ' + depth + '   (期望 0)')
console.log('  最小括号深度  : ' + minDepth + '   (期望 0；负值=有多余的 })')
console.log('  自定义变量    : 声明 ' + decls.size + ' 个，使用 ' + used.length + ' 个')

let bad = 0
if (depth !== 0) { console.log('  ✗ 括号不配平 —— 后面的规则会被整段吞掉'); bad++ } else { console.log('  ✓ 括号配平') }
if (minDepth < 0) { console.log('  ✗ 出现了多余的 }'); bad++ }

const undeclared = used.filter((u) => !decls.has(u))
if (undeclared.length) {
  // 有的是别处（比如元素 style 属性）声明的，这里只提示不算错
  console.log('  • 用到但本文件未声明（可能由 JS 内联 style 设置）: ' + undeclared.join(' '))
} else {
  console.log('  ✓ 所有 var(--myh-*) 都有声明')
}

// 关键规则抽查：这些是"原生 chrome 让位"的核心，丢了就完全不是一个新 UI
//
// ★★ 2026-09-20：`原生滚动容器让位` 那条**反向**了，是它把 bug 钉死的。
//    原来要求 `[data-conversation-scroll]{display:none}` ——
//    但 composer（输入框）是滚动体的**子节点**（读 DSH 源码：
//    `scrollBody[data-conversation-scroll]` 的 children 是
//    `[renderSlot("conversation.session"), composerSeat]`）。
//    藏滚动体 = 连输入框一起埋掉 → 用户对着一个点了没反应的空壳打字。
//    所以现在改成**反向断言**：滚动容器一律不得被隐藏。
const must = [
  ['原生消息列表让位', /\[data-slot=["']conversation\.session["']\]\s*\{[^}]*display\s*:\s*none/],
  ['页签条让位', /\[role=["']tablist["']\]\s*\{[^}]*display\s*:\s*none/],
  ['输入框改色', /\[data-composer-card\]/],
]
// 反向断言：这几样**绝不能**被 display:none（藏了就等于砸掉 DSH 的内核能力）
const mustNot = [
  ['热区未用 clip-path 挖洞', /clip-paths*:s*polygon/],
  ['滚动容器未被藏', /\[data-conversation-scroll\]\s*\{[^}]*display\s*:\s*none/],
]
console.log('')
for (const [name, re] of must) {
  const ok = re.test(css)
  if (!ok) bad++
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name)
}
for (const [name, re] of mustNot) {
  const hit = re.test(css)          // 命中 = 我们真的把不该藏的藏了 → 失败
  if (hit) bad++
  console.log('  ' + (hit ? '✗' : '✓') + ' ' + name)
}

console.log('')
if (bad) { console.log('✗ CSS 检查未通过（' + bad + ' 项）'); process.exit(1) }
console.log('✓ CSS 检查通过')

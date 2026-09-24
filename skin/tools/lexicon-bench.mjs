#!/usr/bin/env node
/**
 * lexicon-bench.mjs —— 拿**官方简中剧本**当语料，量词表到底能命中多少句。
 *
 * 为什么用它当语料：这是"真实中文对话/叙述"的现成样本，且与皮肤要分类的输入同源
 * （皮肤分类的是角色自己说的话，剧本里正是角色台词 + 叙述）。
 *
 * 输出：命中率、各槽位分布、以及**最常见的"未命中"句子样例**（用来指导补词）。
 *
 * 用法：
 *   node skin/tools/lexicon-bench.mjs                 # 全量扫
 *   node skin/tools/lexicon-bench.mjs --limit 4000
 *   node skin/tools/lexicon-bench.mjs --manifest <path>   # 换一份 manifest 对比
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const LIMIT = Number(argOf('--limit', 0)) || 0
const MANIFEST = argOf('--manifest', path.join(ROOT, 'skin', 'data', 'manifest.json'))
const CTD = argOf('--ctd', path.join(ROOT, 'game_scripts', 'ctd', 'data00200.hfa', 'script_text_zc.ctd'))

const SRC = fs.readFileSync(path.join(ROOT, 'skin', 'lib', 'client.js'), 'utf8')
const MANI = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))

function sliceBrace(src, mk) {
  const i = src.indexOf(mk); if (i < 0) throw new Error('找不到 ' + mk)
  let d = 0, s = false
  for (let j = i; j < src.length; j++) { const c = src[j]
    if (c === '{') { d++; s = true } else if (c === '}') { d--; if (s && d === 0) return src.slice(i, j + 1) } }
  throw new Error('括号不配平 ' + mk)
}
function sliceBracket(src, mk, o, c2) {
  const i = src.indexOf(mk); if (i < 0) throw new Error('找不到 ' + mk)
  let d = 0, s = false
  for (let j = i; j < src.length; j++) { const c = src[j]
    if (c === o) { d++; s = true } else if (c === c2) { d--; if (s && d === 0) return src.slice(i, j + 1) } }
  throw new Error('括号不配平 ' + mk)
}
const blocks = [
  sliceBracket(SRC, 'const PRIORITY = [', '[', ']') + ';',
  sliceBrace(SRC, 'const DEFAULT_FALLBACK = {'),
  sliceBrace(SRC, 'function buildLexiconIndex('),
  sliceBrace(SRC, 'function classifyText('),
]
const emo = {}
const factory = new Function('clamp', 'emo', 'lexiconIndex',
  blocks.join('\n') + '\nreturn {buildLexiconIndex, classifyText};')
const idx = (function () {
  const e = factory((v, a, b) => Math.min(b, Math.max(a, v)), emo, null)
  return e.buildLexiconIndex(MANI.lexicon || {})
})()
const eng = factory((v, a, b) => Math.min(b, Math.max(a, v)), emo, idx)

// ---- 语料：官方简中剧本的每一行 ----
const raw = fs.readFileSync(CTD, 'utf8').split(/\r?\n/)
let lines = raw.map((s) => s.trim()).filter((s) => s.length >= 4 && !/^[【\[<]/.test(s))
// --dialogue：只留**台词行**。皮肤分类的其实是"角色自己说的话"，
// 而剧本里大半是叙述（叙述本来就该判 neutral），全量命中率会低估实际表现。
if (argv.includes('--dialogue')) lines = lines.filter((s) => /[「『“」』”]/.test(s))
if (LIMIT) lines = lines.slice(0, LIMIT)

const dist = {}
const misses = []
let hit = 0
for (const line of lines) {
  const r = eng.classifyText(line, idx)
  if (r.score > 0) { hit++; dist[r.slot] = (dist[r.slot] || 0) + 1 }
  else if (misses.length < 4000) misses.push(line)
}
const pct = (n) => (n / lines.length * 100).toFixed(1) + '%'
console.log(`语料：${path.basename(CTD)}  共 ${lines.length} 行`)
console.log(`命中（分类器给出非 neutral 且 score>0）：${hit} 行 = ${pct(hit)}`)
console.log('槽位分布：')
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(10)} ${String(v).padStart(6)}  ${pct(v)}`)
}
console.log(`\n未命中样例（随机抽 12 条，用来指导补词）：`)
const step = Math.max(1, Math.floor(misses.length / 12))
for (let i = 0; i < misses.length && i < 12 * step; i += step) console.log('  · ' + misses[i].slice(0, 42))

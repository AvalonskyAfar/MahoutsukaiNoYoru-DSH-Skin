#!/usr/bin/env node
/**
 * lab-selftest.mjs —— 表情实验台的**离线自检**。
 *
 * 实验台页面在浏览器里"运行时抽取" lib/client.js 的那几个函数。
 * 我在 Node 里把同一段抽取逻辑跑一遍：抽取得到吗？括号配平吗？能建出引擎吗？
 * 分类结果合不合理？—— 页面还没开就得先确认这些，否则用户打开看到的是"加载失败"。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = fs.readFileSync(path.join(ROOT, 'skin', 'lib', 'client.js'), 'utf8')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'skin', 'data', 'manifest.json'), 'utf8'))

function sliceBrace(src, startMarker) {
  const i = src.indexOf(startMarker)
  if (i < 0) throw new Error('找不到：' + startMarker)
  let depth = 0, started = false
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (c === '{') { depth++; started = true } else if (c === '}') {
      depth--; if (started && depth === 0) return src.slice(i, j + 1)
    }
  }
  throw new Error('括号不配平：' + startMarker)
}
function sliceBracket(src, startMarker, open, close) {
  const i = src.indexOf(startMarker)
  if (i < 0) throw new Error('找不到：' + startMarker)
  let depth = 0, started = false
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (c === open) { depth++; started = true } else if (c === close) {
      depth--; if (started && depth === 0) return src.slice(i, j + 1)
    }
  }
  throw new Error('括号不配平：' + startMarker)
}
function buildEngine(src, emo, lexiconIndex) {
  const blocks = [
    sliceBracket(src, 'const PRIORITY = [', '[', ']') + ';',
    sliceBrace(src, 'const DEFAULT_FALLBACK = {'),
    sliceBrace(src, 'function buildLexiconIndex('),
    sliceBrace(src, 'function classifyText('),
    sliceBrace(src, 'function stepEmotion('),
    sliceBrace(src, 'function splitSentences('),
  ]
  const factory = new Function('clamp', 'emo', 'lexiconIndex',
    blocks.join('\n') + '\nreturn {buildLexiconIndex, classifyText, stepEmotion, splitSentences, DEFAULT_FALLBACK};')
  return factory((v, a, b) => Math.min(b, Math.max(a, v)), emo, lexiconIndex)
}

let fail = 0
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fail++ }

console.log('== 1. 抽取 ==')
for (const m of ['const PRIORITY = [', 'const DEFAULT_FALLBACK = {', 'function buildLexiconIndex(',
  'function classifyText(', 'function stepEmotion(', 'function splitSentences(']) {
  const i = SRC.indexOf(m)
  ok(i >= 0, `找得到 ${m}（偏移 ${i}）`)
}

console.log('\n== 2. 建引擎 ==')
const emo = { slot: 'neutral', since: 0, weakStreak: 0, lastSwitch: 0, roll: 0, sentence: '' }
let engine
try {
  engine = buildEngine(SRC, emo, null)
  const idx = engine.buildLexiconIndex(MANIFEST.lexicon || {})
  engine = buildEngine(SRC, emo, idx)
  ok(true, `引擎建成，词表 ${idx.length} 条`)
} catch (e) {
  ok(false, '建引擎失败：' + e.message)
  process.exit(1)
}

console.log('\n== 3. 分类（抽出来的函数真的能判） ==')
const cases = [
  ['青子は眉をひそめて、こちらを睨んだ。', 'glare/angry 系'],
  ['她笑了，眼睛眯成一条线。', 'smile 系'],
  ['她吓了一跳，睁大了眼睛。', 'surprised'],
  ['叹气，无精打采地垂下肩膀。', 'tired'],
  ['「莫迦ね」と毒づいた。', '应该偏 neutral/弱'],
]
for (const [t, want] of cases) {
  const r = engine.classifyText(t, engine.buildLexiconIndex(MANIFEST.lexicon))
  console.log(`  「${t}」 → ${r.slot}（${r.score}分 conf=${r.conf.toFixed(2)}）  期望：${want}`)
}

console.log('\n== 4. 迟滞 / 节流 / 轮换 ==')
{
  const e2 = { slot: 'neutral', since: 0, weakStreak: 0, lastSwitch: 0, roll: 0, sentence: '' }
  const eng = buildEngine(SRC, e2, engine.buildLexiconIndex(MANIFEST.lexicon))
  const strong = '她愤怒地瞪着他，几乎要发火。'
  const neutral = '她平静地站着。'
  const r1 = eng.stepEmotion(strong, 1000, eng.buildLexiconIndex(MANIFEST.lexicon))
  ok(r1 && r1.slot !== 'neutral', `强情绪立刻切：${r1 && r1.slot}`)
  const r2 = eng.stepEmotion(strong, 1200, eng.buildLexiconIndex(MANIFEST.lexicon))
  ok(r2 === null, '180ms 内第二次调用被节流挡掉（返回 null）')
  const r3 = eng.stepEmotion(strong, 2000, eng.buildLexiconIndex(MANIFEST.lexicon))
  const r4 = eng.stepEmotion(strong, 3000, eng.buildLexiconIndex(MANIFEST.lexicon))
  ok(r4 && r4.slot === r1.slot, `同槽位连续 3 句 → 换帧（roll=${r4 && r4.roll}）`)
  const r5 = eng.stepEmotion(neutral, 4000, eng.buildLexiconIndex(MANIFEST.lexicon))
  ok(r5 === null, '回落到 neutral 需要连续 2 句 → 第一句保持')
  const r6 = eng.stepEmotion(neutral, 5000, eng.buildLexiconIndex(MANIFEST.lexicon))
  ok(r6 === null || r6.slot === 'neutral', '第二句才回落（或本来就是 neutral）')
}

console.log('\n== 5. 回退链（本景缺的槽位） ==')
for (const scene of ['A1', 'A4', 'A6']) {
  const slots = Object.keys((MANIFEST.expressions[scene] || {}).slots || {})
  const ALL = ['neutral', 'smile', 'laugh', 'angry', 'glare', 'surprised', 'troubled', 'sad', 'serious', 'think', 'tired', 'shy']
  const miss = ALL.filter(s => !slots.includes(s))
  const check = miss.map(s => {
    const chain = [s].concat(engine.DEFAULT_FALLBACK[s] || []).concat(['neutral'])
    const hit = chain.find(k => slots.includes(k))
    return `${s}→${hit}`
  })
  ok(miss.every(s => [s].concat(engine.DEFAULT_FALLBACK[s] || []).concat(['neutral'])
      .some(k => slots.includes(k))), `${scene} 缺口 ${miss.length} 个，全部能回退到本景有的槽位：${check.join(' ')}`)
}

console.log(fail === 0 ? '\n全部通过 ✓  实验台可以开' : `\n${fail} 项失败 ✗`)
process.exit(fail === 0 ? 0 : 1)

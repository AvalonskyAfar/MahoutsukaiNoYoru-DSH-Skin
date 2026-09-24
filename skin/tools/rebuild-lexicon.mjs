#!/usr/bin/env node
/**
 * rebuild-lexicon.mjs —— **只重算情绪词表**，写回 `skin/data/manifest.json`。
 * ------------------------------------------------------------------
 * 为什么不跑 `assemble-assets.mjs`：那个会把 180MB 素材整个重拷一遍（幂等但慢）。
 * 词表是纯数据，改词表不该动素材。
 *
 * 词表逻辑来自 `lexicon-build.mjs`（与全量装配**同一份**，不会跑偏）。
 *
 * 用法：
 *   node skin/tools/rebuild-lexicon.mjs            # 写入（先备份 manifest）
 *   node skin/tools/rebuild-lexicon.mjs --dry      # 只打印对比，不写
 *   node skin/tools/rebuild-lexicon.mjs --revert   # 从 .bak 还原
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLexicon, buildCharacterLexicons, mergeLexicon, GUIDE, LANGUAGE } from './lexicon-build.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const MANI = path.join(ROOT, 'skin', 'data', 'manifest.json')
const BAK = MANI + '.bak'
const PRED = path.join(ROOT, 'persona_work', 'stage', 'cn_predicates.json')

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')

if (argv.includes('--revert')) {
  if (!fs.existsSync(BAK)) { console.error('没有备份：' + BAK); process.exit(1) }
  fs.copyFileSync(BAK, MANI)
  console.log('已从备份还原 ' + MANI)
  process.exit(0)
}

const predicates = JSON.parse(fs.readFileSync(PRED, 'utf8'))
const mani = JSON.parse(fs.readFileSync(MANI, 'utf8'))
const before = mani.lexicon || {}
const { lexicon, slotSupport, keywords, stats } = buildLexicon(predicates)

const count = (lx) => Object.values(lx).reduce((a, v) => a + v.length, 0)
const single = (lx) => Object.values(lx).flat().filter((x) => x.w.length === 1).length

console.log('槽位            改前   改后')
const slots = new Set([...Object.keys(before), ...Object.keys(lexicon)])
for (const s of [...slots].sort()) {
  const a = (before[s] || []).length, b = (lexicon[s] || []).length
  console.log(`  ${s.padEnd(12)} ${String(a).padStart(4)}  ${String(b).padStart(5)}${a !== b ? '   ←' : ''}`)
}
console.log(`合计：${count(before)} → ${count(lexicon)} 词；单字词根 ${single(before)} → ${single(lexicon)} 个`)
console.log('新增示例：')
for (const s of ['angry', 'glare', 'tired', 'shy', 'surprised', 'smile']) {
  const oldW = new Set((before[s] || []).map((x) => x.w))
  const add = (lexicon[s] || []).filter((x) => !oldW.has(x.w)).map((x) => x.w)
  if (add.length) console.log(`  ${s.padEnd(10)} + ${add.slice(0, 18).join('、')}`)
}
console.log('剔除示例（原有的叙述长句）：')
for (const s of Object.keys(before)) {
  const newW = new Set((lexicon[s] || []).map((x) => x.w))
  const del = (before[s] || []).filter((x) => !newW.has(x.w) && x.w.length >= 5).map((x) => x.w)
  if (del.length) console.log(`  ${s.padEnd(10)} - ${del.slice(0, 10).join('、')}`)
}

if (DRY) { console.log('\n--dry：没有写文件'); process.exit(0) }
fs.copyFileSync(MANI, BAK)
mani.lexicon = lexicon
mani.slotSupport = slotSupport
mani.keywords = keywords
// ★ 角色专属词表（三个人物各自的说法，见 persona-emotions.mjs）
const byChar = buildCharacterLexicons()
mani.lexiconByCharacter = byChar
for (const [slug, lx] of Object.entries(byChar)) {
  const merged = mergeLexicon(lexicon, lx)
  const n = Object.values(lx).reduce((a, v) => a + v.length, 0)
  console.log(`  角色 ${slug.padEnd(8)} 专属说法 ${n} 条 → 并表后 ${Object.values(merged).reduce((a, v) => a + v.length, 0)} 词`)
}
// ⚠ 幂等：原来是无条件 `note += ...`，每跑一次就多追加一段，跑几次就重复几次
//   （2026-09-21 实测已累积 8 遍）。改成"没有该标记才追加"。
const NOTE_TAG = '情绪词表重算（lexicon-build.mjs）+ 角色专属层'
if (!(mani.note || '').includes(NOTE_TAG)) {
  mani.note = (mani.note || '') + ' ｜ ' + NOTE_TAG
}

// ★ 重写人格注入文件（= injection.md + 语言硬约束 + 情感表达约定）。
//   宿主半边读的就是这几个 .md；不重写的话这两段传不到模型那边。
//   2026-09-21：加 LANGUAGE 段（原先只有 GUIDE，导致角色把日文语尾嵌进中文句子）。
//
//   ⚠ 顺序要紧：**先算好 personas，再一次性写 manifest**。
//   原实现先写 manifest 再写 .md，而 `mani.personas.<slug>.injection` 只在
//   assemble-assets 里更新过 —— 于是 rebuild 之后 manifest 里那份 injection
//   永远是旧的（只剩裸 injection.md），与磁盘上的 .md 不一致。
//   客户端目前不读这个字段，但留着两处不一致迟早害人，这里一并写齐。
const PDIR = path.join(ROOT, 'skin', 'data', 'personas')
for (const slug of Object.keys(byChar)) {
  const src = path.join(ROOT, 'personas', slug + '-skill', 'soul', 'injection.md')
  if (!fs.existsSync(src)) { console.log(`  !! 缺 ${src}`); continue }
  const core = fs.readFileSync(src, 'utf8')
  const text = core
    + (LANGUAGE[slug] ? '\n\n---\n\n' + LANGUAGE[slug] + '\n' : '')
    + (GUIDE[slug] ? '\n\n---\n\n' + GUIDE[slug] + '\n' : '')
  fs.writeFileSync(path.join(PDIR, slug + '.md'), text, 'utf8')
  // 同步 manifest 里的那份副本，保证两处逐字一致
  if (!mani.personas) mani.personas = {}
  mani.personas[slug] = Object.assign({}, mani.personas[slug] || {}, { slug, injection: text })
  console.log(`  人格注入 ${slug}.md ← injection.md + 语言约束 + 情感表达约定（${text.length} 字符）`)
}

fs.writeFileSync(MANI, JSON.stringify(mani, null, 1))
console.log(`\n已写入 ${MANI}（备份 ${path.basename(BAK)}）`)

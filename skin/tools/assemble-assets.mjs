#!/usr/bin/env node
/**
 * 魔法使之夜 DSH 皮肤 · 素材装配
 * ------------------------------------------------------------------
 * 把插件真正用到的原作素材从 `hfa_png/out` 与 `bgm/` 拷进 `skin/assets/`，
 * 原图原大小、不压缩、不重编码（用户 2026-09-16 决议）。
 *
 * 产物：
 *   skin/assets/ui/*.png           UI 构件（语言中立 + 简体中文 _zc 变体）
 *   skin/assets/bg/<name>.png      12 个景的背景 + ED 背景
 *   skin/assets/sprite/<name>.png  立绘（仅 expressions.json 用到的文件名）
 *   skin/assets/bgm/*.ogg          13 首选曲
 *   skin/data/manifest.json        皮肤运行时读的总清单（含所有索引表）
 *
 * ⛔ 不要运行本脚本 —— 自 2026-09-20 起它已作废，见下方 GUARD 段。
 *    改词表请用 `rebuild-lexicon.mjs`（安全，不碰素材）。
 *
 * 用法：node skin/tools/assemble-assets.mjs [--dry]
 *       node skin/tools/assemble-assets.mjs --i-know-this-destroys-manifest  # 仅在重建整条管线时
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLexicon, buildCharacterLexicons, GUIDE, LANGUAGE } from './lexicon-build.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')          // D:\QuickLook插件包\moye
const SKIN = path.resolve(__dirname, '..')                // ...\moye\skin
const OUT_PNG = path.join(ROOT, 'hfa_png', 'out')
const BGM_SRC = path.join(ROOT, 'bgm')
const STAGE = path.join(ROOT, 'persona_work', 'stage')
const PERSONAS = path.join(ROOT, 'personas')
const ASSETS = path.join(SKIN, 'assets')
const DATA = path.join(SKIN, 'data')

const DRY = process.argv.includes('--dry')
const MANIFEST = path.join(DATA, 'manifest.json')
const OVERRIDE = '--i-know-this-destroys-manifest'

/* ══════════════════════════════════════════════════════════════════════
 * GUARD：作废拦截（2026-09-23 加）
 * ----------------------------------------------------------------------
 * 本脚本读的是**旧立绘管线**：`persona_work/stage/expressions.json`
 * （文件名 `aok_n_12_02_01.mzp.png`）。而线上 manifest 用的是另一条管线
 * 产出的命名（`stage_a3_c02_01.png`，来自 build_stage_sprites.py +
 * apply_stage_manifest.py）。两者**不同源**。
 *
 * 2026-09-20 误跑一次的实录后果（67 处差异）：
 *   · 12 景的 `slots` 全被重写
 *   · 12 景的 `stageSource` 全消失
 *   · `spriteBases` 5 → 157
 *   · 往 assets/sprite/ 多拷 157 个旧命名立绘（30.3 MB 死重量）
 *
 * 判据：线上 manifest 含 `stageSource` ⇒ 是"新管线"，本脚本不能碰。
 * 本脚本引用的输入文件至今全都存在，所以误跑**必然成功执行并再次破坏**，
 * 不能靠"文件不在就会报错"来兜底。
 * ════════════════════════════════════════════════════════════════════ */
function guardManifest() {
  if (process.argv.includes(OVERRIDE)) return
  let raw
  try {
    raw = fs.readFileSync(MANIFEST, 'utf8')
  } catch {
    return                                  // manifest 不存在：首次装配，放行
  }
  let m
  try {
    m = JSON.parse(raw)
  } catch {
    return                                  // 解析不了就不拦，让后续流程自己报错
  }
  /* 判据：`expressions.<槽>.stageSource` 是新管线写入的字段（实测在 A1–A6 六个槽上）。
     旧管线产出的 manifest 没有它。注意它**不在** scenes 下 —— scenes 里的景对象只有
     `stage`（构图参数），新立绘的来源记在 expressions 上。 */
  const exps = m.expressions && typeof m.expressions === 'object' ? m.expressions : {}
  const withSource = Object.keys(exps).filter(function (k) {
    return exps[k] && exps[k].stageSource
  })
  if (!withSource.length) return            // 旧管线产物，放行

  const lines = [
    '',
    '⛔ 拒绝执行：本脚本会毁掉 data/manifest.json。',
    '',
    '   当前 manifest 是新立绘管线的产物（' + withSource.length + ' 个槽带 stageSource：' +
      withSource.join('/') + '），',
    '   而本脚本读的是旧管线的 persona_work/stage/expressions.json。',
    '   2026-09-20 误跑一次的实测后果：12 景 slots 被重写、stageSource 全丢、',
    '   多拷 157 个旧命名立绘进 assets/sprite/（30.3 MB）。',
    '',
    '   想改词表  → node skin/tools/rebuild-lexicon.mjs',
    '   想改立绘  → node persona_work/tools/apply_stage_manifest.py',
    '   真要整条重装 → 先备份 manifest.json，再加 ' + OVERRIDE + ' 参数',
    '',
    '   详见 skin/README.md §12.1。',
    '',
  ]
  console.error(lines.join('\n'))
  process.exit(2)
}

guardManifest()

/** 立绘所在的 data 目录（按角色前缀）。实测：三个角色分别在这三个目录。 */
const SPRITE_DIRS = ['data02100', 'data02110', 'data02150']

/**
 * UI 构件清单：语言中立文件 + 简体中文 `_zc` 变体。
 * 只挑皮肤真正渲染的那些，不整目录搬（data00000 有 1094 个文件 / 74.6MB）。
 */
const UI_BASES = [
  // 正文层
  'txtwindow00', 'txtwindow01', 'txtwindow02',
  'lineBreak', 'lineBreak_a',
  // 菜单板 / 菜单项 / 按钮
  'menu_window', 'menu_btn', 'mu_text1', 'mu_text2', 'mu_text3',
  'mu_title', 'mu_bar', 'mu_bartext_composer', 'title_menu', 'popup',
  // 書庫
  'archive_background', 'archive_frame', 'archive_window',
  'archive_window_slider', 'archive_read', 'archive_unread',
  // 付箋（九宫格）
  'nz13', 'nz19', 'nz26',
  // 回想 / 轨迹
  'bg_backlog', 'back_win', 'back_title', 'back_cursor',
  // 設定
  'conf_frame', 'conf_band', 'conf_title', 'conf_sbar', 'conf_sbar2',
  'conf_sbtn', 'conf_stxt01', 'conf_stxt2', 'conf_manual1', 'btn_base0',
  // 弹窗
  'dialog_win', 'dialog_btn', 'caution', 'system_popup',
  // 选项条 / 滚动条（材质语言与尺寸实测的来源）
  'sel_win', 'scroll_bar',
  // 过渡 / 装饰
  'alphagradation', 'sp1', 'sp2', 'kusa1', 'kusa2', 'effect',
]
/**
 * ⚠ 原作素材里的确缺失、本皮肤不用的项（实测 `data00000` 全目录无此文件，不是脚本查漏）：
 *   conf_stxt      —— 实际叫 conf_stxt01 / conf_stxt2，已改用这两个
 *   alphagradation_inv —— 只有 alphagradation 与 alphagradation{020..512}，无 _inv
 *   archive_bookbutton02 / archive_bookshadow01 / archive_bookshadow10 —— 书脊组本身就缺这几档
 */
/** 書庫书脊 01~21（每档 4 状态并排）。缺档由脚本自动跳过。 */
for (let i = 1; i <= 21; i++) UI_BASES.push('archive_bookbutton' + String(i).padStart(2, '0'))
for (let i = 1; i <= 21; i++) UI_BASES.push('archive_bookshadow' + String(i).padStart(2, '0'))

/** 六个人物（三人 × 昼/夜）→ 背景景号 + 景 ID */
const CHARACTERS = [
  { id: 'aoko',   cn: '蒼崎青子',  sprite: 'aok', light: 'A3', dark: 'A4' },
  { id: 'alice',  cn: '久遠寺有珠', sprite: 'ari', light: 'A1', dark: 'A2' },
  { id: 'kumari', cn: '久万梨金鹿', sprite: 'koj', light: 'A5', dark: 'A6' },
]

const log = (...a) => console.log(...a)
let copied = 0, skipped = 0, bytes = 0
const missing = []

function ensureDir(p) { if (!DRY) fs.mkdirSync(p, { recursive: true }) }

function copy(src, dstRel) {
  const dst = path.join(ASSETS, dstRel)
  if (!fs.existsSync(src)) { missing.push(src); return null }
  const st = fs.statSync(src)
  if (fs.existsSync(dst) && fs.statSync(dst).size === st.size) { skipped++; return dstRel }
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
  copied++; bytes += st.size
  return dstRel
}

/**
 * 在 OUT_PNG 建一次索引：`<目录>/<去双后缀的文件名>` → 绝对路径。
 * 例：`data02010/img3008.mzp.png` → key `data02010/img3008`。
 * 一次遍历到底（24285 个文件）。
 */
function buildIndex() {
  const idx = new Map()
  for (const d of fs.readdirSync(OUT_PNG, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const dir = path.join(OUT_PNG, d.name)
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.png')) continue
      const key = d.name + '/' + stripExt(f)
      if (!idx.has(key)) idx.set(key, [])
      idx.get(key).push(path.join(dir, f))
    }
  }
  return idx
}

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }

/** 去掉 .mzp.png / .cbg.png 双后缀，得到原作用的文件标识。 */
function stripExt(f) {
  if (f.endsWith('.mzp.png')) return f.slice(0, -8)
  if (f.endsWith('.cbg.png')) return f.slice(0, -8)
  return f
}

// ------------------------------------------------------------------
log('== 读取设计产物 ==')
const scenes = readJSON(path.join(STAGE, 'scenes.json'))
const expressions = readJSON(path.join(STAGE, 'expressions.json'))
const predicates = readJSON(path.join(STAGE, 'cn_predicates.json'))
const idx = buildIndex()
log(`   索引: ${idx.size} 项（<目录>/<文件名>）`)

/** 精确查（键 = `<目录>/<文件名>`，与 scenes.json / expressions.json 的写法一致）。 */
const lookup = (rel) => idx.get(rel.replace(/\\/g, '/')) || []
/** 前缀查（UI 构件要连 4 状态 / 语言变体一起拿）。 */
const lookupPrefix = (dir, prefix) => {
  const out = []
  for (const [k, v] of idx) if (k.startsWith(dir + '/' + prefix)) out.push(...v)
  return out
}

// ------------------------------------------------------------------
log('== 1/4 UI 构件 ==')
let uiCount = 0
for (const base of UI_BASES) {
  const hits = lookupPrefix('data00000', base)
  // 前缀查会带进 archive_bookbutton01x 之类；按「下一个字符不是数字」收紧
  const tight = hits.filter((abs) => {
    const stem = stripExt(path.basename(abs))
    if (!stem.startsWith(base)) return false
    const rest = stem.slice(base.length)
    return rest === '' || !/^\d/.test(rest)
  })
  if (!tight.length) { missing.push('UI:' + base); continue }
  for (const abs of tight) {
    const f = path.basename(abs)
    if (/_ja\.|_en\.|_zt\./.test(f)) continue        // 只要语言中立 + 简中
    if (copy(abs, path.join('ui', f))) uiCount++
  }
}
log(`   UI: ${uiCount} 个文件`)

/**
 * UI 构件表：皮肤运行时按用途取件。
 * 键名是**用途**，值是 assets 下的相对路径；语言一律取简体中文 `_zc` 变体（无则语言中立）。
 */
const uiTable = {}
{
  const d0 = path.join(OUT_PNG, 'data00000')
  const has = (f) => fs.existsSync(path.join(d0, f))
  /** 取 `<base>_zc.*` 优先，其次语言中立。 */
  const pick = (base) => {
    const all = fs.readdirSync(d0).filter((f) => f.startsWith(base) &&
      (f === base + '.cbg.png' || f === base + '.mzp.png' || f.startsWith(base + '_zc.')))
    // 语言中立优先（同一 base 只有一份时它就是了）
    const neutral = all.find((f) => !/_(ja|en|zt|zc)\./.test(f))
    const zc = all.find((f) => f.includes('_zc.'))
    const chosen = zc || neutral || all[0]
    return chosen ? 'ui/' + chosen : ''
  }
  const firstOf = (base) => {
    const all = fs.readdirSync(d0).filter((f) => f.startsWith(base) && !/_(ja|en|zt)\./.test(f))
    return all.length ? 'ui/' + all.sort()[0] : ''
  }

  // 正文暗带三档：00 最深 / 01 中 / 02 最浅（docs/15 §5.1）
  uiTable.txtwindow = ['txtwindow00', 'txtwindow01', 'txtwindow02'].map((b) => firstOf(b))
  uiTable.lineBreak = firstOf('lineBreak')          // lineBreak.cbg.png（不含 _a 图集）
  uiTable.menuWindow = firstOf('menu_window')
  uiTable.menuBtn = pick('menu_btn')
  uiTable.muText = ['mu_text1_select', 'mu_text2_select', 'mu_text3_select'].map((b) => pick(b))
  uiTable.muTitle = pick('mu_title')
  uiTable.muBar = firstOf('mu_bar')
  uiTable.titleMenu = pick('title_menu')
  uiTable.archiveBackground = firstOf('archive_background')
  uiTable.archiveFrame = firstOf('archive_frame')
  uiTable.archiveWindow = firstOf('archive_window')
  uiTable.archiveRead = pick('archive_read')
  uiTable.archiveUnread = pick('archive_unread')
  uiTable.bgBacklog = firstOf('bg_backlog')
  uiTable.backWin = firstOf('back_win')
  uiTable.nz = firstOf('nz19CC')                     // 付箋九宫格中央
  uiTable.nzEdge = firstOf('nz19LU')
  uiTable.confTitle = pick('conf_title')
  uiTable.confFrame = firstOf('conf_frame')
  uiTable.confBand = firstOf('conf_band')
  uiTable.dialogWin = firstOf('dialog_win')
  uiTable.caution = pick('caution')
  uiTable.scrollBar = firstOf('scroll_bar')
  uiTable.selWin = firstOf('sel_win')
  // 書脊组（01~21，缺 02 档；每档 4 状态并排，用 background-position 取第 1 档）
  uiTable.bookButtons = []
  for (let i = 1; i <= 21; i++) {
    const f = 'archive_bookbutton' + String(i).padStart(2, '0') + '.cbg.png'
    if (has(f)) uiTable.bookButtons.push('ui/' + f)
  }
  // 端帽与名字分隔：menu_window 里没有可直接切的缠枝纹小图，
  // 用 mu_bar（1920×20 细青渐变条）作近似——同名母题，且它本来就是"页边细线"。
  uiTable.cap = uiTable.muBar
  uiTable.band = uiTable.muBar
  // 木框 border-image 源（九宫格）
  uiTable.wood = uiTable.archiveFrame
}

// ------------------------------------------------------------------
log('== 2/4 背景 ==')
const bgMap = {}                                    // 景号 -> assets 相对路径
for (const [sid, s] of Object.entries(scenes.scenes)) {
  const hits = lookup(s.background.replace(/\.mzp\.png$/, '').replace(/\.cbg\.png$/, ''))
  if (!hits.length) { missing.push('BG:' + s.background); continue }
  const rel = copy(hits[0], path.join('bg', `${sid}_${path.basename(hits[0])}`))
  if (rel) bgMap[sid] = rel.replace(/\\/g, '/')
}
// ED 背景（已定案：img2073 夜空柔焦版）
{
  const hits = lookup('data02002/img2073')
  if (hits.length) {
    const rel = copy(hits[0], path.join('bg', 'ED_img2073.mzp.png'))
    if (rel) bgMap.ED = rel.replace(/\\/g, '/')
  } else missing.push('BG:data02002/img2073')
}
log(`   背景: ${Object.keys(bgMap).length} 个景 (含 ED)`)

// ------------------------------------------------------------------
log('== 3/4 立绘 ==')
/** 收集 expressions.json 里用到的全部文件名（不带目录）。 */
const spriteBases = new Set()
for (const sc of Object.values(expressions.scenes)) {
  for (const bucket of Object.values(sc.slots || {})) for (const e of bucket) spriteBases.add(e.file)
}
/** 立绘文件名 → 源绝对路径（只认三个立绘目录、排除 _b 全身版）。 */
const spriteSrc = (file) => {
  for (const d of SPRITE_DIRS) {
    const hits = idx.get(d + '/' + file)
    if (hits && hits.length) return hits[0]
  }
  return null
}
let spriteCount = 0
for (const b of spriteBases) {
  const abs = spriteSrc(b)
  if (!abs) { missing.push('SPRITE:' + b); continue }
  if (copy(abs, path.join('sprite', path.basename(abs)))) spriteCount++
}
log(`   立绘: ${spriteCount} 个文件（源 basename ${spriteBases.size} 个）`)

// ------------------------------------------------------------------
log('== 4/4 BGM ==')
const BGM_TRACKS = {
  titleLight: 'm01s',
  titleDark: 'm56',
  dailyLight: ['m02', 'm08', 'm09', 'm17', 'm27', 'm29', 'm37', 'm49'],
  dailyDark: ['m06', 'm18', 'm46', 'm47', 'm63'],
  ending: 'm53',
}
const bgmMap = { dailyLight: [], dailyDark: [] }
const allTracks = [BGM_TRACKS.titleLight, BGM_TRACKS.titleDark, ...BGM_TRACKS.dailyLight, ...BGM_TRACKS.dailyDark, BGM_TRACKS.ending]
for (const t of allTracks) {
  const src = path.join(BGM_SRC, t + '.ogg')
  const rel = copy(src, path.join('bgm', t + '.ogg'))
  if (!rel) continue
  if (t === BGM_TRACKS.titleLight) bgmMap.titleLight = rel.replace(/\\/g, '/')
  else if (t === BGM_TRACKS.titleDark) bgmMap.titleDark = rel.replace(/\\/g, '/')
  else if (t === BGM_TRACKS.ending) bgmMap.ending = rel.replace(/\\/g, '/')
  else if (BGM_TRACKS.dailyLight.includes(t)) bgmMap.dailyLight.push({ id: t, url: rel.replace(/\\/g, '/') })
  else if (BGM_TRACKS.dailyDark.includes(t)) bgmMap.dailyDark.push({ id: t, url: rel.replace(/\\/g, '/') })
}
log(`   BGM: ${allTracks.length} 首`)

// ------------------------------------------------------------------
log('== 生成 manifest.json ==')

/** 立绘文件名 → assets 相对 URL（只含特写版）。 */
const spriteUrl = (file) => {
  const abs = spriteSrc(file)
  return abs ? 'sprite/' + path.basename(abs) : null
}

/**
 * ★★ 立绘站画面的**哪一侧**（按景，唯一事实来源）—— 2026-09-19。
 * 这一项以前硬编码在三个地方且互相漂移（`lib/client.js` 的 CSS 兜底 20vw、
 * `preview/expression-lab.html` 的 `right:5%`、`preview/index.html` 的居中），
 * 现在统一由本表生成到 `manifest.expressions[<景>].spriteSide`，运行时/实验台/预览页都读它。
 *
 * 为什么只有金鹿的 **A5** 在**左**：
 *   金鹿的立绘素材**面朝右**。摆在画面右侧时她的视线指向屏幕外（背对观众）；
 *   摆到左侧，视线横穿画面、正好落到中央的对话框上 —— 即"看着自己要说的话"。
 *   其余景（青子 A3/A4、有珠 A1/A2）的素材朝向相反，保持右侧。
 *
 *   2026-09-20：本表一度把 A5 **和** A6 都设成靠左。**A6（洋馆客室·夜）按用户要求回右侧**
 *   —— 用户只要求 A5（公园步道·秋）靠左，A6 是当时一并加上的，已撤销。现在靠左的只有 A5。
 *
 *   ⚠ 「面朝右」是**设计理由，不是像素实测结论**（2026-09-19 复核）：整身取景素材
 *     不透明区域横跨 99% 画布宽，头部区（上 25%）左右质量比 A5 0.50:0.50 / A6 0.57:0.43，
 *     **量不出明确朝向**（对照组 A1/A2 反而是 0.64:0.36）。所以这一条最终仍需人眼确认；
 *     对照页：`skin/preview/sprite-side-compare.html`（同一素材 left/right 并排）。
 * 取值只有 'left' / 'right'，**默认 'right'**（表里没写 = 右，兼容旧 manifest）。
 */
const SPRITE_SIDE_LEFT = new Set(['A5'])   // 久万梨金鹿：仅 A5（公园步道·秋）；A6 已回右侧
const spriteSideOf = (sid) => (SPRITE_SIDE_LEFT.has(sid) ? 'left' : 'right')

/** 把 expressions.json 压成「景 → 槽位 → [文件URL]」，并按置信度排序。 */
const expressionTable = {}
for (const [sid, sc] of Object.entries(expressions.scenes)) {
  const slots = {}
  for (const [slot, bucket] of Object.entries(sc.slots || {})) {
    const rank = { high: 0, mid: 1, low: 2 }
    const sorted = [...bucket].sort((a, b) => (rank[a.conf] ?? 3) - (rank[b.conf] ?? 3))
    const urls = []
    for (const e of sorted) { const u = spriteUrl(e.file); if (u && !urls.includes(u)) urls.push(u) }
    if (urls.length) slots[slot] = urls
  }
  expressionTable[sid] = { slots, fallback: sc.fallback || expressions.fallback, spriteSide: spriteSideOf(sid) }
}

log(`   立绘站位: ${Object.entries(expressionTable)
  .filter(([, v]) => v.spriteSide === 'left').map(([k]) => k).join(',') || '（无）'} 靠左，其余靠右`
  + `（共 ${Object.keys(expressionTable).length} 景）`)

/**
 * 中文情绪词表：**生成逻辑在 `lexicon-build.mjs`**（唯一来源）。
 * 2026-09-19 从本文件抽出，并修掉三处过滤缺陷 —— 详见 `lexicon-build.mjs` 顶部注释。
 * 抽出的原因：`rebuild-lexicon.mjs`（只重算词表、不重拷素材）要用**同一份**逻辑。
 */
const { lexicon, slotSupport, stats: lexiconStats } = buildLexicon(predicates)
log(`   情绪词表: ${lexiconStats.slots} 槽 / ${lexiconStats.words} 词（单字 ${lexiconStats.singleChars} 个）`)

/** 人格 skill：soul/injection.md 全文 + **语言硬约束** + **情感表达约定**（同时落一份给宿主半边读的 .md）。 */
const personas = {}
const characterLexicons = buildCharacterLexicons()
for (const c of CHARACTERS) {
  const dir = path.join(PERSONAS, c.id + '-skill')
  const inj = path.join(dir, 'soul', 'injection.md')
  if (!fs.existsSync(inj)) { missing.push('PERSONA:' + c.id); continue }
  const core = fs.readFileSync(inj, 'utf8')
  // ★ 2026-09-19：注入里追加"情感表达约定" —— 让**说话方式**与**立绘表情**同一条口径。
  //   不加这段的话，人格层与表情层各说各话：她用角色腔说话，词表听不懂，
  //   表情就一动不动（实测：43 句真实输出只切 2 次）。
  // ★ 2026-09-21：追加"语言硬约束" —— 原先没有这一条，角色会把日文语尾
  //   （〜わよ／〜のよ／自称 私）原样嵌进中文句子（见 blind_test/answer_*.txt）。
  const lang = LANGUAGE[c.id] ? '\n\n---\n\n' + LANGUAGE[c.id] + '\n' : ''
  const guide = GUIDE[c.id] ? '\n\n---\n\n' + GUIDE[c.id] + '\n' : ''
  const text = core + lang + guide
  personas[c.id] = { slug: c.id, cn: c.cn, injection: text }
  if (!DRY) {
    fs.mkdirSync(path.join(DATA, 'personas'), { recursive: true })
    fs.writeFileSync(path.join(DATA, 'personas', c.id + '.md'), text, 'utf8')
  }
}
log(`   人格注入: ${Object.keys(personas).length} 份（含语言约束 + 情感表达约定）`)

const manifest = {
  generated_at: new Date().toISOString(),
  note: '由 skin/tools/assemble-assets.mjs 生成；素材为原作原图原大小，未压缩未重编码。',
  canvas: scenes.canvas,
  dialogSafeTop: scenes.dialog_safe_top,
  characters: CHARACTERS,
  /** UI 构件 URL（相对 assets/，客户端 assetURL() 会补前缀）。取不到的项是空串。 */
  ui: uiTable,
  scenes: Object.fromEntries(
    Object.entries(scenes.scenes).map(([sid, s]) => [sid, {
      id: sid, name: s.name, role: s.role, tone: s.tone,
      character: s.character, outfit_i3: s.outfit_i3, outfit_name: s.outfit_name,
      bg: bgMap[sid] || null,
      stage: s.stage,
    }]),
  ),
  edBackground: bgMap.ED || null,
  expressions: expressionTable,
  lexicon,
  slotSupport,
  /** ★ 角色专属词表：客户端按当前角色并进 lexicon（见 persona-emotions.mjs） */
  lexiconByCharacter: characterLexicons,
  keywords: Object.fromEntries(Object.entries(lexicon).map(([k, v]) => [k, v.map((x) => x.w)])),
  bgm: bgmMap,
  personas,
  spriteBases: [...spriteBases].sort(),
}

if (!DRY) {
  fs.mkdirSync(DATA, { recursive: true })
  fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8')
  // 供 host 侧静态路由查表的资产索引
  const listing = {}
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name)
      if (d.isDirectory()) walk(p, prefix + d.name + '/')
      else listing[prefix + d.name] = fs.statSync(p).size
    }
  }
  walk(ASSETS, '')
  fs.writeFileSync(path.join(DATA, 'assets-index.json'), JSON.stringify(listing), 'utf8')
  log(`   manifest.json + assets-index.json（${Object.keys(listing).length} 个素材文件）`)
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'
log('')
log(`完成${DRY ? '（dry-run，未写盘）' : ''}：复制 ${copied}，跳过 ${skipped}，新增 ${mb(bytes)}`)
if (missing.length) {
  log(`⚠ 缺失 ${missing.length} 项：`)
  for (const m of missing.slice(0, 40)) log('   - ' + m)
  if (missing.length > 40) log(`   ... 其余 ${missing.length - 40} 项`)
} else log('缺失 0 项 ✅')

#!/usr/bin/env node
/**
 * restore-expressions.mjs —— 把 `skin/data/manifest.json` 的**立绘表**从权威源重建。
 *
 * ## 为什么需要这个脚本
 * `skin/tools/assemble-assets.mjs` L135 读的是 `persona_work/stage/expressions.json` ——
 * 那是**旧立绘管线**的产物（槽位值是 `{file:...}` 对象、命名来自原始扫描）。
 * 而现行权威立绘表来自：
 *
 *   persona_work/tools/build_stage_spec.py   → stage_spec.json
 *   persona_work/tools/build_stage_sprites.py→ skin/assets/sprite/stage_*.png
 *   persona_work/tools/apply_stage_manifest.py → **直接写 manifest.expressions**
 *
 * 所以「重跑 assemble-assets.mjs」会**把立绘表倒灌回旧版本**：实测 `slots` 图片引用
 * 从 152 涨到 212、`spriteBases` 从 5 涨到 157。2026-09-20 就这么被踩过一次。
 *
 * 本脚本只做一件事：**从权威源重建 `expressions` 与 `spriteBases`，其余字段一律不动**。
 *
 * ## 权威源与依据
 * · `expressions[景].slots`   ← `persona_work/stage/stage_sprites.json`（逐字，含数组顺序）
 * · `expressions[景].fallback` ← `skin/lib/client.js` 的 `DEFAULT_FALLBACK`（唯一来源；12 景同一份）
 * · `expressions[景].spriteSide` ← 见 SPRITE_SIDE_LEFT（A5 靠左，其余靠右）
 * · `expressions[景].stageSource` ← 同上 json 的 `source` 字段
 * · `expressions[B1~B6]`      ← 无立绘：`{slots:{}, fallback, spriteSide:'right'}`
 * · `spriteBases`             ← 由上面 slots 里出现过的 `_<批次>_<i3>` 前缀反推
 *
 * 用法：
 *   node persona_work/tools/restore-expressions.mjs            # 试跑，只报告差异
 *   node persona_work/tools/restore-expressions.mjs --write    # 真正写回（先自动备份）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const MANIFEST = path.join(ROOT, 'skin', 'data', 'manifest.json')
const STAGE_SPRITES = path.join(ROOT, 'persona_work', 'stage', 'stage_sprites.json')
const CLIENT = path.join(ROOT, 'skin', 'lib', 'client.js')

/** 靠左的景。A6 按用户要求已回右侧（见 assemble-assets.mjs 同名常量）。 */
const SPRITE_SIDE_LEFT = new Set(['A5'])

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

/** 从 client.js 抽出 DEFAULT_FALLBACK —— 单一来源，别在这里重写一遍。 */
function readDefaultFallback() {
  const src = fs.readFileSync(CLIENT, 'utf8')
  const m = /DEFAULT_FALLBACK\s*=\s*(\{[\s\S]*?\n\s*\})/.exec(src)
  if (!m) throw new Error('client.js 里找不到 DEFAULT_FALLBACK')
  // 该字面量是纯数据（无变量引用），可安全求值
  return new Function('return ' + m[1])()
}

/** 由文件名反推 spriteBases 前缀，如 `stage_a5_c07_00.png` → `koj_n_00`。 */
function basesFrom(slotsByScene, stageSprites) {
  const out = new Set()
  for (const [sid, sc] of Object.entries(stageSprites)) {
    const s = sc.source || {}
    if (!s.char || !s.batch || !s.i3) continue
    out.add(`${s.char}_${s.batch}_${s.i3}`)
  }
  return [...out].sort()
}

function main() {
  const write = process.argv.includes('--write')
  const mani = readJSON(MANIFEST)
  const sprites = readJSON(STAGE_SPRITES)
  const fallback = readDefaultFallback()

  // scene id 全集来自 manifest.scenes（含 B1~B6）
  const sceneIds = Object.keys(mani.scenes || {})
  const before = {
    total: Object.values(mani.expressions || {}).reduce(
      (n, e) => n + Object.values(e.slots || {}).reduce((x, y) => x + y.length, 0), 0),
    bases: (mani.spriteBases || []).length,
  }

  const expressions = {}
  for (const sid of sceneIds) {
    const fromStage = sprites[sid]
    if (fromStage) {
      expressions[sid] = {
        slots: fromStage.slots || {},
        fallback,
        spriteSide: SPRITE_SIDE_LEFT.has(sid) ? 'left' : 'right',
      }
      if (fromStage.source) expressions[sid].stageSource = fromStage.source
    } else {
      // B 类景：只提供背景，无立绘（实测 slots 为 0）
      expressions[sid] = { slots: {}, fallback, spriteSide: 'right' }
      if (mani.expressions?.[sid]?.stageSource) {
        expressions[sid].stageSource = mani.expressions[sid].stageSource
      }
    }
  }

  const spriteBases = basesFrom(null, sprites)
  const after = {
    total: Object.values(expressions).reduce(
      (n, e) => n + Object.values(e.slots || {}).reduce((x, y) => x + y.length, 0), 0),
    bases: spriteBases.length,
  }

  console.log('=== 重建前后的立绘表 ===')
  console.log(`  slots 图片引用总数 : ${before.total}  →  ${after.total}`)
  console.log(`  spriteBases 条数   : ${before.bases}  →  ${after.bases}`)
  console.log('  spriteBases        :', spriteBases.join('  '))
  console.log('\n=== 逐景 ===')
  for (const sid of sceneIds) {
    const e = expressions[sid]
    const n = Object.values(e.slots).reduce((a, b) => a + b.length, 0)
    console.log(`  ${sid.padEnd(3)} side=${String(e.spriteSide).padEnd(5)} 槽位 ${String(Object.keys(e.slots).length).padStart(2)}  图 ${String(n).padStart(3)}`
      + (e.stageSource ? `  src=${e.stageSource.char}_${e.stageSource.batch}_${e.stageSource.i3}` : ''))
  }

  // 词表必须一字不动 —— 这是本脚本的安全边界
  const lx = (o) => Object.values(o).reduce((a, l) => a + (Array.isArray(l) ? l.length : 0), 0)
  console.log('\n=== 不动的字段（抽样核对）===')
  console.log('  lexicon =', lx(mani.lexicon), ' byChar =',
    Object.entries(mani.lexiconByCharacter).map(([k, v]) => `${k}=${lx(v)}`).join(' '))

  if (!write) {
    console.log('\n（试跑：加 --write 才写盘；写盘前会自动备份 manifest.json → manifest.json.bak2）')
    return 0
  }

  const bak = MANIFEST + '.bak2'
  fs.copyFileSync(MANIFEST, bak)
  console.log('\n已备份 →', path.relative(ROOT, bak))

  mani.expressions = expressions
  mani.spriteBases = spriteBases
  fs.writeFileSync(MANIFEST, JSON.stringify(mani, null, 1), 'utf8')
  console.log('已写回 →', path.relative(ROOT, MANIFEST))
  return 0
}

process.exit(main())

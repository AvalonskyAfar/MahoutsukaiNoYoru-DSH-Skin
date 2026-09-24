#!/usr/bin/env node
/**
 * dsh-skin-mahoyo · 打包「无素材源码分发版」
 * ------------------------------------------------------------------
 * 与 `pack-dist.mjs` 是**两个不同产物**，别混：
 *   · `pack-dist.mjs`          → npm 包（素材随包，262 MiB），给"想直接装上用"的人
 *   · `pack-source-dist.mjs`   → 本脚本，**源码工作区**（不含任何原作素材），
 *                                给"有原著、要自己接素材"的人
 *
 * 为什么是「源码工作区」而不是 npm 包：
 *   `ASSET-RECOVERY.md` 里所有命令都是**相对工作区根**写的
 *   （`python skin/tools/crop_alpha.py`、`python hfa_tools/hw_to_ogg.py` …）。
 *   打成 npm 包（只有 lib/ data/ assets/）的话，照着文档跑会全部找不到文件。
 *   所以这一版必须是**能直接开工的目录树**，且同级放着 hfa_tools/ 与 persona_work/。
 *
 * 用法：
 *   node skin/tools/pack-source-dist.mjs                # 输出到 <仓库根>/release/
 *   node skin/tools/pack-source-dist.mjs --dry          # 只报告会收什么
 *   node skin/tools/pack-source-dist.mjs --out D:\x     # 指定输出目录
 *
 * 产物落到仓库根的 `release/`（2026-09-23 从 `skin/dist/` 挪出来）——
 * 发布物别再和源码堆在一起，那里同时也放带素材的 .tgz。
 *
 * ⚠ 维护提醒：本文件**刻意只用单引号字符串拼接**，不用模板字符串。
 *   原因：要往 Python 片段和 markdown 里写反引号，模板串会与它们打架
 *   （实测踩过两次：一次漏转义 → SyntaxError，一次把 `\n` 写成了真换行
 *    → 整份文件"输入意外结束"）。拼接啰嗦，但不会再坏。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')
const ROOT = path.resolve(SKIN, '..')

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(ROOT, 'release')

const PKG = JSON.parse(fs.readFileSync(path.join(SKIN, 'package.json'), 'utf8'))
const NL = String.fromCharCode(10)
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const NAME = PKG.name + '-' + PKG.version + '-source-noassets-' + STAMP

function step(m) { console.log('== ' + m) }
function fmt(b) {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MiB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KiB'
  return b + ' B'
}
/** 跑一段 Python（lines 是源码行数组，拼成 \n 传入）。 */
function runPy(lines, extraArgs) {
  return execFileSync('python', ['-c', lines.join(NL)].concat(extraArgs || []),
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// ---------------------------------------------------------------------------
// 收取规则
// ---------------------------------------------------------------------------
/* 每一项 = [工作区下的相对路径, 说明, 过滤器?]
   过滤器返回 true 表示**要**（不传 = 全收）。 */
const INCLUDE = [
  /* 仓库根的那几份：GitHub 主页、协议、界面样图。
     2026-09-23 补 —— 之前没收，打出来的包里没有 README/LICENSE，
     拿到包的人看不到项目说明。 */
  ['README.md', '项目主页（GitHub 面向）', null],
  ['LICENSE', 'MIT（含第三方素材归属声明）', null],
  ['screenshots', '界面样图', null],

  ['skin/ASSET-RECOVERY.md', '素材重建指南（核心）', null],
  ['skin/lib', '皮肤两个半边', null],
  ['skin/data', 'manifest + 人格切片', null],
  ['skin/tools', '检查脚本 + 裁边/切片工具', null],
  ['skin/preview', '离线预览页', null],
  ['skin/package.json', '包元数据', null],
  ['skin/cordis.patch.yml', 'DSH 注册补丁', null],
  ['skin/README.md', '皮肤自述', null],
  ['hfa_tools', '原著解包工具链', (f) => f.indexOf('__pycache__') < 0],
  ['persona_work/tools', '立绘合成 / 音频导出', (f) => f.indexOf('__pycache__') < 0],
  /* stage 里还有 _dbg_*.jpg / eyefix_*.jpg 调试图（约 7 MB），
     重建只需要 json，文档也不需要那些图。 */
  ['persona_work/stage', '立绘配方 json', (f) => /\.(json|md)$/i.test(f)],
  ['bgm', 'BGM 映射表（无 .ogg）', (f) => !/\.(ogg|wav|mp4)$/i.test(f)],
  ['recovery', '急救脚本（无 backups/）', (f) =>
    f.indexOf(path.sep + 'backups' + path.sep) < 0 && !/client\.js\.bak/.test(f)],
  /* 人格 skill pack。2026-09-23 补 —— 之前没收，而根 README 的 §8
     链了 `personas/`，装进包里会是一条死链。 */
  ['personas', '人格 skill pack（17 维度 + 证据索引）', (f) =>
    f.indexOf('__pycache__') < 0],
  ['docs', '维护手册 / 未决事项', null],
]

/* 有意**不**收的内部工作文档（2026-09-23 用户决定）。
   它们同时被 `.gitignore` 排除 —— 因为本脚本的产物是 **GitHub Release 附件**，
   同样是公开的。只排仓库不排这里，等于没排。 */
const NOTE_INTERNAL = [
  ['HANDOFF.md', '会话交接 —— 制作期过程记录'],
  ['DELIVERY.md', '交付物 A 说明'],
  ['ACCEPTANCE-REVIEW.md', '独立验收记录'],
  ['dsh-skin-plugin-research.md', '早期离线调研（47 KB）'],
]

/* 有意排除的大件（列出来是为了让报告说清"省了什么"）。 */
const NOTE_EXCLUDED = [
  ['skin/assets', '全部原作素材 —— 由 ASSET-RECOVERY.md 指导重建'],
  ['hfa_png', '解包产物（13 GB / 24284 张）—— 路线 A 的输入'],
  ['persona_work/{tmp,audio,scene,expressions,catalog,agg,shards,out}', '过程证据，与重建无关'],
  ['recovery/backups', '156 MB 配置快照，与移机无关'],
  ['bgm/wav, bgm/op_mp4', '中间产物'],
  ['node_modules', '与皮肤运行时无关'],
  ['WITCH ON THE HOLY NIGHT.7z', '原著本体（版权归 TYPE-MOON，且用户自己有）'],
]

// ---------------------------------------------------------------------------
// 0. dry-run
// ---------------------------------------------------------------------------
const STAGE = path.join(OUT, NAME)

if (DRY) {
  step('--dry：将收进 ' + NAME + '/')
  let total = 0
  let count = 0
  for (const [rel, why, filter] of INCLUDE) {
    const abs = path.join(ROOT, rel)
    if (!fs.existsSync(abs)) { console.log('   ⚠ 不存在，跳过：' + rel); continue }
    const st = fs.statSync(abs)
    let n = 1
    let b = st.size
    if (st.isDirectory()) {
      n = 0
      b = 0
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name)
          if (e.isDirectory()) walk(p)
          else if (!filter || filter(p)) { n++; b += fs.statSync(p).size }
        }
      }
      walk(abs)
    }
    total += b
    count += n
    console.log('   ' + rel.padEnd(34) + String(n).padStart(5) + ' 个  ' + fmt(b).padStart(9) + '  —— ' + why)
  }
  console.log('   ' + '合计'.padEnd(34) + String(count).padStart(5) + ' 个  ' + fmt(total).padStart(9))
  console.log('')
  console.log('   不含（有意排除）：')
  for (const pair of NOTE_EXCLUDED) console.log('     · ' + pair[0] + ' — ' + pair[1])
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 1. 暂存
// ---------------------------------------------------------------------------
step('暂存文件')
fs.rmSync(STAGE, { recursive: true, force: true })
fs.mkdirSync(STAGE, { recursive: true })

let copied = 0
let bytes = 0

function copyFile(rel) {
  const src = path.join(ROOT, rel)
  const dst = path.join(STAGE, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  copied++
  bytes += fs.statSync(src).size
}
function copyDir(rel, filter) {
  const src = path.join(ROOT, rel)
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const r = path.join(rel, e.name)
    if (e.isDirectory()) copyDir(r, filter)
    else if (!filter || filter(path.join(ROOT, r))) copyFile(r)
  }
}

for (const entry of INCLUDE) {
  const rel = entry[0]
  const why = entry[1]
  const filter = entry[2]
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) { console.log('   ⚠ 跳过（不存在）：' + rel); continue }
  if (fs.statSync(abs).isDirectory()) copyDir(rel, filter)
  else copyFile(rel)
  console.log('   ' + rel.padEnd(34) + ' —— ' + why)
}

// ---------------------------------------------------------------------------
// 2. 空 assets/ 骨架
// ---------------------------------------------------------------------------
/* 为什么要建**空目录 + .gitkeep**：
   `install.ps1` 会整目录拷 `assets/`；目录不存在它只打印"跳过（不存在）"，
   装出来的插件在浏览器里请求素材会 404，而且看不出原因。
   先把五个子目录摆好，接素材时直接往里填即可。 */
for (const sub of ['bg', 'bgm', 'se', 'sprite', 'ui/conf']) {
  const d = path.join(STAGE, 'skin', 'assets', sub)
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, '.gitkeep'), '')
}
const assetsReadme = [
  '# 这里是空的 —— 素材要你自己接',
  '',
  '本分发包**不含**任何原作图像与 BGM（版权属于 TYPE-MOON）。',
  '',
  '**怎么把素材接回来：读 [`../ASSET-RECOVERY.md`](../ASSET-RECOVERY.md)。**',
  '',
  '接完之后本目录应有：',
  '',
  '| 子目录 | 文件数 |',
  '|---|---:|',
  '| `bg/` | 13 |',
  '| `bgm/` | 16 |',
  '| `se/` | 7 |',
  '| `sprite/` | 136 |',
  '| `ui/`（含 `ui/conf/` 80） | 128 |',
  '| **合计** | **380 / 263.2 MiB** |',
  '',
  '`.gitkeep` 只是为了让空目录能被收进压缩包，接素材时可以删掉。',
  '',
].join(NL)
fs.writeFileSync(path.join(STAGE, 'skin', 'assets', 'README.md'), assetsReadme)
copied++
bytes += Buffer.byteLength(assetsReadme)

// ---------------------------------------------------------------------------
// 3. README-FIRST.md：从**真实文件**拷，只替换两个占位符
// ---------------------------------------------------------------------------
/* 为什么不内嵌在这里：markdown 里到处是行内代码围栏（反引号），
   嵌进脚本会互相打架。做成真实文件还有个好处 ——
   **它是可编辑的文档**，改文案不用碰脚本逻辑。 */
{
  const src = path.join(SKIN, 'README-FIRST.md')
  if (!fs.existsSync(src)) {
    console.error('✗ 缺少 skin/README-FIRST.md（它是打包的**输入**，不是产物）')
    process.exit(1)
  }
  const text = fs.readFileSync(src, 'utf8')
    .split('{{VERSION}}').join(PKG.name + '@' + PKG.version)
    .split('{{DATE}}').join(new Date().toISOString().slice(0, 10))
  fs.writeFileSync(path.join(STAGE, 'README-FIRST.md'), text)
  copied++
  bytes += Buffer.byteLength(text)
  console.log('   README-FIRST.md'.padEnd(34) + ' —— 由 skin/README-FIRST.md 生成')
}

// ---------------------------------------------------------------------------
// 4. 压缩
// ---------------------------------------------------------------------------
/* 用 Python 的 zipfile 而不是 tar.gz：
   收件人大概率在 Windows 上，`.zip` 双击即开。Python 是这条链本来就要求的
   依赖（crop_alpha.py 等都要它），不算新增。 */
step('压缩 -> ' + NAME + '.zip')
const zipPath = path.join(OUT, NAME + '.zip')
try {
  fs.rmSync(zipPath, { force: true })
  runPy([
    'import os, sys, zipfile',
    'stage, out = sys.argv[1], sys.argv[2]',
    'base = os.path.dirname(stage)',
    "with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:",
    '    for root, dirs, files in os.walk(stage):',
    '        for f in files:',
    '            full = os.path.join(root, f)',
    '            z.write(full, os.path.relpath(full, base))',
    "print('ok')",
  ], [STAGE, zipPath])
} catch (err) {
  console.error('✗ 压缩失败：')
  console.error(String((err && (err.stderr || err.message)) || err))
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 5. 校验 + 清理
// ---------------------------------------------------------------------------
step('校验产物')
console.log('   ' + path.basename(zipPath))
console.log('   ' + fmt(fs.statSync(zipPath).size) + '（暂存 ' + fmt(bytes) + ' / ' + copied + ' 个文件）')

/* 断言产物里**没有**素材 —— 这是本脚本存在的意义，必须机器化，不能靠人看。 */
let entries = []
try {
  entries = runPy([
    'import sys, zipfile',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    '    for n in z.namelist():',
    '        print(n)',
  ], [zipPath]).split(NL).filter(Boolean)
} catch (err) {
  console.error('✗ 读取产物条目失败：' + String((err && err.message) || err))
  process.exit(1)
}

const leaked = entries.filter(function (n) {
  return /\/assets\/(bg|bgm|se|sprite|ui)\/[^/]+\.(png|ogg|jpe?g|mp4)$/i.test(n)
})
if (leaked.length) {
  console.error('')
  console.error('✗ 产物里有 ' + leaked.length + ' 个素材文件泄漏！样例：')
  leaked.slice(0, 5).forEach(function (n) { console.error('   ' + n) })
  process.exit(1)
}
console.log('   ✓ 无素材泄漏（共 ' + entries.length + ' 个条目；assets/ 下只有 .gitkeep 与 README.md）')

fs.rmSync(STAGE, { recursive: true, force: true })

step('完成')
console.log('   ' + zipPath)
console.log('')
console.log('   拿到这个包的人：解压 → 读 README-FIRST.md → 读 skin/ASSET-RECOVERY.md')
console.log('   → 改 hfa_tools/hfa.py:16 的 GAME → 接素材 → install.ps1')

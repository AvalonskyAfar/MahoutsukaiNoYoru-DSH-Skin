#!/usr/bin/env node
/**
 * dsh-skin-mahoyo · 打包分发
 * ------------------------------------------------------------------
 * 产出一个可直接分发的 `dsh-skin-mahoyo-<version>.tgz`，内容按 package.json
 * 的 `files` 白名单：
 *
 *   package.json   cordis.patch.yml   README.md
 *   lib/           (client.js + index.js)
 *   data/          (manifest.json + personas/*.md)
 *   assets/        (380 个素材，263.2 MiB)
 *
 * ------------------------------------------------------------------
 * 为什么用 `npm pack` 而不是自己 zip：
 *   `files` 白名单是 npm 的原生语义，`npm pack` 已经处理了白名单展开、
 *   嵌套 node_modules 剔除、`.npmignore` 之类的边界。自己实现一遍只会更脆。
 *   本脚本负责的是 pack **前后**的校验与摆放。
 *
 * 为什么桌面端 `npm pack` 不跟随 junction：
 *   装机时 install.ps1 会在插件目录里建 `node_modules/@deepseek-ai/schemastery`
 *   的 junction。那是**装机产物**，不属于分发包。（本脚本跑在源码目录，
 *   源码目录里本来也没有 node_modules —— 真要有也会被 files 白名单排除。）
 *
 * 用法：
 *   node skin/tools/pack-dist.mjs                  # 打包到 <仓库根>/release/
 *   node skin/tools/pack-dist.mjs --out D:\x      # 指定输出目录
 *   node skin/tools/pack-dist.mjs --dry            # 只报告将打进什么，不写盘
 *
 * 产物落到仓库根的 `release/`（2026-09-23 从 `skin/dist/` 挪出来）——
 * 与 `pack-source-dist.mjs` 的产物放在一起，发布物不再和源码混着。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(SKIN, '..', 'release')

function step(m) { console.log('== ' + m) }
function fmt(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MiB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KiB'
  return bytes + ' B'
}

// ---------------------------------------------------------------------------
// 1. 读包元数据 + 校验白名单
// ---------------------------------------------------------------------------
const PKG = JSON.parse(fs.readFileSync(path.join(SKIN, 'package.json'), 'utf8'))
step(`打包 ${PKG.name}@${PKG.version}`)

const files = PKG.files || []
if (!files.length) {
  console.error('✗ package.json 没有 files 白名单，拒绝打包（会收进整棵源码树）')
  process.exit(1)
}

// package.json 不需要列在 files 里 —— npm 永远会收它，列不列都一样。
const REQUIRED = ['cordis.patch.yml', 'lib/', 'data/', 'assets/', 'README.md']
for (const need of REQUIRED) {
  const bare = need.replace(/\/$/, '')
  if (!files.includes(need) && !files.includes(bare)) {
    console.error(`  ⚠ files 白名单里没有 ${need}`)
  }
}

// ---------------------------------------------------------------------------
// 2. 拦截已作废的产物 / 不该进包的东西
// ---------------------------------------------------------------------------
/* manifest.json.bak 与 prettrim 备份是**工作区**的东西，不该跟着分发。
   files 白名单写的是 `data/` 整目录，所以它们会被卷进去 —— 这里显式拦。 */
const BANNED = [
  ['data/manifest.json.bak', 'manifest 回滚备份（rebuild-lexicon.mjs 用）'],
  ['data/manifest.json.pretrim-20260923', '修剪 manifest 前的一次性备份'],
  ['data/assets-index.json', '过期索引（444 条 vs 磁盘 380 个，见审计）'],
]
const hits = []
for (const [rel, why] of BANNED) {
  if (fs.existsSync(path.join(SKIN, rel))) hits.push(`  · data/${path.basename(rel)} — ${why}`)
}
if (hits.length) {
  console.error('')
  console.error('✗ 发现不该进分发包的 data/ 文件。请先移走或删除：')
  console.error(hits.join('\n'))
  console.error('')
  console.error('  这些是工作区文件，不是运行时依赖。分发包应当只带 manifest.json + personas/。')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 3. 素材计数（只为报告）
// ---------------------------------------------------------------------------
const assetsDir = path.join(SKIN, 'assets')
let assetCount = 0
let assetBytes = 0
if (fs.existsSync(assetsDir)) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else { assetCount++; assetBytes += fs.statSync(p).size }
    }
  }
  walk(assetsDir)
}
console.log(`   素材：${assetCount} 个文件 / ${fmt(assetBytes)}`)

// ---------------------------------------------------------------------------
// 4. 跑 npm pack
// ---------------------------------------------------------------------------
if (DRY) {
  step('--dry：不写盘。白名单内容如下')
  console.log('   ' + files.join('\n   '))
  console.log('')
  console.log('   实际收什么请跑一次不带 --dry 的，看 npm pack 的输出清单。')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
step(`npm pack -> ${OUT}`)

let tgz
try {
  /* 调用方式与 Node 版本强相关，这里说清楚为什么是这么写的：
       · 不能 `execFileSync('npm', …, {shell:true})` —— 参数未经转义被拼接，
         Node 24 已对这个组合发 DEP0190 弃用警告。
       · 也不能 `execFileSync('npm.cmd', …, {shell:false})` —— Node 修掉 CVE-2024-27980
         后，Windows 上直接 spawn .cmd/.bat 会抛 EINVAL。
     所以显式经 cmd.exe 走一层：`cmd.exe /d /s /c "<命令>"`。
     传的是固定字符串、无用户输入，且 OUT 会被引号包住，无注入面。 */
  /* --pack-destination 必须传**相对 cwd 的路径**：npm 会把它再拼到 cwd 上，
     传绝对路径会拼成 cwd + 绝对路径（实测 ENOENT）。相对路径里也不许加引号 ——
     shell 不剥引号时会当字面字符，路径变成 `"dist"`（也实测过）。 */
  const destRel = path.relative(SKIN, OUT) || '.'
  if (/\s/.test(destRel)) {
    console.error('✗ 输出目录名含空格，npm --pack-destination 无法安全表达。')
    console.error('  请用 --out 指向一个不含空格的目录。')
    process.exit(1)
  }
  const npmCmd = ['npm', 'pack', '--pack-destination', destRel, '--json'].join(' ')
  const out = process.platform === 'win32'
    ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', npmCmd], {
        cwd: SKIN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      })
    : execFileSync('npm', ['pack', '--pack-destination', destRel, '--json'], {
        cwd: SKIN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      })
  const meta = JSON.parse(out)
  tgz = path.join(OUT, meta[0].filename)
  console.log(`   产物：${meta[0].filename}`)
  console.log(`   洗后体积：${fmt(meta[0].size)}（解包 ${fmt(meta[0].unpackedSize)}，${meta[0].entryCount} 个条目）`)
} catch (err) {
  console.error('✗ npm pack 失败：')
  console.error(String(err.stderr || err.message || err))
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 5. 校验产物真的带了 assets/
// ---------------------------------------------------------------------------
step('校验产物')
const size = fs.statSync(tgz).size
if (size < 200 * 1024 * 1024) {
  console.error(`   ⚠ 产物只有 ${fmt(size)}，远小于预期的 ~265 MiB —— assets/ 可能没进包。`)
  console.error('     检查 package.json 的 files 是否含 "assets/"，以及 assets/ 下是否真有文件。')
  process.exit(1)
}
console.log(`   ✓ 体积 ${fmt(size)}，符合"素材随包"预期`)

step('完成')
console.log(`   ${tgz}`)
console.log('')
console.log('   拿到这个包的人：解包 → pwsh -File tools\\install.ps1（tools 不在包里，')
console.log('   所以实际是：解包到 $DSH_HOME\\profiles\\web\\node_modules\\dsh-skin-mahoyo\\')
console.log('   → 把 "dsh-skin-mahoyo" 加进 profiles/web/package.json 的 dsh.profile.bundles')
console.log('   → 在包里建 node_modules/@deepseek-ai/schemastery 指到 profile 的那份 → 重启 DSH。')
console.log('   （install.ps1 做的就是这些；它随**源码工作区**分发，不随 npm 包。）')

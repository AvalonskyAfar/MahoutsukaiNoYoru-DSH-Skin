#!/usr/bin/env node
/**
 * 离线复现 dsh-client-modules 的 combo URL 算法。
 *
 * 目的：**不依赖浏览器**验证「某些客户端 bundle 到底有没有被下发」。
 * 原理：combo 的 rev 是内容哈希（`framedHash("combo", [sourceBytes, sourceMap])`），
 * 完全由 bundle 字节决定，所以可以在本机算出来，然后直接去 GET。
 *
 * 用法：
 *   node skin/tools/verify-bundles.mjs                  # 算 dev-server 上的 URL 并探测
 *   node skin/tools/verify-bundles.mjs --base http://127.0.0.1:3080
 *   node skin/tools/verify-bundles.mjs --json           # 只输出 JSON
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')

/**
 * 枚举 npx 缓存里的 node_modules 根。
 * DSH 经 `npx` 启动时，其依赖装在 `_npx/<hash>/node_modules`，而 `<hash>` 由
 * npx 依包名算出、逐机不同（旧版本这里写死了本机那一个，换机即失效）。
 * 所以这里枚举全部 _npx 子目录，而不是猜 hash。
 * @returns {string[]} 存在的 node_modules 目录，可能为空
 */
function npxModuleRoots() {
  const local = process.env.LOCALAPPDATA || process.env.TMPDIR || ''
  if (!local) return []
  const base = path.join(local, 'npm-cache', '_npx')
  let dirs
  try {
    dirs = fs.readdirSync(base, { withFileTypes: true })
  } catch {
    return []                               // 没有 npx 缓存：正常
  }
  return dirs
    .filter((d) => d.isDirectory())
    .map((d) => path.join(base, d.name, 'node_modules'))
    .filter((p) => fs.existsSync(p))
}

const args = process.argv.slice(2)
const BASE = (() => {
  const i = args.indexOf('--base')
  return i >= 0 ? args[i + 1] : 'http://127.0.0.1:3080'
})()
const JSON_ONLY = args.includes('--json')

const HASH_LEN = 12
const SOURCE_MAP_TRAILER = /(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/
const SOURCE_URL_TRAILER = /(?:\r?\n)?\/\/# sourceURL=([^\r\n]+)(?:\r?\n)?$/

/** 与 dsh-client-modules 的 framedHash 完全一致。 */
function framedHash(domain, parts) {
  const h = crypto.createHash('sha1').update(domain).update('\0')
  for (const p of parts) h.update(String(p.byteLength) + ':').update(p)
  return h.digest('hex').slice(0, HASH_LEN)
}

/** 与 dsh-client-modules 的 comboSource 一致。 */
function comboSource(bundleBytes) {
  let source = bundleBytes.toString('utf8')
  const sourceUrl = SOURCE_URL_TRAILER.exec(source)?.[1]
  source = source.replace(SOURCE_URL_TRAILER, '').replace(SOURCE_MAP_TRAILER, '')
  if (!source.endsWith('\n')) source += '\n'
  const fallbackSource = sourceUrl === undefined
    ? `/plugins/${'<id>'}/client.js`
    : /^(?:[A-Za-z][A-Za-z\d+.-]*:|\/)/.test(sourceUrl) ? sourceUrl : `/${sourceUrl}`
  return { source, fallbackSource }
}

/** 与 dsh-client-modules 的 identitySectionMap 近似（DSH 对无 map 的 bundle 用 identity）。 */
function identitySectionMap(source, fallbackSource) {
  const lines = source.split('\n')
  return {
    version: 3,
    sources: [fallbackSource],
    names: [],
    mappings: lines.map(() => 'AAAA').join(';'),
  }
}

/**
 * 复现 buildCombo(records) —— 单条或多条 record 都行。
 * @param {{id: string, bundle: Buffer, sourceMap?: {body: Buffer}}[]} records
 */
function buildCombo(records) {
  let source = ''
  const sections = []
  let line = 0
  for (const record of records) {
    const prepared = comboSource(record.bundle)
    const section = record.sourceMap === undefined
      ? identitySectionMap(prepared.source, prepared.fallbackSource.replace('<id>', record.id))
      : JSON.parse(record.sourceMap.body.toString('utf8'))
    sections.push({ offset: { line, column: 0 }, map: section })
    const bundle = `${prepared.source};\n`
    source += bundle
    line += (bundle.match(/\n/g) || []).length
  }
  const sourceMap = Buffer.from(JSON.stringify({ version: 3, file: 'client.js', sections }) + '\n')
  const sourceBytes = Buffer.from(source)
  const rev = framedHash('combo', [sourceBytes, sourceMap])
  const entries = records.map((r) => r.id)
  const comboUrl = (ids, r, map = false) =>
    `/plugins/??${ids.map((id) => `${id}/client.js${map ? '.map' : ''}`).join(',')}&rev=${r}`
  return { url: comboUrl(entries, rev), rev, entries }
}

/** artifactRevision（单 record 不带 sourceMap 时的 rev）。 */
function artifactRevision(bundle, sourceMap) {
  return framedHash('plugin-artifact', sourceMap === undefined ? [bundle] : [bundle, sourceMap.body])
}

// ---------------------------------------------------------------------------
// 收集所有声明了 dsh.client 的包
// ---------------------------------------------------------------------------
function collectPackages() {
  /* 根目录来源（按优先级），不再写死本机路径 —— 换机/换用户名也能跑：
     1. $DSH_HOME/profiles/web/node_modules   （DSH_HOME 未设时退回 ~/.dsh）
     2. $DSH_HOME/node_modules
     3. npx 缓存里的 _npx/<hash>/node_modules （DSH 经 npx 启动时依赖在此；
        hash 由 npx 依包名算出，逐机不同，所以用枚举而非写死） */
  const home = process.env.DSH_HOME
    || path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh')
  const roots = [
    path.join(home, 'profiles', 'web', 'node_modules'),
    path.join(home, 'node_modules'),
    ...npxModuleRoots(),
  ]
  const out = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue
      if (d.name.startsWith('@')) {
        for (const s of fs.readdirSync(path.join(root, d.name), { withFileTypes: true })) {
          push(path.join(root, d.name, s.name))
        }
      } else push(path.join(root, d.name))
    }
  }
  function push(dir) {
    const pj = path.join(dir, 'package.json')
    if (!fs.existsSync(pj)) return
    let pkg
    try { pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) } catch { return }
    const decl = pkg.dsh && pkg.dsh.client
    if (!decl || decl.platform !== 'web') return
    const c = pkg.exports && pkg.exports['./client']
    const rel = typeof c === 'string' ? c : (c && c.default)
    if (!rel) return
    const clientPath = path.join(dir, rel)
    if (!fs.existsSync(clientPath)) return
    if (out.some((o) => o.id === pkg.name)) return
    const mapPath = clientPath + '.map'
    out.push({
      id: pkg.name,
      dir,
      clientPath,
      bundle: fs.readFileSync(clientPath),
      sourceMap: fs.existsSync(mapPath) ? { body: fs.readFileSync(mapPath) } : undefined,
      self: pkg.name === 'dsh-skin-mahoyo',
    })
  }
  return out
}

const pkgs = collectPackages()
const self = pkgs.find((p) => p.self)

const lines = []
lines.push(`扫描到 ${pkgs.length} 个声明 dsh.client 的包`)
if (!self) {
  lines.push('✗ **没找到 dsh-skin-mahoyo**')
} else {
  lines.push(`本皮肤: ${self.clientPath}`)
  lines.push(`  bundle ${self.bundle.length} 字节, sourceMap ${self.sourceMap ? '有' : '无'}`)
}

// 单 record 的 artifact rev（rebuilt() 用这个）
if (self) {
  lines.push(`  单条 artifactRevision = ${artifactRevision(self.bundle, self.sourceMap)}`)
}

// 单 record 的 combo URL（responses 表里一定有这条）
const single = self ? buildCombo([self]) : null
// 全量 combo（如果 application 只有一个批次，就是它）
const all = buildCombo(pkgs)

const result = {
  count: pkgs.length,
  self: self ? { id: self.id, bytes: self.bundle.length, hasMap: !!self.sourceMap } : null,
  singleComboUrl: single ? single.url : null,
  allComboUrl: all.url,
}

if (JSON_ONLY) {
  console.log(JSON.stringify(result, null, 1))
  process.exit(0)
}

for (const l of lines) console.log(l)
console.log('')
console.log('单条 combo URL:')
console.log('  ' + (single ? single.url : '(无)'))
console.log('全量 combo URL:')
console.log('  ' + all.url)
console.log('')

// ---------------------------------------------------------------------------
// 探测
// ---------------------------------------------------------------------------
const targets = []
if (single) targets.push(['单条·皮肤', single.url])
targets.push(['全量', all.url])

console.log(`探测 ${BASE} ...`)
for (const [label, url] of targets) {
  try {
    const res = await fetch(BASE + url, { method: 'GET' })
    const body = await res.text()
    const isSelf = body.includes("id: 'dsh-skin-mahoyo'") || body.includes('dsh-skin-mahoyo')
    console.log(`  ${label}: ${res.status}  ${body.length} 字节  含皮肤=${isSelf ? '是' : '否'}`)
  } catch (err) {
    console.log(`  ${label}: 请求失败 ${err.message}`)
  }
}

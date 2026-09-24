/**
 * dsh-skin-mahoyo —— 《魔法使之夜》DSH 皮肤 · 宿主半边
 * ==========================================================================
 * 只做三件事（其余全在浏览器半边 lib/client.js）：
 *
 *   1. **素材静态路由** `/moye-skin/*`
 *      - `GET /moye-skin/manifest.json` → 皮肤运行时清单（景 / 表情 / 词典 / 曲目）
 *      - `GET /moye-skin/settings`      → 设置读写桥（loopback-only）
 *      - `GET /moye-skin/assets/<相对路径>` → 原作素材原图（PNG / OGG / ...）
 *
 *   2. **设置持久化** `ctx.settings.register('moye-skin', …)`
 *      → 落进 `$DSH_HOME/settings.yaml`
 *
 *   3. **人格注入** `ctx.systemPrompt.section({…})`
 *      → 每个模型回合把当前角色的 `soul/injection.md` 注入系统提示词。
 *
 * ==========================================================================
 * ★★ 为什么这个文件写得这么"怂"（每一层都 try/catch + 逐项降级）
 * ==========================================================================
 * 实测（本机 0.1.5-rc.1）：
 *
 *   - profile 的 bundle **解析不到** → **整个 profile 起不来**
 *     `dsh web --dump-config` → exit 1：
 *     `cannot resolve profile bundle "…" from the dsh installation or <profileDir>`
 *     → 这就是"装了皮肤之后 DSH 再也进不去"的真实成因。**代码层面无法兜住**，
 *       只能靠 tools/guard.ps1 的启动前预检 + 一键回滚。
 *
 *   - `insert.name` 解析不到 → 只影响那一条，不 abort（dump-config 仍 exit 0）。
 *
 *   - 插件 `apply()` 抛错 → 由 cordis 的 loader 处理，**不能假设它一定不致命**。
 *     所以本文件：
 *       · `apply()` 整体包在 try/catch 里，任何异常都不向上抛
 *       · 三个子系统各自独立 try/catch（一块坏了不影响另两块）
 *       · 设置用 **宽松 schema + 代码内白名单归一化**（存了脏值也不会注册失败）
 *       · 支持 **安全模式**（SAFE_MODE 文件 / 环境变量），命中即完全不注册任何东西
 *
 * 换句话说：**这一半只可能"少干活"，不可能"把 DSH 弄挂"。**
 *
 * 版权：原作美术／音频版权归 TYPE-MOON / 奈须蘑菇 / 小山广和。
 *      本包依 MIT 发布**代码**；素材随包分发由使用者自行决定并自担责任，见 README。
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(__dirname, '..')

/** 静态路由前缀（浏览器半边写死同名前缀）。 */
export const ROUTE_BASE = '/moye-skin'
/** 配置命名空间。 */
export const SETTINGS_NS = 'moye-skin'
/** 注入段的 name —— **固定不变**，靠替换 text 完成角色切换，杜绝残留。 */
export const PROMPT_SECTION = 'skin:mahoyo:persona'

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

/**
 * 角色 id → 中文名。
 * 用简体写法，与 lib/client.js 的 CHARACTER_CN 和 data/personas/*.md 一致
 * （2026-09-22 统一简体；旧的繁体写法已随 manifest.characters 一并移除）。
 */
const CHARACTER_LABELS = { aoko: '苍崎青子', alice: '久远寺有珠', kumari: '久万梨金鹿' }
const CHARACTER_IDS = ['aoko', 'alice', 'kumari']

/** 设置项白名单与默认值（代码内归一化，schema 只负责"能存下来"）。 */
const DEFAULTS = {
  character: 'aoko',
  enabled: true,
  showSprite: true,
  showDialogue: true,
  hideTabs: true,
  autoCollapse: true,
  bgm: true,
  bgmVolume: 0.35,
  sfx: true,
  sfxVolume: 0.5,
  persona: true,
  easterEgg: true,
  edThreshold: 0.78,
  assetRoot: '',
}

/**
 * 归一化设置值：任何脏值都退回默认，**永不抛**。
 * @param {unknown} raw - 来自 settings.yaml 的原始值
 * @returns {typeof DEFAULTS} 干净的设置对象
 */
export function normalizeSettings(raw) {
  const out = Object.assign({}, DEFAULTS)
  if (!raw || typeof raw !== 'object') return out
  const bool = (v, d) => (typeof v === 'boolean' ? v : d)
  const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
  const str = (v, d) => (typeof v === 'string' ? v : d)
  if (CHARACTER_IDS.includes(raw.character)) out.character = raw.character
  out.enabled = bool(raw.enabled, out.enabled)
  out.showSprite = bool(raw.showSprite, out.showSprite)
  out.showDialogue = bool(raw.showDialogue, out.showDialogue)
  out.hideTabs = bool(raw.hideTabs, out.hideTabs)
  out.autoCollapse = bool(raw.autoCollapse, out.autoCollapse)
  out.bgm = bool(raw.bgm, out.bgm)
  out.bgmVolume = num(raw.bgmVolume, out.bgmVolume, 0, 1)
  out.sfx = bool(raw.sfx, out.sfx)
  out.sfxVolume = num(raw.sfxVolume, out.sfxVolume, 0, 1)
  out.persona = bool(raw.persona, out.persona)
  out.easterEgg = bool(raw.easterEgg, out.easterEgg)
  out.edThreshold = num(raw.edThreshold, out.edThreshold, 0.5, 1)
  out.assetRoot = str(raw.assetRoot, out.assetRoot)
  return out
}

/**
 * 安全模式判定：命中就**什么都不注册**，皮肤等同于没装。
 *
 * 三个入口（任一命中即可）：
 *   1. 环境变量 `MAHOYO_SAFE=1`
 *   2. `<包根>/SAFE_MODE` 文件存在（tools/guard.ps1 -SafeBoot 会建它）
 *   3. `<包根>/data/safe-mode.json` 里 `enabled: true`
 *
 * 这是"出事了也能一条命令救回来"的最后一道闸：
 * 它不需要 DSH 起来，也不需要改 YAML —— 只要那个文件在，插件就闭嘴。
 *
 * @returns {{safe: boolean, why: string}}
 */
export function safeMode() {
  if (process.env.MAHOYO_SAFE === '1' || process.env.MAHOYO_SAFE === 'true') {
    return { safe: true, why: 'env MAHOYO_SAFE' }
  }
  const flag = path.join(PKG_ROOT, 'SAFE_MODE')
  try {
    if (fs.statSync(flag).isFile()) return { safe: true, why: 'file SAFE_MODE' }
  } catch { /* 不存在就是没命中 */ }
  const json = path.join(PKG_ROOT, 'data', 'safe-mode.json')
  try {
    const v = JSON.parse(fs.readFileSync(json, 'utf8'))
    if (v && v.enabled === true) return { safe: true, why: 'data/safe-mode.json' }
  } catch { /* 读不到就是没命中 */ }
  return { safe: false, why: '' }
}

export const name = 'skin-mahoyo'
export const inject = ['webServer', 'settings', 'systemPrompt']

/** 解析素材根目录：设置项 → 环境变量 → 包内 assets/。永不抛。 */
function resolveAssetRoot(configured) {
  const candidates = []
  if (configured) candidates.push([configured, 'settings'])
  if (process.env.MAHOYO_ASSET_ROOT) candidates.push([process.env.MAHOYO_ASSET_ROOT, 'env'])
  candidates.push([path.join(PKG_ROOT, 'assets'), 'package'])
  for (const [dir, source] of candidates) {
    try {
      if (fs.statSync(dir).isDirectory()) return { root: dir, source }
    } catch { /* 继续找下一个 */ }
  }
  return { root: path.join(PKG_ROOT, 'assets'), source: 'package(missing)' }
}

function isLoopback(req) {
  const addr = (req.socket && req.socket.remoteAddress) || ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function sendJSON(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.statusCode = status
  res.setHeader('content-type', MIME['.json'])
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

function sendText(res, status, text) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.end(text)
}

async function readBody(req, limit = 256 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// ---------------------------------------------------------------------------
// 自检状态 —— 用来一眼定位"皮肤为什么没生效"。
//
//   clientSeen === false → 客户端 bundle **根本没到浏览器**（组合或下发问题）
//   clientSeen === true，界面没变 → 客户端跑起来了但注册/渲染被挡（看 clientErrors）
//
// 宿主自己也会独立扫一遍 loader 条目、复现 dsh-client-modules 的判断，
// 这样"包声明对不对"和"下发成不成"可以分开归因。
// ---------------------------------------------------------------------------
const diag = {
  hostStartedAt: new Date().toISOString(),
  clientSeen: false,
  clientFirstSeen: null,
  clientLastSeen: null,
  clientInfo: null,
  clientErrors: [],
  /** 浏览器调 __myhDebug() 回传的完整快照（DOM 实测状态）。 */
  debugSnapshot: null,
  /** 最近几次「渲染实况探针」——单独留存，避免被后续的 jsx 自检覆盖。 */
  probes: [],
  /** 最近一次 jsx 构造器自检（与探针分开存，互不覆盖）。 */
  jsxSelfTest: null,
}

/**
 * 宿主侧自查：枚举 loader 条目，找出声明 `dsh.client.platform === 'web'` 的包，
 * 并验证 `exports["./client"]` 指向的文件真的存在。
 *
 * 只用 Node 的解析规则（`createRequire`），**不碰 loader 的 internal** ——
 * 那个在版本之间不稳定，不该被我们依赖。
 */
function auditClientPackages(ctx) {
  const out = { entries: 0, candidates: [], missing: [], errors: [], parseSkipped: 0 }
  let entries = []
  try {
    const loader = ctx.get ? ctx.get('loader') : null
    if (!loader || typeof loader.entries !== 'function') {
      out.errors.push('ctx.loader 不可用')
      return out
    }
    entries = [...loader.entries()]
  } catch (err) {
    out.errors.push('枚举 loader 条目失败：' + String((err && err.message) || err))
    return out
  }
  out.entries = entries.length

  const req = createRequire(path.join(PKG_ROOT, 'package.json'))
  const seen = new Set()
  for (const entry of entries) {
    const name = entry && entry.options && entry.options.name
    if (!name || typeof name !== 'string' || seen.has(name)) continue
    seen.add(name)
    // cordis: 开头的内部条目直接跳过
    if (name.startsWith('cordis:')) continue

    let pkgPath = null
    try {
      pkgPath = req.resolve(name + '/package.json')
    } catch {
      out.parseSkipped++
      continue
    }
    let pkg = null
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) } catch { continue }
    const decl = pkg.dsh && pkg.dsh.client
    if (!decl || decl.platform !== 'web') continue

    const exportsField = pkg.exports
    let clientRel
    if (exportsField && typeof exportsField === 'object') {
      const c = exportsField['./client']
      if (typeof c === 'string') clientRel = c
      else if (c && typeof c.default === 'string') clientRel = c.default
    }
    const clientAbs = clientRel ? path.join(path.dirname(pkgPath), clientRel) : null
    const exists = clientAbs ? fs.existsSync(clientAbs) : false
    const rec = {
      package: pkg.name || name,
      loaderName: name,
      clientPath: clientAbs,
      clientExists: exists,
      self: pkg.name === 'dsh-skin-mahoyo',
    }
    out.candidates.push(rec)
    if (!exists) out.missing.push(rec)
  }
  return out
}

/** 读一个人格切片；失败返回 null。 */
function loadPersona(slug) {
  const file = path.join(PKG_ROOT, 'data', 'personas', slug + '.md')
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * ★★ 人格切片的缓存（按 **mtime** 失效）——2026-09-19 修。
 *
 * 原来只按 slug 缓存一次：改完 `data/personas/*.md`（例如追加「情感表达约定」）
 * 必须**重启 DSH** 才生效，而界面上完全看不出来 ——
 * 实测就卡在这儿：皮肤装好了，人格却没更新，排查花了不少时间。
 *
 * 现在每回合 stat 一次 mtime（一次 stat 的开销可以忽略），变了就重读。
 */
const personaCache = new Map()

function loadPersonaCached(slug) {
  const file = path.join(PKG_ROOT, 'data', 'personas', slug + '.md')
  let mtime = 0
  try { mtime = fs.statSync(file).mtimeMs } catch { mtime = 0 }
  const hit = personaCache.get(slug)
  if (hit && hit.mtime === mtime && mtime !== 0) return hit.text
  const text = loadPersona(slug)
  personaCache.set(slug, { mtime: mtime, text: text })
  return text
}

/**
 * 插件的宿主主体。**整体包在 try/catch 里：任何异常都不向上抛。**
 * @param {import('@deepseek-ai/cordis').Context} ctx - 宿主上下文
 */
export function apply(ctx) {
  const log = (level, msg, err) => {
    try {
      if (ctx && ctx.logger && typeof ctx.logger[level] === 'function') ctx.logger[level](msg, err || '')
      else console[level === 'warn' ? 'warn' : 'log']('[moye-skin] ' + msg, err || '')
    } catch { /* 连 logger 都不可用就算了 */ }
  }

  // ---- 安全模式：命中即完全不注册 ----------------------------------
  const safe = safeMode()
  if (safe.safe) {
    log('warn', `安全模式已开启（${safe.why}）：皮肤不注册任何东西。删除 SAFE_MODE 或设 MAHOYO_SAFE=0 后重启即可恢复。`)
    return
  }

  // ---- 1. 设置（宽松 schema + 代码内归一化 ⇒ 注册不可能失败） --------
  let settingsScope = null
  let current = Object.assign({}, DEFAULTS)
  try {
    settingsScope = ctx.settings.register(SETTINGS_NS, makeLooseSchema(), { applies: 'live' })
    current = normalizeSettings(settingsScope.get())
    ctx.effect(() => settingsScope.watch((next) => {
      try { current = normalizeSettings(next) } catch { /* 归一化失败保持上次值 */ }
    }), 'moye-skin: settings watch')
  } catch (err) {
    log('warn', '设置注册失败，改用内存默认值（皮肤其余部分照常）', err)
    settingsScope = null
  }

  // ---- 2. 人格注入 -----------------------------------------------
  try {
    ctx.effect(() => ctx.systemPrompt.section({
      name: PROMPT_SECTION,
      order: 10100, // WEB_SURFACE 之后、DEPLOYMENT_PERSONA_SUFFIX 之前
      text: () => {
        try {
          if (!current.persona) return ''
          const slug = CHARACTER_IDS.includes(current.character) ? current.character : 'aoko'
          const body = loadPersonaCached(slug)      // ★ 按 mtime 失效，改完不用重启 DSH
          if (!body) return ''
          return '# 人格扮演 · ' + CHARACTER_LABELS[slug] + '（' + slug + '）\n'
            + '> 本段由「魔法使之夜」皮肤注入；角色在皮肤菜单「環境設定 → 角色」里切换。\n'
            + '> 用于扮演，不改变任务与工具使用规范；与事实冲突时以事实为准。\n\n'
            + body
        } catch {
          return ''   // 注入段求值失败 → 只是没有这段，绝不影响装配
        }
      },
    }), 'moye-skin: persona prompt section')
  } catch (err) {
    log('warn', '人格注入段注册失败（皮肤其余部分照常）', err)
  }

  // ---- 3. 静态路由：三条各自独立 try/catch -------------------------
  const registerRoute = (label, route) => {
    try {
      ctx.effect(() => ctx.webServer.register(route), 'moye-skin: ' + label)
    } catch (err) {
      log('warn', `路由 ${route.path} 注册失败（皮肤其余部分照常）`, err)
    }
  }

  const assetRootOf = () => resolveAssetRoot(current.assetRoot)

  registerRoute('manifest', {
    kind: 'exact',
    path: ROUTE_BASE + '/manifest.json',
    handler: (req, res) => {
      if (!isLoopback(req)) return sendText(res, 403, 'loopback only')
      try {
        const bytes = fs.readFileSync(path.join(PKG_ROOT, 'data', 'manifest.json'))
        res.statusCode = 200
        res.setHeader('content-type', MIME['.json'])
        res.setHeader('cache-control', 'no-cache')
        res.end(bytes)
      } catch (err) {
        sendText(res, 500, 'manifest 缺失：' + String((err && err.message) || err))
      }
    },
  })

  registerRoute('health', {
    kind: 'exact',
    path: ROUTE_BASE + '/health',
    handler: async (req, res) => {
      if (!isLoopback(req)) return sendText(res, 403, 'loopback only')
      try {
        if (req.method === 'GET') {
          return sendJSON(res, 200, {
            ok: true,
            safeMode: safeMode(),
            package: {
              root: PKG_ROOT,
              clientBundle: path.join(PKG_ROOT, 'lib', 'client.js'),
              clientBundleExists: fs.existsSync(path.join(PKG_ROOT, 'lib', 'client.js')),
              clientBundleBytes: (() => {
                try { return fs.statSync(path.join(PKG_ROOT, 'lib', 'client.js')).size } catch { return 0 }
              })(),
              manifestExists: fs.existsSync(path.join(PKG_ROOT, 'data', 'manifest.json')),
            },
            settings: current,
            diag: diag,
            loader: auditClientPackages(ctx),
          })
        }
        if (req.method === 'POST') {
          // 浏览器半边启动后来报到 —— 这是"客户端 bundle 到底跑没跑"的唯一硬证据
          const body = await readBody(req, 512 * 1024)
          diag.clientSeen = true
          if (!diag.clientFirstSeen) diag.clientFirstSeen = new Date().toISOString()
          diag.clientLastSeen = new Date().toISOString()
          diag.clientInfo = body || null
          // ★ 探针单独留存。否则 2.8s 才发的 jsx 自检会把 1.4s 的渲染实况覆盖掉，
          //   排查时永远看不到"数据回来之后 DOM 长什么样"。
          if (body && typeof body.stage === 'string' && body.stage.indexOf('probe-') === 0) {
            /* ★★★ 2026-09-20：**别让"轻"探针挤掉"重"探针**。
               实测：`probe-viewport` 会随每次 resize/挂载上报，而环形缓冲只有 6 条，
               于是承载全部诊断的 `probe-t200` / `probe-t1400`（DOM/样式/pix/变量…）
               被一串 `probe-viewport`**挤了出去** —— 排查时拿到的是一个空壳，
               只能看到视口尺寸，看不到任何界面证据。这直接导致我误判过一轮。

               现在按权重淘汰：`probe-viewport` / `probe-vp-boot` 是轻的，
               先淘汰它们；t200/t1400 等重探针最后才淘汰。 */
            const LIGHT = { 'probe-viewport': true, 'probe-vp-boot': true }
            const isLight = (p) => !!LIGHT[p.stage]
            diag.probes.unshift({ at: new Date().toISOString(), stage: body.stage, data: body.autoProbe || body })
            if (diag.probes.length > 8) {
              // 从尾部找一个"轻"的淘汰；全是重的就淘汰最老的
              let idx = -1
              for (let i = diag.probes.length - 1; i >= 0; i--) {
                if (isLight(diag.probes[i])) { idx = i; break }
              }
              diag.probes.splice(idx >= 0 ? idx : diag.probes.length - 1, 1)
            }
          }
          if (body && body.stage === 'jsx-self-test') {
            diag.jsxSelfTest = { at: new Date().toISOString(), jsx: body.jsx || null }
          }
          // 调试快照单独存一份（最大、也最有用）
          if (body && body.stage === 'debug-snapshot' && body.snapshot) {
            diag.debugSnapshot = { at: new Date().toISOString(), data: body.snapshot }
          }
          if (body && Array.isArray(body.errors)) {
            for (const e of body.errors) if (diag.clientErrors.length < 20) diag.clientErrors.push(e)
          }
          return sendJSON(res, 200, { ok: true, seen: diag.clientFirstSeen })
        }
        res.setHeader('allow', 'GET, POST')
        return sendText(res, 405, 'method not allowed')
      } catch (err) {
        return sendText(res, 500, String((err && err.message) || err))
      }
    },
  })

  registerRoute('settings bridge', {    kind: 'exact',
    path: ROUTE_BASE + '/settings',
    handler: async (req, res) => {
      if (!isLoopback(req)) return sendText(res, 403, 'loopback only')
      try {
        if (req.method === 'GET') {
          const r = assetRootOf()
          // ⚠ 这里**刻意不做**"发现 enabled=false 就自动写回 true"的自愈。
          //
          //   我一度加过、又撤掉了。理由：那会让「启用皮肤」这个开关从用户视角
          //   **完全失效**（关掉 → 皮肤仍不画 → 但下次读取又自己变回 true），
          //   属于用一个偷偷摸摸的机制去掩盖问题，而不是解决问题。
          //
          //   真正的解法是"关掉之后要有**明确且够用的**回去的路"，见 client.js：
          //     · 关闭态每次加载都弹右下角横幅（带「恢复皮肤」按钮）
          //     · Ctrl+Shift+U 一键恢复（localStorage 标记 + settings.enabled 两道闸一起清）
          //     · 地址栏 `?mahoyo=on`
          return sendJSON(res, 200, {
            ns: SETTINGS_NS,
            value: current,
            assetRootResolved: r.root,
            assetRootSource: r.source,
            characters: CHARACTER_LABELS,
            safeMode: false,
          })
        }
        if (req.method === 'POST') {
          const patch = await readBody(req)
          if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            return sendText(res, 400, 'patch must be an object')
          }
          const clean = normalizeSettings(Object.assign({}, current, patch))
          if (settingsScope) await settingsScope.replace(clean)
          current = clean
          return sendJSON(res, 200, { ok: true, value: current })
        }
        res.setHeader('allow', 'GET, POST')
        return sendText(res, 405, 'method not allowed')
      } catch (err) {
        return sendText(res, 500, String((err && err.message) || err))
      }
    },
  })

  registerRoute('assets', {
    kind: 'prefix',
    path: ROUTE_BASE + '/assets',
    handler: async (req, res) => {
      if (!isLoopback(req)) return sendText(res, 403, 'loopback only')
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('allow', 'GET, HEAD')
        return sendText(res, 405, 'method not allowed')
      }
      const root = assetRootOf().root
      let rel
      try {
        rel = decodeURIComponent(new URL(String(req.url), 'http://localhost').pathname
          .slice((ROUTE_BASE + '/assets').length))
      } catch {
        return sendText(res, 400, 'bad path')
      }
      rel = rel.replace(/^\/+/, '')
      if (!rel || rel.includes('\0')) return sendText(res, 400, 'bad path')

      const abs = path.resolve(root, rel)
      const guard = path.resolve(root) + path.sep
      if (!(abs + path.sep).startsWith(guard) && abs !== path.resolve(root)) {
        return sendText(res, 403, 'forbidden')
      }
      try {
        const st = await fsp.stat(abs)
        if (!st.isFile()) return sendText(res, 404, 'not found')
        res.statusCode = 200
        res.setHeader('content-type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream')
        res.setHeader('content-length', String(st.size))
        res.setHeader('cache-control', 'public, max-age=86400')
        if (req.method === 'HEAD') return res.end()
        const stream = fs.createReadStream(abs)
        stream.on('error', () => { try { res.end() } catch { /* 已断开 */ } })
        return stream.pipe(res)
      } catch {
        return sendText(res, 404, 'not found')
      }
    },
  })
}

/**
 * 造一个"只要求是对象、任何值都放行"的设置 schema。
 *
 * **为什么要宽松**：`SettingsProvider.register()` 会**在注册时立刻**执行
 * `resolve(schema, base, section)` → 里面直接 `schema(mergeLayers(base, section))`。
 * 也就是说 schema 是**被当函数调用**的，而且校验不过会**拒绝注册本身** ——
 * 用户手改 `settings.yaml` 写错一个值，就可能连带让注册失败。
 * 所以这里只做最弱约束，字段合法性全部交给 {@link normalizeSettings}。
 *
 * **两条路径**：
 *   1. 优先用真正的 `@deepseek-ai/schemastery`（`install.ps1` 已把 profile 里
 *      那一份 junction 到本包的 `node_modules/`，所以能解析到）。
 *   2. 解析不到就退化成**一个可调用的鸭子类型 schema** —— 不 import 它就少一个
 *      模块解析点，也就少一条"profile 起不来"的可能。
 *
 * 返回的对象满足 DSH 实际用到的全部接口：`schema(value)` 调用、`toJSON()`、
 * 以及 schemastery 的 `~standard` 标记。
 *
 * @returns {any} 可传给 `ctx.settings.register` 的 schema
 */
function makeLooseSchema() {
  // ---- 路径 1：真 schemastery ----
  try {
    // 同步 require 在 ESM 里不可用；走 createRequire 又会多一个 import。
    // 这里改用"已解析的依赖探测"：install.ps1 建的 junction 存在就用它。
    const probe = path.join(PKG_ROOT, 'node_modules', '@deepseek-ai', 'schemastery', 'package.json')
    fs.statSync(probe)
    // 能同步确认存在，才动态 import（import 失败会被下面的 catch 接住）
    return makeSchemasterySchema()
  } catch { /* junction 不在 → 走兜底 */ }

  // ---- 路径 2：可调用鸭子类型 ----
  return makeDuckSchema()
}

/** 已确认依赖可用时的真 schema（延迟到 register 前一刻才 import）。 */
function makeSchemasterySchema() {
  // 注意：这里不能 await（apply 是同步的），所以用 createRequire 同步加载。
  // 该文件是 ESM，但 schemastery 同时提供 CJS 入口（lib/index.cjs）。
  const require = createRequire(import.meta.url)
  const mod = require('@deepseek-ai/schemastery')
  const z = mod && mod.default ? mod.default : mod
  return z.object({
    character: z.string().default('aoko'),
    enabled: z.boolean().default(true),
    showSprite: z.boolean().default(true),
    showDialogue: z.boolean().default(true),
    hideTabs: z.boolean().default(true),
    autoCollapse: z.boolean().default(true),
    bgm: z.boolean().default(true),
    bgmVolume: z.number().default(0.35),
    sfx: z.boolean().default(true),
    sfxVolume: z.number().default(0.5),
    persona: z.boolean().default(true),
    easterEgg: z.boolean().default(true),
    edThreshold: z.number().default(0.78),
    assetRoot: z.string().default(''),
  })
}

/** 兜底：可调用 + 有 toJSON 的鸭子类型 schema，永不抛。 */
function makeDuckSchema() {
  const fn = function (value) {
    try {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
      return {}
    } catch {
      return {}
    }
  }
  fn.toJSON = () => ({ type: 'object', additionalProperties: true, description: 'moye-skin loose schema' })
  fn['~standard'] = { version: 1, vendor: 'moye-loose' }
  fn.__moyeLoose = true
  return fn
}

export default { name, inject, apply }

#!/usr/bin/env node
/**
 * measure-skin.mjs —— 用**真浏览器**量皮肤在不同视口比例下有没有"占不满"或"溢出"。
 *
 * ## 为什么要这个
 * 这个项目已经栽过两次同一个坑：
 *   ① 诊断页的比例与实机不同义（`docs/22` R12）—— 因为立绘用了 `vh/vw`（视口单位），
 *      而诊断页的舞台是窄栏，同一个 `20vw` 含义完全不同；
 *   ② 凭"读 CSS 觉得对"下结论，把出框量错（`docs/21` 记过）。
 * 所以：**别再推理，量。**
 *
 * 做法：起一个最小 HTTP 服务把 `skin/` 挂出去，用无头 Edge 打开"复刻运行时结构"的探针页，
 * 经 CDP 的 `Runtime.evaluate` 取回每个层的 `getBoundingClientRect()`。
 * 判定：任何**应铺满**的层（root / under / bg / band / stage）没盖住视口 → 报缺口 px。
 *
 * 用法：
 *   node persona_work/tools/measure-skin.mjs
 *   node persona_work/tools/measure-skin.mjs --viewport 1512x722,2560x1080,1024x1366
 *   node persona_work/tools/measure-skin.mjs --json out.json
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SKIN = path.join(ROOT, 'skin')

const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const VIEWPORTS = argOf('viewport', '1512x722,1920x1080,2560x1080,1366x768,1024x1366')
  .split(',').map((s) => s.trim()).filter(Boolean)
/** 这些层**必须**盖满视口。
 *  ⚠ 判据踩过两个坑，都记在这：
 *   ① **不要**放 `.myh-stage`：它是立绘定位舞台，高度受立绘档位影响，**不负责铺满**
 *      （实测 1920x1080 下 stage 高 757px < 视口 985px，属正常）。
 *   ② **不要**放 `#myh-skin-root`：它是自建容器（`position:fixed;inset:0`）但**本身无内容**，
 *      内容都在子元素 `.myh-root` 里 → 实测它 `height:0`，报"下缺 985"是假警报。 */
const MUST_COVER = ['.myh-root', '.myh-under', '.myh-bg', '.myh-band']

function findBrowser() {
  for (const c of [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]) if (fs.existsSync(c)) return c
  return null
}

/** 从 client.js 实抽内联 CSS 数组 —— 用真源，不复制一份。 */
function extractCss() {
  const src = fs.readFileSync(path.join(SKIN, 'lib', 'client.js'), 'utf8')
  const m = /const CSS = \[([\s\S]*?)\]\.join\(/.exec(src)
  if (!m) throw new Error('client.js 里找不到 `const CSS = [...].join(`')
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((x) => x[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')).join('\n')
}

/** 复刻运行时结构（与 client.js 的 SkinRoot 渲染一致的最小骨架 + measureShell 写的变量）。 */
function buildProbe(css, manifest) {
  const sid = 'A3'
  const sc = manifest.scenes[sid]
  const slots = manifest.expressions[sid].slots
  const slotName = 'neutral' in slots ? 'neutral' : Object.keys(slots)[0]
  const sprite = slots[slotName][0]
  const band = (manifest.ui.txtwindow || [])[0] || ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;height:100%}
${css}
</style></head><body data-myh-skin="1">
<div id="myh-skin-root">
  <div class="myh-root">
    <div class="myh-under" aria-hidden="true">
      <img class="myh-bg" src="../assets/${sc.bg}" alt="">
      <div class="myh-band" style="background-image:url('../assets/${band}')"></div>
      <div class="myh-stage"><img class="myh-sprite" src="../assets/${sprite}" alt=""></div>
    </div>
    <div class="myh-column"></div>
    <div class="myh-over">
      <div class="myh-dlg" data-tone="deep" style="height:130px">
        <div class="myh-dlgBody"><div class="myh-name">蒼崎青子</div>
        <div class="myh-line">测试台词一行。</div></div>
      </div>
    </div>
  </div>
</div>
<script>
const root = document.getElementById('myh-skin-root')
const vh = innerHeight, vw = innerWidth
root.style.setProperty('--myh-composer-h', '96px')
root.style.setProperty('--myh-composer-top', (vh - 96) + 'px')
root.style.setProperty('--myh-column-bottom', (vh - 96) + 'px')
const cw = Math.min(1100, Math.round(vw * 0.76)), cl = Math.round((vw - cw) / 2)
root.style.setProperty('--myh-hole-l', cl + 'px'); root.style.setProperty('--myh-hole-t', '0px')
root.style.setProperty('--myh-hole-r', (cl + cw) + 'px'); root.style.setProperty('--myh-hole-b', (vh - 96) + 'px')
window.__probe = function () {
  const out = { viewport: { w: innerWidth, h: innerHeight } }
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             r: Math.round(r.right), b: Math.round(r.bottom) }
  }
  for (const s of ${JSON.stringify(MUST_COVER.concat(['.myh-sprite', '.myh-column', '.myh-dlg']))}) out[s] = box(s)
  const b = document.querySelector('.myh-bg')
  if (b) out.bg = { natW: b.naturalWidth, natH: b.naturalHeight,
                    fit: getComputedStyle(b).objectFit, complete: b.complete }
  return out
}
</script></body></html>`
}

// ---------------------------------------------------------------- 最小 CDP
async function waitForTarget(port, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl)
      if (page) return page
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP 目标超时')
}

function cdpEval(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(wsUrl)
    const done = (v, e) => { try { sock.close() } catch {} ; e ? reject(e) : resolve(v) }
    const timer = setTimeout(() => done(null, new Error('CDP eval 超时')), 15000)
    sock.addEventListener('open', () => {
      sock.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true } }))
    })
    sock.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.id !== 1) return
      clearTimeout(timer)
      if (msg.result && msg.result.exceptionDetails) return done(null, new Error('页面内异常'))
      done(msg.result && msg.result.result ? msg.result.result.value : null)
    })
    sock.addEventListener('error', () => { clearTimeout(timer); done(null, new Error('WebSocket 错误')) })
  })
}

// ---------------------------------------------------------------- 主流程
async function main() {
  const exe = findBrowser()
  if (!exe) { console.error('✗ 找不到 Edge / Chrome'); return 1 }
  const css = extractCss()
  const manifest = JSON.parse(fs.readFileSync(path.join(SKIN, 'data', 'manifest.json'), 'utf8'))
  const probe = buildProbe(css, manifest)

  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/probe.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(probe)
    }
    const abs = path.resolve(SKIN, '.' + p)
    if (!abs.startsWith(SKIN) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404); return res.end('404')
    }
    const mime = { '.png': 'image/png', '.json': 'application/json' }[path.extname(abs).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' })
    fs.createReadStream(abs).pipe(res)
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const port = srv.address().port

  console.log('浏览器   : ' + path.basename(exe))
  console.log('CSS 片段 : ' + css.split('\n').length + ' 行（从 client.js 实抽）')
  console.log('')
  console.log('视口        比例     bg固有       缺口（应铺满的层）                        判定')
  console.log('-'.repeat(104))

  const results = []
  let bad = 0
  for (const vp of VIEWPORTS) {
    const [w, h] = vp.split('x').map(Number)
    const dbg = 9333 + Math.floor(Math.random() * 400)
    const profile = path.join(ROOT, 'persona_work', 'tmp', 'edge-profile-' + dbg)
    const child = spawn(exe, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--window-size=${w},${h}`, `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`,
      `http://127.0.0.1:${port}/probe.html`,
    ], { stdio: 'ignore' })
    let data = null
    try {
      const target = await waitForTarget(dbg, 15000)
      // 等图加载完再量
      for (let i = 0; i < 40; i++) {
        const r = JSON.parse(await cdpEval(target.webSocketDebuggerUrl, 'JSON.stringify(window.__probe ? window.__probe() : null)') || 'null')
        if (r && r.bg && r.bg.complete && r.bg.natW > 0) { data = r; break }
        data = r
        await new Promise((x) => setTimeout(x, 150))
      }
    } catch (e) {
      data = { error: String((e && e.message) || e) }
    } finally {
      try { child.kill() } catch {}
      try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
    }
    results.push({ vp, ...data })

    const pad = (s, n) => String(s).padEnd(n)
    if (!data || data.error || !data.viewport || !Number.isFinite(data.viewport.w) || !data.viewport.w) {
      bad++
      console.log(pad(vp, 12) + pad('-', 8) + pad('-', 14) + pad((data && data.error) || '无数据/视口不可用', 42) + '✗')
      continue
    }
    const vpw = data.viewport.w, vph = data.viewport.h
    const gaps = new Set()
    for (const sel of MUST_COVER) {
      const r = data[sel]
      if (!r) { gaps.add(sel + ' 缺失'); continue }
      if (r.l > 0) gaps.add(`${sel} 左缺${r.l}`)
      if (r.t > 0) gaps.add(`${sel} 上缺${r.t}`)
      if (r.r < vpw) gaps.add(`${sel} 右缺${vpw - r.r}`)
      if (r.b < vph) gaps.add(`${sel} 下缺${vph - r.b}`)
    }
    const g = [...gaps]
    const mismatch = (vpw !== w || vph !== h) ? `(实际 ${vpw}x${vph}) ` : ''
    if (g.length) bad++
    console.log(pad(`${w}x${h}`, 12) +
      pad((vpw / vph).toFixed(3), 8) +
      pad(data.bg ? `${data.bg.natW}x${data.bg.natH}` : '-', 14) +
      pad(mismatch + (g.length ? g.slice(0, 3).join(' ') : '—'), 42) +
      (g.length ? '✗ 没铺满' : '✓ 铺满'))
  }
  console.log('-'.repeat(104))
  console.log(bad ? `✗ ${bad}/${results.length} 个视口存在"没铺满/量不到"` : `✓ ${results.length}/${results.length} 个视口全部铺满`)

  const j = argOf('json', '')
  if (j) { fs.writeFileSync(j, JSON.stringify(results, null, 1), 'utf8'); console.log('明细 ->', j) }
  srv.close()
  return bad ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1) })

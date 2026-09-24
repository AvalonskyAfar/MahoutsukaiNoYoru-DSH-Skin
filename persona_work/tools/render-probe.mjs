#!/usr/bin/env node
/**
 * render-probe.mjs —— 不依赖 DSH、不依赖皮肤能否使用：把皮肤**真实的 CSS + DOM 骨架**
 * 做成独立页面，用无头 Edge 在任意视口下渲染并测量。
 *
 * ## 为什么需要它（这条路是被逼出来的）
 * 用户报告"背景上下左右漏出桌面"，但：
 *   · DSH 探针（皮肤自己量的）报 `.myh-root` = 1912×1115（铺满），与所见矛盾；
 *   · **皮肤当前处于关闭态 + 发不出消息（Q14）** → 拿不到实时 DOM，也开不了控制台取数；
 *   · 预览页的舞台是**窄栏**（比例与实机不同义）→ 在那里量出来的结论不可信。
 * 所以要一个**独立、可控、可复现**的渲染环境：真 CSS（从 client.js 实抽）+ 真骨架 + 指定视口。
 *
 * ## 产出
 *   skin/preview/__runtime-probe.html   （临时探针页，用完可留可删）
 *   skin/preview/__runtime-probe.css    （从 client.js 抽出的 CSS，保证与运行时同源）
 * 然后无头 Edge 打开它，经 CDP 取回每层的 rect 与关键 computed style。
 *
 * 用法：
 *   node persona_work/tools/render-probe.mjs
 *   node persona_work/tools/render-probe.mjs --viewport 1280x798,1912x1115,2560x1400
 *   node persona_work/tools/render-probe.mjs --json out.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SKIN = path.join(ROOT, 'skin')
const PREVIEW = path.join(SKIN, 'preview')

const argv = process.argv.slice(2)
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const VIEWPORTS = argOf('viewport', '1280x798,1912x1115,2560x1400,1920x1080,1512x722,1024x1366').split(',')

/** 必须盖满视口的层（`.myh-stage`/`.myh-skin-root` 不在内，理由见 docs/24 §9）。 */
const MUST_COVER = ['.myh-root', '.myh-under', '.myh-bg', '.myh-band']

function findBrowser() {
  for (const c of [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]) if (fs.existsSync(c)) return c
  return null
}

/** 从 client.js 实抽 CSS —— 单一来源，绝不手抄。 */
function extractCss() {
  const src = fs.readFileSync(path.join(SKIN, 'lib', 'client.js'), 'utf8')
  const m = /const CSS = \[([\s\S]*?)\]\.join\(/.exec(src)
  if (!m) throw new Error('client.js 里找不到 `const CSS = [...].join(`')
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((x) => x[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')).join('\n')
}

/** 写出探针页：结构与 client.js 的 SkinRoot 一致，变量按 measureShell() 的产出写。 */
function writeProbe(cssFile, manifest) {
  const sid = 'A3'
  const sc = manifest.scenes[sid]
  const slots = manifest.expressions[sid].slots
  const slotName = 'neutral' in slots ? 'neutral' : Object.keys(slots)[0]
  const sprite = slots[slotName][0]
  const band = (manifest.ui.txtwindow || [])[0] || ''
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>runtime probe</title>
<link rel="stylesheet" href="./__runtime-probe.css">
<style>html,body{margin:0;padding:0;height:100%}</style>
</head><body data-myh-skin="1">
<div id="myh-skin-root" style="position:fixed;inset:0;z-index:2147482000;pointer-events:none;overflow:hidden">
  <div class="myh-root">
    <div class="myh-under" aria-hidden="true">
      <img class="myh-bg" src="../assets/${sc.bg}" alt="">
      <div class="myh-band" style="background-image:url('../assets/${band}')"></div>
      <div class="myh-stage"><img class="myh-sprite" src="../assets/${sprite}" alt=""></div>
    </div>
    <div class="myh-column"><div class="myh-columnInner"></div></div>
    <div class="myh-over">
      <div class="myh-dlg" data-tone="deep" style="height:130px">
        <div class="myh-dlgBody">
          <div class="myh-name">蒼崎青子</div>
          <div class="myh-line">测试台词一行，用来量对话框高度。</div>
        </div>
      </div>
      <div class="myh-hotzone" data-armed="true" data-guard="on"></div>
    </div>
  </div>
</div>
<script>
// 复刻 measureShell() 写的那 7 个变量
const root = document.getElementById('myh-skin-root')
const vh = innerHeight, vw = innerWidth
root.style.setProperty('--myh-composer-h', '96px')
root.style.setProperty('--myh-composer-top', (vh - 96) + 'px')
root.style.setProperty('--myh-column-bottom', (vh - 96) + 'px')
const cw = Math.min(1100, Math.round(vw * 0.76)), cl = Math.round((vw - cw) / 2)
root.style.setProperty('--myh-hole-l', cl + 'px'); root.style.setProperty('--myh-hole-t', '0px')
root.style.setProperty('--myh-hole-r', (cl + cw) + 'px'); root.style.setProperty('--myh-hole-b', (vh - 96) + 'px')

window.__probe = function () {
  const v = { w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
              screen: screen.width + 'x' + screen.height,
              ratio: +(innerWidth / innerHeight).toFixed(4) }
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             r: Math.round(r.right), b: Math.round(r.bottom),
             display: cs.display, fit: cs.objectFit || '-', pos: cs.position }
  }
  const out = { viewport: v, cssBytes: 0 }
  for (const s of ${JSON.stringify(MUST_COVER.concat(['#myh-skin-root', '.myh-stage', '.myh-sprite', '.myh-column', '.myh-dlg', '.myh-hotzone']))}) out[s] = box(s)
  const b = document.querySelector('.myh-bg')
  if (b) out.bg = { natW: b.naturalWidth, natH: b.naturalHeight, complete: b.complete }
  // 覆盖率：对每个必须铺满的层算与视口的四边缺口
  out.coverage = {}
  for (const s of ${JSON.stringify(MUST_COVER)}) {
    const r = out[s]
    if (!r) { out.coverage[s] = { missing: true }; continue }
    out.coverage[s] = { left: r.l, top: r.t, right: v.w - r.r, bottom: v.h - r.b }
  }
  let worst = 0
  for (const s in out.coverage) {
    const c = out.coverage[s]
    if (c.missing) { worst = 1e9; continue }
    worst = Math.max(worst, c.left, c.top, c.right, c.bottom)
  }
  out.worstGapPx = worst
  out.verdict = worst <= 0 ? '铺满（四边缺口均 ≤0）' : ('没铺满，最大缺口 ' + worst + 'px')
  return out
}
</script></body></html>`
  fs.writeFileSync(path.join(PREVIEW, '__runtime-probe.html'), html, 'utf8')
}

// ---- 极简 CDP（与 measure-skin.mjs 同口径）----
async function waitForTarget(port, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const p = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl)
      if (p) return p
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP 目标超时')
}
function cdpEval(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(wsUrl)
    const done = (v, e) => { try { sock.close() } catch {} ; e ? reject(e) : resolve(v) }
    const t = setTimeout(() => done(null, new Error('CDP eval 超时')), 15000)
    sock.addEventListener('open', () => sock.send(JSON.stringify({
      id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })))
    sock.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data) } catch { return }
      if (m.id !== 1) return
      clearTimeout(t)
      done(m.result && m.result.result ? m.result.result.value : null)
    })
    sock.addEventListener('error', () => { clearTimeout(t); done(null, new Error('WS 错误')) })
  })
}

async function main() {
  const exe = findBrowser()
  if (!exe) { console.error('✗ 找不到 Edge/Chrome'); return 1 }
  const css = extractCss()
  const manifest = JSON.parse(fs.readFileSync(path.join(SKIN, 'data', 'manifest.json'), 'utf8'))
  fs.writeFileSync(path.join(PREVIEW, '__runtime-probe.css'), css, 'utf8')
  writeProbe(null, manifest)
  console.log('浏览器   : ' + path.basename(exe))
  console.log('探针页   : skin/preview/__runtime-probe.html（CSS ' + css.split('\n').length + ' 行，从 client.js 实抽）')
  console.log('')

  // 用已在跑的 8123（它的 root 是 skin/preview/，所以 URL 要带 /preview/ 前缀）；不可用则自带临时服务器
  let base = 'http://127.0.0.1:8123/preview'
  let ownSrv = null
  try {
    const r = await fetch(base + '/__runtime-probe.html', { method: 'GET' })
    if (!r.ok) throw new Error('HTTP ' + r.status)
  } catch {
    const http = await import('node:http')
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0])
      const rel = p.startsWith('/preview/') ? p.slice('/preview/'.length) : p.replace(/^\//, '')
      const abs = path.resolve(PREVIEW, rel)
      if (!abs.startsWith(PREVIEW) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('404') }
      const mime = { '.png': 'image/png', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.json': 'application/json' }[path.extname(abs).toLowerCase()] || 'application/octet-stream'
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' })
      fs.createReadStream(abs).pipe(res)
    })
    await new Promise((r) => srv.listen(0, '127.0.0.1', r))
    ownSrv = srv
    base = `http://127.0.0.1:${srv.address().port}/preview`
    console.log('（8123 没在跑，自带临时服务器 ' + base + '）')
  }
  const url = base + '/__runtime-probe.html'

  console.log('视口        比例    bg固有      最差缺口   判定')
  console.log('-'.repeat(84))
  const results = []
  let bad = 0
  for (const vp of VIEWPORTS) {
    const [w, h] = vp.split('x').map(Number)
    const dbg = 9700 + Math.floor(Math.random() * 300)
    const prof = path.join(ROOT, 'persona_work', 'tmp', 'edge-' + dbg)
    const child = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--window-size=${w},${h}`, `--remote-debugging-port=${dbg}`, `--user-data-dir=${prof}`, url], { stdio: 'ignore' })
    let d = null
    try {
      const t = await waitForTarget(dbg, 15000)
      for (let i = 0; i < 40; i++) {
        const r = JSON.parse(await cdpEval(t.webSocketDebuggerUrl, 'JSON.stringify(window.__probe ? window.__probe() : null)') || 'null')
        if (r && r.bg && r.bg.complete && r.bg.natW > 0) { d = r; break }
        d = r
        await new Promise((x) => setTimeout(x, 150))
      }
    } catch (e) { d = { error: String(e && e.message || e) } }
    finally { try { child.kill() } catch {}; try { fs.rmSync(prof, { recursive: true, force: true }) } catch {} }
    results.push({ req: vp, ...d })

    const pad = (s, n) => String(s).padEnd(n)
    if (!d || d.error || !d.viewport) {
      bad++; console.log(pad(vp, 12) + pad('-', 7) + pad('-', 12) + pad((d && d.error) || '无数据', 11) + '✗')
      continue
    }
    if (d.worstGapPx > 0) bad++
    console.log(pad(`${w}x${h}`, 12) +
      pad((d.viewport.w / d.viewport.h).toFixed(3), 7) +
      pad(d.bg ? `${d.bg.natW}x${d.bg.natH}` : '-', 12) +
      pad(d.worstGapPx + 'px', 11) +
      (d.worstGapPx > 0 ? '✗ ' + d.verdict : '✓ ' + d.verdict) +
      (d.viewport.w !== w || d.viewport.h !== h ? `  (实际视口 ${d.viewport.w}x${d.viewport.h})` : ''))
  }
  console.log('-'.repeat(84))
  console.log(bad ? `✗ ${bad}/${results.length} 个视口没铺满` : `✓ ${results.length}/${results.length} 个视口全部铺满`)
  const j = argOf('json', '')
  if (j) { fs.writeFileSync(j, JSON.stringify(results, null, 1), 'utf8'); console.log('明细 -> ' + j) }
  if (ownSrv) ownSrv.close()
  return bad ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1) })

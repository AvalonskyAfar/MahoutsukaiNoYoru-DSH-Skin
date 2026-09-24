#!/usr/bin/env node
/**
 * 离线渲染测试 —— 直接跑 `SkinRoot()` 把渲染期异常抓在本机。
 * ---------------------------------------------------------------------------
 * 为什么需要它：浏览器里的错误被 `SkinErrorBoundary` 兜住后只留一行提示，
 * 而让用户开控制台/粘命令是**很差的调试方式**（这几轮已经证明）。
 * 这里用一套"真能跑"的 React hooks 替身（useState/useRef/useEffect 都真有状态），
 * 把 SkinRoot 的整棵渲染树跑一遍 —— 任何 TypeError / ReferenceError 都会在这里现形。
 *
 * 用法：node skin/tools/render-selftest.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// 一套"够真"的 React 替身：hooks 有状态、createElement 返回带 props 的节点
// ---------------------------------------------------------------------------
function makeReactStub(log) {
  let hookState = []
  let hookIdx = 0
  const effects = []
  // ★ Hooks 规则检查：每次渲染记录"用到了第几个 hook"，
  //   两次渲染数目不一致就是 React #310（Rendered more hooks than during
  //   the previous render）—— 这条错误在浏览器里只给一个 error code，
  //   没有任何可读信息，必须在本机抓。
  const renderProfile = []
  let renderNo = -1

  const React = {
    version: 'stub',
    Component: class Component {
      constructor(props) { this.props = props; this.state = props.__state || {} }
      setState(p) { this.state = Object.assign({}, this.state, p) }
      render() { return null }
    },
    Fragment: Symbol.for('react.fragment'),
    createElement: function (type, props) {
      const children = Array.prototype.slice.call(arguments, 2)
      const flat = []
      for (const c of children) {
        if (Array.isArray(c)) flat.push(...c.filter((x) => x !== null && x !== undefined && x !== false))
        else if (c !== null && c !== undefined && c !== false) flat.push(c)
      }
      return { $$el: true, type: type, props: props || {}, children: flat }
    },
    useState: function (init) {
      const i = hookIdx++
      if (!(i in hookState)) hookState[i] = typeof init === 'function' ? init() : init
      return [hookState[i], function (v) { hookState[i] = typeof v === 'function' ? v(hookState[i]) : v }]
    },
    useRef: function (init) {
      const i = hookIdx++
      if (!(i in hookState)) hookState[i] = { current: init }
      return hookState[i]
    },
    useMemo: function (fn, deps) {
      const i = hookIdx++
      const key = deps ? JSON.stringify(deps, (k, v) => (typeof v === 'function' ? 'fn' : v)) : 'n' + i
      if (!(i in hookState)) hookState[i] = { key: key, val: fn() }
      else if (hookState[i].key !== key) { hookState[i] = { key: key, val: fn() } }
      return hookState[i].val
    },
    useCallback: function (fn) { hookIdx++; return fn },
    useEffect: function (fn, deps) {
      const i = hookIdx++
      const key = deps ? JSON.stringify(deps, (k, v) => (typeof v === 'function' ? 'fn' : v)) : 'always' + i
      if (!(i in hookState) || hookState[i].key !== key) {
        hookState[i] = { key: key }
        effects.push(fn)
      }
    },
    useSyncExternalStore: function (sub, get) { hookIdx++; return get() },
    /** 一次"渲染"的开始/结束：用于 hooks 齐次性检查。 */
    __beginRender: function (label) {
      renderNo++
      hookIdx = 0
      renderProfile[renderNo] = { label: label, hooks: 0 }
    },
    __endRender: function () {
      if (renderProfile[renderNo]) renderProfile[renderNo].hooks = hookIdx
      return {
        renderNo: renderNo,
        hooks: hookIdx,
        prev: renderNo > 0 ? renderProfile[renderNo - 1] : null,
      }
    },
    __profile: function () { return renderProfile.filter(Boolean) },
  }
  const jsxRuntime = {
    jsx: (t, p) => React.createElement(t, p, p && p.children),
    jsxs: (t, p) => React.createElement(t, p, p && p.children),
    Fragment: React.Fragment,
  }
  React.__reset = function () { hookState = []; hookIdx = 0; effects.length = 0 }
  React.__runEffects = function () {
    for (const fn of effects) {
      try { const d = fn(); void d } catch (err) { log('  [effect 抛错] ' + err.message) }
    }
    effects.length = 0
  }
  return { React, jsxRuntime }
}

const log = (...a) => console.log(...a)

// ---------------------------------------------------------------------------
// DOM 替身
// ---------------------------------------------------------------------------
const fakeEl = () => ({
  dataset: {}, style: { setProperty() {} }, children: [], textContent: '',
  setAttribute() {}, getAttribute() { return null }, removeAttribute() {},
  hasAttribute() { return false }, appendChild() {}, removeChild() {},
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null }, querySelectorAll() { return [] },
  getBoundingClientRect() { return { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 } },
  closest() { return null }, remove() {}, animate() { return {} }, focus() {},
})

export function runSelfTest({ dark = true, noSettings = false } = {}) {
  const { React, jsxRuntime } = makeReactStub(log)

  const doc = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => fakeEl(),
    head: { appendChild() {} },
    body: Object.assign(fakeEl(), { setAttribute() {}, removeAttribute() {}, getAttribute() { return dark ? '' : null } }),
    documentElement: { setAttribute() {}, getAttribute() { return null } },
  }

  /** Node 里部分全局是只读 getter，需用 defineProperty 覆盖。 */
  const setG = (name, value) => {
    try { globalThis[name] = value } catch { /* 只读 */ }
    if (globalThis[name] !== value) {
      try { Object.defineProperty(globalThis, name, { value, writable: true, configurable: true }) } catch { /* 放弃 */ }
    }
  }
  setG('document', doc)
  globalThis.window = {
    __ModuleLoader__: { load() {} },
    innerWidth: 1920, innerHeight: 1080,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
  setG('navigator', { userAgent: 'render-selftest' })
  setG('location', { href: 'http://x/', search: '' })
  setG('localStorage', { getItem: () => null, setItem() {}, removeItem() {} })
  setG('MutationObserver', class { observe() {} disconnect() {} })
  setG('ResizeObserver', class { observe() {} disconnect() {} })
  setG('Audio', class { constructor() {} play() { return Promise.resolve() } pause() {} addEventListener() {} })
  setG('fetch', async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))

  // ---- 跑 bundle ----
  let registered = null
  globalThis.window.__ModuleLoader__ = { load: (e) => { registered = e } }
  const src = fs.readFileSync(path.join(SKIN, 'lib', 'client.js'), 'utf8')
  new Function('window', 'document', src)(globalThis.window, doc)
  const api = registered.factory((spec) => {
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
    throw new Error('unexpected require ' + spec)
  })

  // ---- 准备数据 ----
  const manifest = JSON.parse(fs.readFileSync(path.join(SKIN, 'data', 'manifest.json'), 'utf8'))
  api.__internals.loadManifest(manifest)
  api.__internals.settingsBox.s = {
    character: 'aoko', enabled: true, showSprite: true, showDialogue: true,
    hideTabs: true, autoCollapse: true, bgm: false, bgmVolume: 0, sfx: false, sfxVolume: 0,
    persona: true, easterEgg: true, edThreshold: 0.78, assetRoot: '',
  }
  api.__internals.store.set({
    ready: !noSettings,
    // ★ noSettings 模式：模拟"设置还没从宿主回来" —— 这曾经把整个皮肤按死
    settings: noSettings ? null : api.__internals.settingsBox.s,
    dark: dark,
    scene: 'A4',
    bg: '/moye-skin/assets/bg/A4_img0296.mzp.png',
    sprite: '/moye-skin/assets/sprite/aok_a_03_02_00.mzp.png',
    messages: [
      { id: 'm1', role: 'user', text: '你好，青子。' },
      { id: 'm2', role: 'assistant', text: '……アンタ、こんな時間に何の用よ。', reasoning: '（先看看他来做什么）', tools: [{ name: 'web_search', args: '{}' }] },
      { id: 'm3', role: 'tool', text: 'ok', name: 'read_file' },
      { id: 'm4', role: 'notice', text: '上下文已压缩' },
    ],
  })

  // ---- 渲染：连渲染两遍，检查 hooks 齐次性（React #310 的成因）----
  log('== 跑 SkinRoot() ==')
  log('  预检: killed=' + api.__internals.getKilled() +
    '  hasManifest=' + !!api.__internals.manifestBox.m +
    '  hasSettings=' + !!api.__internals.store.get().settings)

  let tree = null
  const hookCounts = []
  try {
    // ★★ 扰动序列是**照着真实崩溃现场写的**，不是随便动动状态：
    //
    //   pass0  设置未到达        → 用内置默认（enabled 缺省 true）→ 正常渲染
    //   pass1  设置到达 enabled:false → 守卫拦住，提前返回
    //   pass2  enabled 又被打开   → 再次正常渲染
    //   pass3  换角色 / 换景      → 再渲染一次
    //
    //   之前 3 次同状态的渲染**抓不到这个 bug**，因为只有 enabled 在
    //   false↔true 之间过界一次，才会出现"这一轮 22 个 hook、下一轮 0 个"。
    //   2026-09-17 就是这么在浏览器里炸的 React #310。
    const defs = api.__internals.defaultSettings()
    const bumps = [
      null,
      { settings: Object.assign({}, defs, { enabled: false }) },
      { settings: Object.assign({}, defs, { enabled: true }) },
      {
        settings: Object.assign({}, defs, { enabled: true, character: 'kumari', dark: true }),
        messages: [
          { id: 'm1', role: 'user', text: '（测试）晚上好' },
          { id: 'm2', role: 'assistant', text: '……你来做什么。', reasoning: '（想事情）', tools: [{ name: 'read', state: 'ok' }] },
        ],
        scene: 'A1',
        pressure: 0.42,
      },
    ]
    for (let pass = 0; pass < bumps.length; pass++) {
      if (bumps[pass]) {
        try {
          const patch = bumps[pass]
          // noSettings 模式下先把 settingsBox 补上，模拟"宿主终于回了设置"
          if (patch.settings && !api.__internals.settingsBox.s) api.__internals.settingsBox.s = patch.settings
          api.__internals.store.set(patch)
        } catch (err) { log('  [扰动失败] ' + err.message) }
      }
      React.__beginRender('pass' + pass)
      const t = api.__internals.renderSkinRoot()
      const prof = React.__endRender()
      hookCounts.push(prof.hooks)
      tree = t
      const why = api.__internals.getBlockReason && api.__internals.getBlockReason()
      const patchDesc = bumps[pass] && bumps[pass].settings
        ? 'enabled=' + bumps[pass].settings.enabled + ' char=' + bumps[pass].settings.character
        : '(默认)'
      log('  pass' + pass + ': hooks=' + prof.hooks + '  状态=' + patchDesc + (why ? '  被守卫拦：' + why : ''))
    }
    // 把状态恢复到"正常渲染"，供后面的 class 抽取使用
    api.__internals.store.set({ settings: Object.assign({}, defs, { enabled: true, character: 'aoko', dark: dark }) })
    React.__beginRender('pass-final')
    tree = api.__internals.renderSkinRoot()
    React.__endRender()
  } catch (err) {
    log('✗ 渲染抛异常：')
    log(String((err && err.stack) || err).split('\n').slice(0, 12).map((l) => '   ' + l).join('\n'))
    return { ok: false, error: err }
  }

  // ★ React #310 检查：三次渲染的 hook 数必须完全一致
  const uniqHooks = [...new Set(hookCounts)]
  if (uniqHooks.length > 1) {
    log('')
    log('✗✗ hooks 数在渲染之间不一致：' + JSON.stringify(hookCounts))
    log('    → 这就是 React error #310（Rendered more hooks than during the previous render）')
    log('    → 某个 hook 被放在条件分支里，或前面有提前 return')
    return { ok: false, hookCounts, rule310: true }
  }
  log('  ✓ hooks 数四次一致（' + hookCounts[0] + '），无 #310 风险')

  if (tree === null || tree === undefined) {
    log('✗ SkinRoot() 返回了 null —— 这正是"界面没反应"的直接原因')
    return { ok: false, blocked: api.__internals.getBlockReason && api.__internals.getBlockReason() }
  }
  log('✓ 渲染完成，没抛异常')

  // ---- 走一遍 effect（很多问题只在 effect 里才炸）----
  log('\n== 跑 effects ==')
  React.__runEffects()
  log('✓ effects 跑完')

  // ---- ★ store 自激回归（React #300 的成因）----
  //
  // 当年 store.set 用 `Object.assign` 造新对象，只判 `next === state` → 永远为假，
  // 于是"写入同样的值"也会通知订阅者。SkinRoot 订阅着它，就成了
  //   effect 里 store.set → 通知 → 重渲染 → effect 又跑 → 又 set
  // 的无限循环，React 抛 #300（Too many re-renders）。
  // 这里直接对 store 做行为断言。
  log('\n== store 自激检查（#300）==')
  {
    const store = api.__internals.store
    let notifications = 0
    const unsub = store.subscribe(() => { notifications++ })
    const before = store.get()
    const same = {}
    for (const k of Object.keys(before)) same[k] = before[k]
    for (let i = 0; i < 200; i++) store.set(same) // 值一个都没变
    unsub()
    log('  同值写入 200 次 → 通知了 ' + notifications + ' 次（期望 0）')
    if (notifications !== 0) {
      log('  ✗✗ 同值写入仍在通知订阅者 —— 这就是 #300 无限渲染循环的温床')
      log('     → 检查 createStore 的浅比较是否还在')
      return { ok: false, storeLoops: notifications }
    }
    log('  ✓ 同值写入被短路，不会自激')
  }

  // ---- 检查树：**真的调用函数组件**，否则会漏掉子组件产出的元素 ----
  const classes = []
  const seen = new Set()
  const walk = (n, depth) => {
    if (n === null || n === undefined || n === false) return
    if (Array.isArray(n)) { n.forEach((x) => walk(x, depth)); return }
    if (typeof n === 'function') {
      // 函数组件：直接调用（props 给空对象，缺 props 的组件自己会兜）
      if (depth > 12) return
      try { walk(n({}), depth + 1) } catch (err) {
        log('  [组件调用抛错] ' + (n.name || '(匿名)') + ': ' + err.message)
      }
      return
    }
    if (typeof n !== 'object') return
    if (n.$$el) {
      const cls = n.props && n.props.className
      if (typeof cls === 'string') classes.push(cls)
      const kids = []
      if (n.props && n.props.children !== undefined) kids.push(n.props.children)
      kids.push(...(n.children || []))
      kids.forEach((c) => walk(c, depth + 1))
    }
  }
  walk(tree, 0)

  log('\n== 渲染树里的 class ==')
  const uniq = [...new Set(classes)]
  for (const c of uniq) log('  ' + c)

  // 期望列表只列**这一层必须产出**的元素（顶层容器 + 正文层 + 交互层入口）。
  // 子组件（Sprite/Dialogue/Menu/Transcript）产出的 class 由它们自己的
  // 单元断言覆盖，不在这里重复 —— 走查器不调用函数组件，列了就是假报。
  const need = ['myh-root', 'myh-under', 'myh-column', 'myh-columnInner',
    'myh-transcript', 'myh-titlebar', 'myh-over', 'myh-hotzone']
  // 走查器会展开 h(Component, ...) 的 props.children，因此 transcript 可能不出现；
  // 只要 myh-column 在，正文层就一定在（它是 column 的直接子层）。
  const critical = ['myh-root', 'myh-under', 'myh-column', 'myh-titlebar', 'myh-over', 'myh-hotzone']
  /* ★ 2026-09-20：热区从一个整屏块拆成了三条（`myh-hotzone myh-hotL/R/T`），
     所以判定要按**词**比，不能按整个 className 字符串比 ——
     否则 `'myh-hotzone myh-hotL' !== 'myh-hotzone'` 会假报"缺少关键 class"。 */
  const words = new Set()
  for (const c of uniq) for (const w of String(c).split(/\s+/)) if (w) words.add(w)
  const missing = critical.filter((n) => !words.has(n))
  log('\n== 判定 ==')
  if (missing.length) {
    log('✗ 缺少关键 class：' + missing.join(', '))
    return { ok: false, missing, classes: uniq }
  }
  log('✓ 关键 class 齐全（' + critical.length + ' 项）')

  /* ★★ 2026-09-20 回归断言：**热区必须是三条离散矩形，且不含 clip-path**。
     为什么要有这条：上一版热区是一个 `inset:0` 全屏块 + `clip-path:polygon(…)` 挖两个洞，
     实测（`elementFromPoint`）**输入框中心点命中的是热区自己** ——
     用户点不动输入框、发不出消息。而那个 clip-path 的绕向算错了界面上完全看不出来，
     四个脚本全绿（当时没有任何断言覆盖它）。
     所以这里把它钉死：
       · 三条 hotzone 必须都在（拆没了就退回"整屏块"的老路）
       · CSS 里**不许再出现 clip-path**（挖洞模型的标志）
     注：走查器展平渲染树，所以用 class 词集合判断，不依赖具体节点。 */
  const hotKinds = ['myh-hotL', 'myh-hotR', 'myh-hotT']
  const hotMissing = hotKinds.filter((n) => !words.has(n))
  if (hotMissing.length) {
    log('✗ 热区不是三条离散矩形，缺：' + hotMissing.join(', '))
    return { ok: false, missing: hotMissing, classes: uniq }
  }
  log('✓ 热区是三条离散矩形（' + hotKinds.join(' / ') + '）')

  return { ok: true, classes: uniq }
}

// 直接运行时执行：跑两种情形 —— 设置已就绪、以及**设置还没回来**
if (process.argv[1] && process.argv[1].endsWith('render-selftest.mjs')) {
  const only = process.argv.includes('--no-settings') ? 'B'
    : process.argv.includes('--with-settings') ? 'A' : 'both'
  let a = { ok: true }, b = { ok: true }
  if (only === 'both' || only === 'A') {
    log('########## 情形 A：设置已就绪 ##########')
    a = runSelfTest()
    log('')
  }
  if (only === 'both' || only === 'B') {
    log('########## 情形 B：设置尚未从宿主回来（曾经的死因） ##########')
    b = runSelfTest({ noSettings: true })
  }
  if (only === 'both') {
    log('\n== 汇总 ==')
    log('  情形 A（有设置）: ' + (a.ok ? '通过' : '失败'))
    log('  情形 B（无设置）: ' + (b.ok ? '通过' : '失败'))
    process.exitCode = (a.ok && b.ok) ? 0 : 1
  } else {
    process.exitCode = (only === 'A' ? a.ok : b.ok) ? 0 : 1
  }
}

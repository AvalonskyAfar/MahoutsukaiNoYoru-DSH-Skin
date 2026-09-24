/**
 * dsh-skin-mahoyo —— 《魔法使之夜》DSH 皮肤 · 浏览器半边
 * ==========================================================================
 * 手工编写的 `__ModuleLoader__` bundle（无构建步骤，无 npm 依赖）。
 * 只用外壳播种的静态模块：`react` / `react/jsx-runtime`。
 *
 * 装配方式（依据本机离线调研，见 dsh-skin-plugin-research.md）：
 *   - `shell.overlay`（root 作用域 list 槽）→ **整屏皮肤根**。
 *     该层 `position:absolute; inset:0; z-index:20`，本身 `pointer-events:none`，
 *     但**直接子元素自动 pointer-events:auto** —— 正好是整屏覆盖层要的语义。
 *     ⚠ 绝不注册进 `root`（单槽，会顶掉整个 AppFrame）。
 *   - `conversation.input.right`（session 作用域 list 槽）→ **静默传感器**。
 *     session 作用域才拿得到 `useChat` / `useSession` / `useProjection`，
 *     传感器渲染 null，只把数据写进共享 store，供皮肤根读取。
 *   - 服务访问：**一律用 `ctx.get(name)`，不要读 `ctx.<服务>` 属性**
 *     —— 实测属性读取在未声明 inject 时会抛
 *     （`cannot get property "..." without inject`，本包 inject 只有 ['slots']），
 *     而 `get()` 无 inject 要求、缺席返回 undefined，正是要的降级语义。
 *     涉及 `sessions`（开/建会话）、`layout`（侧栏）、`remote`（工作区/目录选择器）、
 *     `commandUi`（斜杠命令）。
 *
 * 设计约束（docs/15 §4 / §9.1，不得绕过）：
 *   - 不做任何数值系统：无好感度 / 等级 / 进度 / 解锁
 *   - 阅读态什么都没有：背景 + 立绘 + 正文暗带 + 落叶指示器
 *   - 装饰件永不拉伸，内容区永远按比例
 *   - 聚焦态只加发光细边（#58FFFD / #E2FFFF），填充与尺寸不变
 *   - 图片一律 object-fit: cover（docs/15 §5.4），永不拉伸变形
 *   - 可用选择器只有 `data-*` 与 `role`（本机**不存在** data-dsh-surface/part）
 */
window.__ModuleLoader__.load({
  id: 'dsh-skin-mahoyo',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const jsxRuntime = require('react/jsx-runtime')
    const ReactDOMClient = require('react-dom/client')

    /**
     * ★★ 构造元素一律用 `React.createElement`，**不要用 `react/jsx-runtime` 的 `jsx`**。
     *
     * 实测（本机 DSH 0.1.5-rc.1，用自检在浏览器里跑出来的）：
     *
     *   h('div', {c}, child, 'TEXT')  →  props.children === undefined
     *   React.createElement(...)      →  props.children === [span, 'TEXT']  ✅
     *
     * 渲染到 DOM 的对照更直白：
     *   h()             →  <div class="myh-probe-a"></div>                  ← 空的
     *   createElement() →  <div class="myh-probe-b"><span…></span>TEXT</div> ✅
     *
     * 也就是说外壳播种的 `jsx` 只接受 `(type, props)` **两个参数**，
     * 变长 children 被静默丢弃 —— 不报错、不警告，元素照建，就是没内容。
     *
     * 这个坑让整个皮肤"根容器渲染出来了、尺寸也对、里面永远是空的"，
     * 排查了好几轮。`createElement` 是 classic runtime，签名天然变长，
     * 而且官方 bundle 里的 `jsx(type, props)` 两参调用它也一样吃。
     *
     * 保留 `h` 这个名字，是为了让全文件 400+ 处调用点不用改。
     */
    const h = React.createElement
    const Fragment = jsxRuntime.Fragment || React.Fragment
    const { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } = React

    // ==================================================================
    // §0 常量与小工具
    // ==================================================================

    // 构建指纹：install.ps1 会把它替换成实际值。
    // 用途：探针把它报回宿主，就能一眼对齐"源码 / 安装 / 浏览器实际运行"三者，
    //      不再出现"我以为在跑新代码、其实浏览器跑的是旧字节"这种排查黑洞。
    const BUILD_ID = 'dev-未注入'

    const ROUTE = '/moye-skin'

    /** 冲突优先级（spec-switching §4.5：强情绪优先）。 */
    const PRIORITY = ['surprised', 'angry', 'glare', 'sad', 'shy', 'laugh',
      'smile', 'troubled', 'tired', 'think', 'serious', 'neutral']

    const DEFAULT_FALLBACK = {
      laugh: ['smile', 'neutral'], sad: ['troubled', 'neutral'], shy: ['troubled', 'neutral'],
      tired: ['neutral', 'think'], think: ['neutral'], angry: ['serious', 'neutral'],
      glare: ['serious', 'neutral'], smile: ['neutral'], troubled: ['neutral'],
      serious: ['neutral'], surprised: ['neutral'], neutral: [],
    }

    /** 角色 → 昼/夜景号（scenes.json / 用户 2026-09-16 决议）。 */
    const SCENE_OF = {
      aoko: { light: 'A3', dark: 'A4' },
      alice: { light: 'A1', dark: 'A2' },
      kumari: { light: 'A5', dark: 'A6' },
    }
    const CHARACTERS = ['aoko', 'alice', 'kumari']
    const CHARACTER_CN = { aoko: '苍崎青子', alice: '久远寺有珠', kumari: '久万梨金鹿' }   /* ★ 2026-09-22：原为繁体（蒼/遠/萬），与人格切片的简体口径不一致，已统一 */
    /** 表紙（home）用的壳景：昼/夜。 */
    /**
     * ★★★ 2026-09-22（用户第 5 条）：**L1 表紙的壳景按角色分**。
     *
     * 原话：「L1界面我应该是给每个角色的界面都分了两张图的，但现在的不会跟着换」。
     * 病因：这里原来是一个**写死的常量** `{light:'B3', dark:'B4'}` ——
     * 那是**青子**的那一对，于是换到有珠/金鹿，L1 背景依然是青子的标题画面。
     *
     * 归属依据 `docs/12-交接-选景.md` 的「B · 初始界面景」表（用户当时逐条指定的）：
     *   B1 久遠寺有珠 · 白天 · 洋房外面      B2 久遠寺有珠 · 夜晚 · 洋房外面
     *   B3 蒼崎青子 · 白天 · 魔夜本身的界面  B4 蒼崎青子 · 夜晚 · 章节封面
     *   B5 久万梨金鹿 · 白天                B6 久万梨金鹿 · 夜晚
     * 六张都在 `manifest.scenes` 里（`role:"shell"`、各带 `tone`），**无需改 manifest**。
     * 缺角色/缺值一律退回青子那对（历史行为，旧配置不会变样）。
     */
    const SHELL_OF = {
      aoko: { light: 'B3', dark: 'B4' },
      alice: { light: 'B1', dark: 'B2' },
      kumari: { light: 'B5', dark: 'B6' },
    }

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
    const cls = function () {
      let s = ''
      for (let i = 0; i < arguments.length; i++) if (arguments[i]) s += (s ? ' ' : '') + arguments[i]
      return s
    }

    function isDarkBody() {
      return typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme')
    }

    /** 极简可订阅 store（React 内外共用）。 */
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      /** 写入频率窗口：用来发现"effect 自激"这类无限循环。 */
      const loopWin = { start: Date.now(), n: 0, keys: {}, tripped: false }
      /** 浅比较：只要每个键的值都相同，就认为状态没变。 */
      function sameShallow(a, b) {
        if (a === b) return true
        if (!a || !b) return false
        const ka = Object.keys(a)
        const kb = Object.keys(b)
        if (ka.length !== kb.length) return false
        for (let i = 0; i < ka.length; i++) {
          const k = ka[i]
          if (!Object.prototype.hasOwnProperty.call(b, k)) return false
          if (a[k] !== b[k]) return false
        }
        return true
      }
      return {
        get: function () { return state },
        set: function (patch) {
          const next = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch)
          if (next === state) return
          // ★★★ 必须有这一条浅比较。
          //   `Object.assign` **每次都造一个新对象**，所以只判 `next === state`
          //   等于永远为假 —— 哪怕写入的值一个字都没变，也会通知所有订阅者。
          //   而 SkinRoot 通过 useSyncExternalStore 订阅了它：
          //   "effect 里 store.set → 通知 → 重渲染 → effect 又跑 → 又 set"
          //   就会变成无限渲染循环，React 抛 #300（Too many re-renders）。
          //   2026-09-17 实测撞到过。有了这一条，同值写入直接短路。
          if (sameShallow(next, state)) return

          // ★★ 循环检测：浅比较挡不住"真的每次都在变"的值。
          //    这里的目的是 ①留下是哪个键在疯的硬证据 ②**真的把用户救出来**
          //    —— 检测到失控就不再通知订阅者（界面定格但不再刷屏），
          //    而不是让 React 一直转下去。
          const now = Date.now()
          if (now - loopWin.start > 500) { loopWin.start = now; loopWin.n = 0; loopWin.keys = {} }
          loopWin.n++
          if (patch && typeof patch === 'object') {
            for (const k in patch) loopWin.keys[k] = (loopWin.keys[k] || 0) + 1
          }
          if (loopWin.n > 120 && !loopWin.tripped) {
            loopWin.tripped = true
            const top = Object.keys(loopWin.keys)
              .sort(function (a, b) { return loopWin.keys[b] - loopWin.keys[a] })
              .slice(0, 6)
              .map(function (k) { return k + '×' + loopWin.keys[k] })
            try {
              reportToHost({
                stage: 'store-loop',
                autoProbe: { writesPer500ms: loopWin.n, topKeys: top, state: JSON.stringify(next).slice(0, 600) },
              })
            } catch { /* ignore */ }
            try {
              console.error('[moye-skin] store 写入失控（500ms 内 ' + loopWin.n + ' 次），已停止通知订阅者。'
                + ' 高频键：' + top.join(', '))
            } catch { /* ignore */ }
            try { noteWarning('store 写入失控：' + top.join(', ')) } catch { /* ignore */ }
            return
          }
          state = next
          listeners.forEach(function (l) { try { l() } catch (_e) { /* 隔离订阅者异常 */ } })
        },
        subscribe: function (l) { listeners.add(l); return function () { listeners.delete(l) } },
      }
    }

    /**
     * 素材 URL：manifest 里存的是 assets 下的相对路径。
     *
     * ★★ 2026-09-19：必须带 `?v=<BUILD_ID>` 破缓存。
     *   宿主的素材路由发的是 `cache-control: public, max-age=86400`，
     *   而**素材文件名在重烘之后是不变的**（`stage_a4_neutral_0.png` 永远叫这个名）。
     *   于是同一台机器上重装了新立绘，浏览器照样用缓存里的旧图 ——
     *   实测后果：把"紧裁版（头顶被切平）"换成"整画布版"之后，
     *   用户看到的是**一模一样**的画面（这不是错觉，是缓存）。
     *   BUILD_ID 每次安装都会变（`install.ps1` 里是 SHA256 前缀 + 时间戳），
     *   挂上去就等于给每份素材一个随安装变化的 URL；缓存仍然有效，但换包即失效。
     */
    const assetURL = function (rel) {
      if (!rel) return ''
      const s = String(rel).replace(/^\/+/, '')
      if (/^(https?:|\/)/.test(s)) return s
      return ROUTE + '/assets/' + s + '?v=' + encodeURIComponent(BUILD_ID)
    }

    // ==================================================================
    // §0.5 紧急开关（Kill Switch）—— 出事时的浏览器侧逃生门
    // ==================================================================
    //
    // 三级入口，任何一级命中就**彻底不渲染皮肤**（连 CSS 都不注入）：
    //
    //   1. `localStorage['moye-skin:kill'] === '1'`
    //   2. URL 带 `?mahoyo=off`（自动持久化，刷新后仍然生效）
    //   3. 运行时按 **Ctrl+Shift+M**（会写入 localStorage 并就地卸载皮肤）
    //
    // 为什么要有它：皮肤整个渲染在 `shell.overlay` 上，如果布局出现灾难性问题，
    // 用户需要一个**不依赖菜单、不依赖 DSH 重启**的关闭方式。
    // 恢复：URL 加 `?mahoyo=on`，或控制台执行
    //   `localStorage.removeItem('moye-skin:kill')` 然后刷新。
    //
    const KILL_KEY = 'moye-skin:kill'

    function readKill() {
      try {
        // URL 参数优先级最高，并顺手持久化
        const q = new URLSearchParams(location.search).get('mahoyo')
        if (q === 'off') { localStorage.setItem(KILL_KEY, '1'); return true }
        if (q === 'on') { localStorage.removeItem(KILL_KEY); return false }
        return localStorage.getItem(KILL_KEY) === '1'
      } catch {
        return false   // 隐私模式等场景下 localStorage 不可用 → 当作没开
      }
    }

    /** 已经卸载过就不再重复执行。 */
    let killed = false

    /**
     * 皮肤"被关闭"时给用户一个**看得见**的提示。
     *
     * 为什么必须看得见：关闭标记写在 localStorage 里，一旦写下就**每次刷新都生效**。
     * 如果只往 console 打一行，用户看到的就是"皮肤莫名其妙不工作，一条错都没有"。
     * 所以这里放一条右下角小横幅 + 一个"恢复"按钮。
     *
     * 纯 DOM 实现，不依赖 React（皮肤根这时候可能已经没了）。
     */
    /**
     * 关闭态横幅 —— 关闭状态下**唯一的线索**，而且必须是够用的线索。
     *
     * 三条出路都写在横幅上（横幅本身可能被用户无视，所以出路不能只有一条）：
     *   ① 点「恢复皮肤」按钮 —— 把两道闸一起打开再重载
     *   ② `Ctrl+Shift+U` —— 同一件事的键盘版
     *   ③ 地址栏 `?mahoyo=on`
     *
     * @param {string} reason 给人看的原因
     * @param {'localStorage'|'settings'} from 是哪道闸关的（决定按钮怎么做）
     */
    function showKilledBanner(reason, from) {
      try {
        if (document.getElementById('myh-killed-banner')) return
        const bar = document.createElement('div')
        bar.id = 'myh-killed-banner'
        // ★ 做得**一眼能看见**：太小的横幅等于没有 ——
        //   用户只会看到"皮肤莫名其妙失效了"，然后去怀疑 DSH 而不是皮肤。
        // ★ 2026-09-19 修正两条（用户实测：横幅盖住 DSH 审批卡的「批准/拒绝」）：
        //   ① 整个横幅 `pointer-events:none`，只有按钮自己 `auto`
        //      —— 这样即使视觉上重叠，点击也会穿透到 DSH 的按钮上；
        //   ② 从"右下角"移到**右侧垂直居中**：右下角正是 composer /
        //      审批卡 takeover 的地盘，压上去就出事。
        bar.setAttribute('style', [
          'position:fixed', 'right:16px', 'top:50%', 'transform:translateY(-50%)',
          'z-index:2147483600', 'pointer-events:none',
          'max-width:340px', 'padding:12px 14px', 'border-radius:8px',
          'background:rgba(6,15,22,.98)', 'border:2px solid #58FFFD',
          'color:#E9E4D8', 'font:13px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif',
          'box-shadow:0 8px 28px rgba(0,0,0,.6)',
        ].join(';'))
        const msg = document.createElement('div')
        msg.textContent = '「魔法使之夜」皮肤当前处于关闭状态（' + reason + '）。'
        const how = document.createElement('div')
        how.setAttribute('style', 'margin-top:6px;opacity:.82;font-size:12px')
        how.textContent = '恢复方式：点下面的按钮，或按 Ctrl+Shift+U，或在地址栏加 ?mahoyo=on。'
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = from === 'settings' ? '重新启用皮肤' : '恢复皮肤'
        btn.setAttribute('style', [
          'margin-top:9px', 'padding:6px 14px', 'cursor:pointer', 'pointer-events:auto',
          'background:#0b1d24', 'color:#DFF3F7', 'border:1px solid #58FFFD',
          'border-radius:5px', 'font:inherit', 'font-weight:600',
        ].join(';'))
        // ★ 恢复必须把**两道闸**都打开（localStorage 标记 + settings.enabled）。
        //   原来只清了 localStorage —— 如果 settings.enabled 也是关的，用户
        //   点了"恢复皮肤"、页面刷新了、然后**还是默认界面**，非常挫败。
        btn.addEventListener('click', function () {
          restoreSkin(from === 'settings' ? '点击横幅（设置项）' : '点击横幅按钮')
        })
        bar.appendChild(msg)
        bar.appendChild(how)
        bar.appendChild(btn)
        document.body.appendChild(bar)
      } catch { /* 尽力而为 */ }
    }

    /** 就地把皮肤摘干净：属性、样式标签、崩溃占位、组件树。 */
    function killSkin(reason) {
      if (killed) return
      killed = true
      try { localStorage.setItem(KILL_KEY, '1') } catch { /* 存不下也要继续摘 */ }
      try {
        document.body.removeAttribute('data-myh-skin')
        document.body.removeAttribute('data-myh-tabs')
        // 输入框方位也写在 documentElement 上，关闭时要一起摘掉，
        // 否则"皮肤关了、输入框还靠右"会留在页面上。
        document.documentElement.removeAttribute('data-myh-side')
        const tag = document.querySelector('style[data-plugin="dsh-skin-mahoyo"]')
        if (tag) tag.remove()
        document.documentElement.setAttribute('data-myh-killed', '1')
        const roots = document.querySelectorAll('.myh-root')
        for (let i = 0; i < roots.length; i++) roots[i].style.display = 'none'
        sweepCrashFaces()
        unmountSkinRoot()
        // ★★ 2026-09-20：把 jsx 自检留下的探针也扫掉。
        //   用户原话是"**皮肤关掉了也能往下滑一点**" —— 正因为这些 holder 挂在
        //   `document.body` 上（皮肤层之外），`killSkin` 只隐藏 `.myh-root` 是够不着它们的。
        //   正常路径下 `disposeProbe` 已经撤掉了；这里兜的是"自检还没跑完就被关掉"的时序。
        sweepProbeHolders()
        // 就地关闭 → 关闭标记写在 localStorage 那道闸上
        showKilledBanner(reason, 'localStorage')
        console.warn('[moye-skin] 皮肤已就地关闭（' + reason + '）。' +
          '恢复：点右下角横幅的「恢复皮肤」按钮，按 Ctrl+Shift+U，或地址栏加 ?mahoyo=on。')
      } catch { /* 尽力而为 */ }
    }

    /**
     * 清掉 DSH 插槽错误边界留下的崩溃占位。
     *
     * 皮肤崩了的时候，DSH 自己的 `SlotErrorBoundary` 会把它换成一个
     * **空的 `<div data-slot-error="shell.overlay">`** —— 对用户来说就是"界面被抠掉一块"。
     * 我们自己的边界能挡住渲染异常，但挡不住"DHS 的边界先一步接管"，
     * 所以这里在关闭皮肤时顺手把这些占位节点摘掉，把界面还给用户。
     */
    function sweepCrashFaces() {
      try {
        const faces = document.querySelectorAll('[data-slot-error]')
        for (let i = 0; i < faces.length; i++) {
          const el = faces[i]
          el.remove()   // 占位节点本身是空的，直接摘掉最干净
        }
      } catch { /* ignore */ }
    }

    const KILLED_AT_LOAD = readKill()

    /**
     * 向宿主报到 —— 这是「客户端 bundle 到底跑没跑」的唯一硬证据。
     *
     * 排查逻辑（宿主 GET /moye-skin/health）：
     *   · `diag.clientSeen === false`
     *     → 客户端 bundle 根本没到浏览器（组合/下发问题，不是注册问题）
     *   · `diag.clientSeen === true` 但界面没变
     *     → 客户端跑起来了，问题在注册/渲染，看 `diag.clientErrors`
     *
     * 整个过程**绝不抛错**：报不到就算了，不能因此影响皮肤本身。
     */
    function reportToHost(extra) {
      try {
        // ★ 每次上报都带上"哪一份实例"和 hooks 取证。
        //   注意：hookFrames / INSTANCE_ID 声明在后面，理论上存在 TDZ；
        //   外面这层 try 就是为了那种情况（宁可少两个字段，也不能让上报本身炸掉）。
        let hookInfo = null
        try {
          hookInfo = { instance: INSTANCE_ID, hooks: readHookCount(), frames: hookFrames.slice(-6) }
        } catch { hookInfo = null }
        fetch(ROUTE + '/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({
            // ★ 构建指纹放最前：任何一次报到都能回答"跑的是哪一份代码"
            build: BUILD_ID,
            instance: (function () { try { return INSTANCE_ID } catch { return null } })(),
            hooks: hookInfo ? hookInfo.hooks : null,
            hookFrames: hookInfo ? hookInfo.frames : null,
            href: String(location.href).slice(0, 200),
            dark: isDarkBody(),
            hasLoader: !!window.__ModuleLoader__,
            hasBoot: !!window.__DSH_BOOT__,
            killed: killed || KILLED_AT_LOAD,
            ua: String(navigator.userAgent).slice(0, 140),
          }, extra || {})),
          keepalive: true,
        }).catch(function () { /* 报不到就算了 */ })
      } catch { /* 同上 */ }
    }

    // ==================================================================
    // §1 CSS
    // ==================================================================

    const CSS = [
      /* ================================================================
         ---- 变量：魔夜实测配色（docs/03 §2 / docs/04 §2.2） ----

         ★★★ 2026-09-20：**变量必须挂在 `:root`（`<html>`），不能挂在皮肤根上**。

         病根（实测复现，见 `.tmp` 里的 vartest 页）：
           CSS 自定义属性**只沿 DOM 树继承**。皮肤根 `#myh-skin-root` 挂在
           `document.body` 下，而 **DSH 的 composer 在 DSH 自己的 DOM 里、
           不在皮肤根的子树内** —— 两边是"堂兄弟"，不是"父子"。
           于是写在皮肤根上的 `--myh-composer-grad` 传不到 composer，
           `<div data-composer-card>{background:var(--myh-composer-grad)}`
           解析成**无效声明**（`var()` 无兜底值且变量不存在时整条作废）→
           卡片**一个像素的底色都没有** → 用户看到的就是"没有输入框"。

           对照实验（800×400 视口）：
             变量挂在皮肤根上   → background = none（拿不到）
             变量挂在 :root 上  → background = linear-gradient(...)（正常）

         所以：**凡是 composer 要读的变量，一律声明在 `:root`。**
         这条对整个项目都适用 —— 任何"皮肤要给 DSH 原生元素用"的变量都在这里。
         （`body[data-myh-skin]` 上的老变量保留不动：它们只被皮肤自己的子树读，
           挂哪儿都行，不必迁移。）
         ================================================================ */
      ':root{',
      /* ★ composer 的兜底值 —— 取自 `sel_win.cbg.png` **逐像素实测**（见 1h 段长注释）。
         中档：填充 rgb(26,100,131) / 顶 rgb(61,250,252) / 底 rgb(42,165,244)
         主体 alpha 216/255 ≈ 85%（原作本来就半透明） */
      '--myh-input-h:88px;',
      '--myh-composer-grad:linear-gradient(180deg,rgba(26,100,131,.85) 0%,rgba(26,100,131,.85) 100%);',
      '--myh-cap-top:rgba(61,250,252,.95);--myh-cap-bot:rgba(42,165,244,.95);',
      '--myh-composer-glow:rgba(42,165,244,.95);',
      /* 明朝体也上移：composer 的输入文字要读它（`[data-composer-card] *{font-family:…}`） */
      '--myh-mincho:"Yu Mincho","YuMincho","Hiragino Mincho ProN","Songti SC",',
      '"Source Han Serif SC","Noto Serif SC","SimSun",serif;',
      /* ★★★ 2026-09-23：等宽体（Markdown 的行内代码 / 代码块用）。
         此前全文件没有这个变量 —— 正文层第一次需要"非明朝体"的排版。
         中文回退放最后：代码块里夹中文时（注释、字符串）不掉到系统默认。 */
      '--myh-mono:"Cascadia Mono","Consolas","Menlo","DejaVu Sans Mono",',
      '"Courier New","Microsoft YaHei",monospace;}',
      'body[data-myh-skin]{',
      '--myh-ink:#060F16;--myh-mist:#F0EDE5;--myh-glow:#308198;--myh-warm:#F3E4D2;',
      '--myh-focus-text:#58FFFD;--myh-focus-btn:#E2FFFF;',
      /* ★★★ 2026-09-21：**按住文档级滚动链**（用户报的"滑到底继续滑、输入框跳"）。
         真实窗口里"被带走的祖先"未必是皮肤根 —— DSH 自己的
         `.wSkVaW_scrollBody` / body / html 都可能承接溢出的滚动量。
         这里把文档级两处都标 `contain`：文字列滚到底之后，
         多余的滚动量**在列内部就被吃掉**，不会再往外传。
         ⚠ 只写在皮肤根上不够（实测能复现祖先被带走 300px）。 */
      'overscroll-behavior:contain;}',
      /* 同理按住 html —— `body[data-myh-skin]` 只在皮肤生效时存在，
         而滚动链的判定可能发生在更外层，所以两条都写。 */
      'html:has(body[data-myh-skin]){overscroll-behavior:contain}',
      /* ================================================================
         ★★★ 2026-09-20：**DSH 浮层重新着色**（模型选择 / 权限 / 斜杠菜单 / 文件选择）

         【问题】皮肤是"整屏重绘"的深墨蓝画面，而 DSH 的原生浮层
         （模型选择 `_7KE1Ra_*`、权限预设 `oY77xG_*`、命令面板 `mufS8W_*`、
           输入触发 `_3e4SsG_*`）是**浅色档的纯白卡片**（`#fff` + `#0f1115` 字），
         压在深色画面上像一块补丁，和皮肤完全不是一个世界。

         【为什么不逐个改类名】那些类名是**带哈希的 CSS Modules**
         （`mufS8W_card` / `_7KE1Ra_cell` / `oY77xG_row` …），DSH 一升级就全变。
         而它们**全部只读一套设计 token**（`--dsw-*`），token 名是稳定的。
         所以这里**只覆写 token**：一处生效，全家族统一，且不怕版本更新。

         【实测数据】`--dsw-specific-menu` 就是浮层底色（→ `--dsw-alias-bg-layer-3`）：
           浅色档 = `#fff`   主文字 `#0f1115`（白卡片）
           深色档 = `#353638` 主文字 `#f9fafb`（中性灰卡片，对比度 11.6:1）
         —— 用户当前 DSH 主题是 `preference: system`，跑在**浅色档**，所以看到的是白卡片。

         【覆写策略】两档**都**指向墨蓝系，让浮层与皮肤同族。
         底色用 `#0B1620` + 0.94 alpha：既明确是"浮在画面上的板"，
         又能透出一点点底下的立绘，和原作菜单板的半透明观感一致。
         对比度（按 `#0B1620` 实色算）：主文字 ≈ 15.6:1、三级文字 ≈ 5.6:1、聚焦青 ≈ 12:1，
         都过 WCAG AA。`!important` 是必须的 —— DSH 自己用 `body{}` 定义这些变量，
         皮肤注入的样式表要压过它。 */
      ':root,body[data-myh-skin]{',
      /* 浮层底：墨蓝主体（`docs/03` §6 的 `#0B1620` 一带） */
      '--dsw-specific-menu:rgba(11,22,32,.94)!important;',
      /* ★★★ 2026-09-23（用户：「已完成事项的 UI，修改成与整体设计一致」）：
         底部那条**原生待办栏**（`SECTION.lXshSW_root` + `data-testid="todo-panel"`）
         底色走的是 `--dsw-specific-tip`，而它**当时没被覆写** ——
         实测它露出 DSH 浅色档的 `rgb(245,246,247)`，而栏内文字色**已经吃到皮肤 token**
         （`.lXshSW_title → --dsw-alias-label-primary` = #F0EDE5、
           `.lXshSW_progress/.lead/.chevron → --dsw-alias-label-tertiary` = #9FB0B6、
           `.lXshSW_item → --dsw-alias-label-secondary` = #C3C9CB），
         于是**浅字压白底**，观感就是截图里那条看不清的白条。
         这里与 `--dsw-specific-menu` 取同一个墨蓝值，浮层与皮肤同族。 */
      '--dsw-specific-tip:rgba(11,22,32,.94)!important;',
      '--dsw-alias-bg-layer-3:rgba(11,22,32,.94)!important;',
      '--dsw-alias-bg-layer-2:rgba(11,22,32,.94)!important;',
      /* 文字三档：银灰雾白 → 远山灰，取自 `docs/03` §6 实测配色 */
      '--dsw-alias-label-primary:#F0EDE5!important;',
      '--dsw-alias-label-secondary:#C3C9CB!important;',
      '--dsw-alias-label-tertiary:#9FB0B6!important;',
      '--dsw-alias-label-caption:#7E8F96!important;',
      '--dsw-alias-label-primary-dimmed:#B9C4C7!important;',
      /* 悬停 / 选中行：青绿强调色（`#27606A` 一带，半透明压上去） */
      '--dsw-alias-interactive-bg-hover:rgba(39,96,106,.55)!important;',
      '--dsw-alias-interactive-bg-active:rgba(48,129,152,.6)!important;',
      '--dsw-alias-interactive-bg-hover-accent:rgba(48,129,152,.5)!important;',
      /* 描边：原作青绿细线，而不是近乎不可见的透明黑 */
      '--dsw-alias-border-l1:rgba(48,129,152,.45)!important;',
      '--dsw-alias-border-l2:rgba(48,129,152,.35)!important;',
      '--dsw-alias-border-l3:rgba(48,129,152,.3)!important;',
      '--dsw-alias-border-l4:rgba(48,129,152,.25)!important;',
      '--dsw-alias-border-inverted:rgba(48,129,152,.45)!important;',
      /* 浮层投影：深墨底的实投影，替换 DSH 的浅色浮起感 */
      '--dsw-elevation-stroke-color:rgba(48,129,152,.45)!important;',
      '--dsw-elevation-prominent:0 12px 40px rgba(3,8,12,.78),',
      '0 0 0 .5px rgba(48,129,152,.4)!important;',
      '--dsw-elevation-panel:0 12px 40px rgba(3,8,12,.78)!important;',
      /* 胶囊 / 模块底（权限选择器 `oY77xG_selector`、模型 trigger 读它） */
      '--dsw-alias-bg-module-platform:rgba(9,25,35,.82)!important;',
      '--dsw-alias-bg-skeleton:rgba(48,129,152,.16)!important;',
      '--dsw-alias-button-floating-fill:rgba(11,22,32,.9)!important;',
      '--dsw-alias-button-floating-hover:rgba(39,96,106,.75)!important;',
      /* 危险态：保留"红"的语义，但压到墨底上不刺眼（`#FFB4B4` 同 `.myh-noticeErr`） */
      '--dsw-alias-state-error-primary:#FF9C9C!important;',
      '--dsw-alias-interactive-bg-hover-danger:rgba(236,19,19,.22)!important;',
      '--dsw-alias-state-warn-label:#F0C084!important;',
      '}',

      /* ================================================================
         ---- 1. 阅读态：DSH 的原生外壳整体让位 ----
         ★★ 2026-09-16 用户定调后重写：「不是套一层壳，是给 DSH 一个全新 UI，
            内核不偏，整个 UI 完全不同」。

         所以策略不是"把皮肤盖在他界面上"，而是：
           · 皮肤**自己画**正文（见 §7.5 Transcript，数据来自 ChatSnapshot）
           · DSH 原生的会话列表 / 页签栏 / 右栏 / **原生消息列表** 全部让位
           · 唯独 **composer（输入框）保留** —— 发消息的能力是内核的一部分，
             皮肤只把它重新着色成"底部对话框"的样子，不重造它
         ================================================================ */

      /* 1a. frame：只做透明。
         ★ 不再强制 `grid-template-columns` —— 那是在"用 display:none 藏左栏"
         的前提下打的补丁（藏掉之后 Grid 会把中列挪进 0 宽的轨道，见下方 1b 的详解）。
         既然左栏改成**占位式隐藏**，原始网格自己就会把中列放回正确轨道，
         强改反而多一层要维护的耦合。 */
      'body[data-myh-skin] div:has(> [data-shell-overlay]){',
      'background:transparent!important;',
      '}',

      /* ================================================================
         ★★★ 2026-09-20（第四次修，**这才是"输入框/正文一直不显示"的根因**）

         症状（`/moye-skin/health` 的 frame 取证，实测）：

             frame  inline: grid-template-columns: 56px minmax(0px,1fr) 0px
             kids[0] sidebarCol   w=0      display:none    ← 皮肤藏掉的
             kids[1] centerCol    w=0      display:flex    ← 中列被压成 0
             kids[2] rightbarCol  w=1904   display:block   ← 右栏占了整屏

         根因：**CSS Grid 的自动放置（auto-placement）**。
         `display:none` 的元素**不参与 grid 布局**，于是 Grid 把剩下的元素
         **往前挪**填坑：

             中列  本应在第 2 条轨道(1904px) → 被挪到第 1 条轨道(0px)  → 宽 0
             右栏  本应在第 3 条轨道(0px)    → 被挪到第 2 条轨道(1904px) → 宽 1904

         中列宽 0 → `wSkVaW_root` 宽 0 → `composerSeat` 宽 0 → hero stack 230px
         → 卡片被挤成 188px。**整条链全是从这一个挪位开始的。**

         ⚠ 这也解释了为什么"改宽度怎么写都没用"：
           包含块是 0 宽时，`width:95%` 解析成 **0**（实测见 `.tmp` 复现页）。
           不是宽度写法不对，是**父宽本来就是 0**。

         修法：**绝不能把网格子元素 `display:none`** —— 必须让它继续占住自己的轨道。
         用 `width:0 + overflow:hidden + visibility:hidden`：
           · 仍然参与 grid 自动放置 → 中列守住第 2 条轨道
           · 宽度确实为 0 → 不占视觉空间
           · 不可见、不可交互 → 与"藏掉"等效
         ================================================================ */

      /* 1b. 左栏（書庫 由皮肤菜单提供）：**占位式隐藏**，不能用 display:none */
      'body[data-myh-skin] div:has(> [data-shell-overlay]) > [class*="sidebarCol"]{',
      'visibility:hidden!important;width:0!important;min-width:0!important;',
      'overflow:hidden!important;pointer-events:none!important}',

      /* 1c. 右栏：同上，占位式隐藏 */
      'body[data-myh-skin] div:has(> [data-shell-overlay]) > [class*="rightbarCol"]{',
      'visibility:hidden!important;width:0!important;min-width:0!important;',
      'overflow:hidden!important;pointer-events:none!important}',

      /* 1d. 拖拽把手 */
      'body[data-myh-skin] [data-side]{display:none!important}',

      /* 1e. 中列透明 */
      'body[data-myh-skin] div:has(> [data-shell-overlay]) > div:not(:first-of-type){background:transparent!important}',

      /* 1f. 顶部页签栏（会话标题/标签那一条）：藏掉 —— 标题由皮肤自己画 */
      'body[data-myh-skin] [role="tablist"]{display:none!important}',

      /* 1g. ★★ 原生会话区整体让位。
             只留 composer（输入）那一段。用 `:has([data-composer-seat])` 从
             结构性钩子确认"这一段里有输入框"，从而把它排除在隐藏范围外。 */
      'body[data-myh-skin] div:has(> [data-shell-overlay]) div:has(> [data-rightbar-col]) ~ *{display:none!important}',

      /* ---- 隐藏原生消息列表，**但必须留住 composer** ----
         ★★★ 2026-09-20 修：原来这里是 `[data-conversation-scroll]{display:none}`，
         注释写着"但保留 composer" —— **实际没保住，而且从来没保住过**。
         读 DSH 源码（`dsh-client-ui-conversation` 的 ConversationRoot）：

             <div class="…scrollBody" data-conversation-scroll>
               {renderSlot("conversation.session", {})}   ← 消息列表（要藏的是这个）
               <div class="…composerSeat" data-composer-seat>…</div>   ← 输入框（必须留）
             </div>

         **composer 是滚动体的子节点**，把滚动体 `display:none` 等于连输入框一起埋掉。
         实测证据：`/moye-skin/health` 的 composer 探针里，
         `hit` 三个元素全部 `true`、计算样式也全部是我们写的值，
         但**每个 rect 都是 `[0,0,0,0]`** —— 元素在 DOM、样式算得出、**没有布局尺寸**，
         这正是"祖先 display:none"的签名。用户看到的那条"输入框"其实是皮肤的对话框本身。

         改法：只藏消息流那一个槽位（`[data-slot="conversation.session"]`），
         容器一律保持可见。这样"发消息的能力"才真正留着（红线：composer 是内核的一部分）。 */
      'body[data-myh-skin] [data-conversation-header-corner]{display:none!important}',
      'body[data-myh-skin] [data-slot="conversation.session"]{display:none!important}',
      /* 原生消息流整块收起（双保险；它是槽位内部的稳定钩子） */
      'body[data-myh-skin] [data-chat-flow]{display:none!important}',

      /* ================================================================
         1h. ★★ composer（输入框）—— 重做成"魔夜的条"（2026-09-20）

         为什么不能只"染个色"：
           DSH 的 composer 是圆角 22px 的气泡卡片（`InputBar` 的 `.…_card`
           写了 `border-radius:22px` + `box-shadow:var(--dsw-elevation-soft)`），
           而 `docs/04` §4 明令禁止的正是"**圆角卡片式**底部文本框"。
           光改背景色，那个气泡的形还在 —— 形才是它是什么东西。

         改法（**沿用 `sel_win` 的构造语言，不新造构件**，见 `docs/04` §1.2）：
           ① 三段式高度 **48 / 72 / 96** —— `sel_win` 是 `86 + 44×(行数−1)`，
              这里按同一 24px 步进做**更矮的三档**：输入框是单行基线，
              照 86px 起会白占画面；
           ② 柱面明暗 `linear-gradient(180deg, 顶, 中 50%, 底)` **整体往"等待你"偏移一档**
              —— 输入框的本质就是"等你"，所以取 `sel_win` 的**中/浅**两档值，
              而不是深档（深档是"空闲/回放历史"，用在输入框上等于让人看不见它）；
           ③ 底部轮廓光（90% 处）—— "条"的立体感就靠这一道；
           ④ 端帽 = `mu_bar`（同一母题的细缠枝纹），**固定像素宽、垂直居中**，永不拉伸。
         ================================================================ */
      'body[data-myh-skin] [data-composer-seat]{background:transparent!important;',
      'padding:0!important}',
      /* 整个 card 变成"满宽的条"：圆角/投影/描边全部撤掉，换柱面明暗 + 轮廓光 */
      'body[data-myh-skin] [data-composer-card]{',
      'border:0!important;border-radius:0!important;',
      'box-shadow:inset 0 -12px 0 -8px var(--myh-composer-glow,rgba(42,160,239,.5))!important;',
      'background:var(--myh-composer-grad)!important;',
      'backdrop-filter:none!important;',
      'transition:background .25s ease,box-shadow .25s ease}',
      /* 输入文字：明朝体 + 袋文字描边（照 `docs/02` A9：不用图像化字库，但保留描边） */
      'body[data-myh-skin] [data-composer-card] *{font-family:var(--myh-mincho)!important}',
      'body[data-myh-skin] [data-composer-input]{color:#FFFFFF!important;',
      'text-shadow:-1px -1px 0 rgba(6,15,22,.95),1px -1px 0 rgba(6,15,22,.95),',
      '-1px 1px 0 rgba(6,15,22,.95),1px 1px 0 rgba(6,15,22,.95)}',
      'body[data-myh-skin] [data-composer-placeholder]{color:rgba(233,228,216,.62)!important;',
      'text-shadow:0 1px 3px rgba(0,0,0,.7)!important}',
      /* 输入框里的按钮（发送/附件/工作区）：同色系，不做彩虹 */
      'body[data-myh-skin] [data-composer-card] button{color:#EAF2F4!important}',
      'body[data-myh-skin] [data-composer-card] button:hover{color:#58FFFD!important}',
      /* ★ 2026-09-20（用户定案）：**端帽装饰整条删除**。
         原先这里用 ::before/::after 在座位上挂两枚 70×14 的 `mu_bar` 细缠枝纹
         （左一枚、右一枚），与卡片右缘那枚卷草纹合计**三处花纹**。
         用户看过实机后要求三处全删 —— 输入框附近不留任何花边。

         注意：删掉的是**装饰**，不是"条"的着色。上下两道描边
         （`--myh-cap-top` / `--myh-cap-bot`，见上面 card 的 inset box-shadow）
         是条本身的立体感来源，**保留**。 */
      'body[data-myh-skin] [data-composer-seat]{position:relative!important}',
      /* ================================================================
         ★★★ 2026-09-20（第三次修）：**百分数宽度在这里是无效的**

         实测（`/moye-skin/health` 的 ancestor 链）：
             centerCol  w=0    ← 皮肤 1a 条把 frame 写成 grid-template-columns:0 minmax(0,1fr) 0
               body    w=0
                 root  w=0
                   seat w=0
                     hero stack w=230px
                       card w=188px  ← 被压成一条

         当**包含块是 0 宽**时，`width:95%` 解析成 **0**（百分数按包含块算）。
         所以之前写的 `width:95%` 根本没起作用，卡片是被祖先链上的 0 卡住的。
         结论：这里必须用**视口单位**，不能用百分数。

         两条一起下：
           ① 宽度用 `calc(100vw - 5%)`（= 与对话框同一条"左右各 2.5%"口径）；
           ② hero 状态中和掉 —— `…_composerHero{padding-bottom:32px; align-self:center}`
              那套是"空会话落地页"的排版，在整屏皮肤里只会把条推高、推歪。
         ================================================================ */
      /* ================================================================
         ★★★★ 2026-09-20（第九次修）：**按 `sel_win` 实物重新实现输入框**

         用户要求：① 像原生那样"悬浮"；② 半透明；③ **照搬「誰でも眠れても笑えない」
         那一章的选项框设计**（位置不照搬）。

         那一章 = スイーツハーツ推理剧（`script_text_ja.ctd` L20415~L24007，
         全篇 29 个 `～選択肢～`，核心前提「一晩笑わない」）。
         它的选项框载体是 `data00000/sel_win.cbg.png`（1910×1056，6 条）。

         ### 逐像素实测（**`docs/04` 记的有多处不对，以本节为准**）

         几何：
             6 条 = 3 档 × 2 行高；条高 **88 / 130**（`docs/04` 记的 86 是概数）
             x = 48..1860（宽 1813，左右各约 2.5%）
             条间距：细条后 **45**、粗条后 **59**

         竖向着色（**不是"对称柱面"**，`docs/04` 那条错了）：
             主体   **上暗下亮**的线性渐变
             顶部   一道 4~5px **亮青描边**   ← 中档 rgb(61,250,252)
             底部   一道 4~5px **亮蓝描边**   ← 中档 rgb(42,165,244)
             主体 alpha **216/255 ≈ 85%**     ← **本来就半透明**（用户要的第②点）

             深档 填充 rgb(18,29,36)   顶 rgb(43,111,115)   底 rgb(32,83,99)
             中档 填充 rgb(26,100,131) 顶 rgb(61,250,252)   底 rgb(42,165,244)
             浅档 填充 rgb(59,147,168) 顶 rgb(176,247,248)  底 rgb(74,223,253)

         端帽（**只有左边一个，而且很大**，`docs/04` 记的"左右各一个细条"错了）：
             是一枚 **80×96 的卷曲缠枝纹 + 一枚尖叶**，从条身**向左伸出**
             亮青 rgb(55,215,250)（中档）/ rgb(86,242,251)（浅档）
             实测纹样占 x=48..119（约 72px），纵向 y=396..439（居中偏上）
             右端**没有纹样**，只有一道亮青描边收口

         ### 与"位置不照搬"的对应
         原作的条在画面**中部**（选项条）。这里只搬**构造语言**
         （半透明 + 上下双描边 + 左端缠枝纹 + 三档色阶），
         位置仍落在屏幕底部 —— 因为它是 DSH 的 composer，不是选项。

         ### 与"像原生那样悬浮"的对应
         DSH 原生的 composer 卡片本来就是**悬浮物**（有圆角 + elevation 投影）。
         这里把圆角保留、把 DSH 自己的 `--dsw-elevation-soft` 换成一层
         **外投影**，让整条浮在画面之上而不是贴死底边。
         ================================================================ */
      'body[data-myh-skin] [data-conversation-scroll]{justify-content:flex-end!important}',
      /* ★★★★ 输入框一直被画在皮肤底下（从第一轮起就在骗我的机制）：
         皮肤根 `#myh-skin-root` 是 `position:fixed; inset:0; z-index:2147482000` 的
         **整屏层**，而 composer 在 DSH 自己的 DOM 里、`z-index:auto` → 画在皮肤下面。
         ⚠ 极难发现的原因：皮肤层是 `pointer-events:none`，而
           `pointer-events` **只影响命中测试、不影响绘制顺序** ——
           于是 `elementFromPoint` 返回卡片、探针读到样式全对，
           可屏幕上画的却是皮肤自己的暗带。**证据链本身是错的。**
         修法：把 composer 抬到皮肤之上（+1）。它是唯一需要盖住皮肤的原生件。 */
      'body[data-myh-skin] [data-composer-seat]{z-index:901!important;',
      'position:relative!important}',
      /* 容器宽度交回 DSH 自己管（它知道 composer 该多宽）。 */
      'body[data-myh-skin] [data-composer-seat]{--dsh-composer-card-max-width:none}',
      'body[data-myh-skin] [data-composer-card]{width:100%!important;max-width:100%!important}',
      /* 包裹层去掉 DSH 的内边距，让条能自己决定左右留白 */
      'body[data-myh-skin] [data-composer-seat] [class*="uV2eYG_root"]{',
      'padding:0!important;align-items:stretch!important}',
      /* hero（空会话落地页）那套排版撤掉 */
      'body[data-myh-skin] [data-composer-seat] [class*="composerHero"]{',
      'padding-bottom:0!important;align-self:stretch!important;gap:0!important}',
      'body[data-myh-skin] [data-composer-seat] [class*="heroWorkspaceRow"]{display:none!important}',
      'body[data-myh-skin] [data-composer-seat] [class*="pXSMma_root"]{display:none!important}',

      /* ---------- 条身：半透明 + 上下双描边 + 悬浮 + **按方位靠边** ---------- */
      /* ★ 2026-09-20 用户定案：**靠左、宽 50%**。
         `width:50%` 是相对**容器**（中列）而言 —— 比按视口算准，
         因为中列本身就不等于视口宽。

         ★★★ 2026-09-20（用户定案）：**金鹿白天（A5）整条方位反过来**。
         用户原话："所有的方位调整金鹿白天都要反着来。所以金鹿的输入框也应该反过来。"
         —— 也就是说，**不只是立绘**，输入框也要跟着镜像到右边。

         实现方式：方位**只有一个真源** —— `manifest.expressions[景].spriteSide`
         （与立绘同源，见 `spriteSideOf()`）。JS 把它归一化后写到 `documentElement`
         的 `data-myh-side` 上，这里只按那个属性翻转。**不新增第二份方位配置**，
         否则两边一定会漂（项目历史上站位曾在三处各写一份然后漂掉）。
         ⚠ 必须写在 `documentElement`：composer 不在皮肤根子树里，
           写在皮肤根上它读不到（§1 `:root` 那段长注释记的就是这个坑）。 */
      /* ★ 2026-09-23（用户定案）：**站位与宽度收成两个变量**，一处定义、两处引用。
         用户原话：「这个站的位置也应该调整一下吧，跟输入框对齐吧」——
         指的是底部那条**原生待办栏**（`SECTION.lXshSW_root` / `data-testid="todo-panel"`）
         比输入框宽出一大截（实测栏 88→1558、宽 1470；卡 94→861、宽 767）。

         为什么不各写一份：原生那条宽走 `calc(100% - 侧净空×2 - dock-inset×4)`，
         本可被 `max-width:calc(var(--dsh-composer-card-max-width) - …)` 收窄，
         但本皮肤把 `--dsh-composer-card-max-width` 覆成了 `none`（见上一条）⇒ 该 max-width
         整条失效，栏就放开到容器满宽。**站位一旦两处各写，必然漂** ——
         项目史上已经漂过一次（见本节上方那条“三处各写一份然后漂掉”的教训）。
         所以这里的 50% 与 2.5% 只在本处出现，其余一律 var() 引用。 */
      'body[data-myh-skin]{--myh-composer-w:50%;--myh-composer-side:2.5%}',
      'body[data-myh-skin] [data-composer-card]{',
      /* 默认（others）：靠左。右方位在下面用属性选择器覆盖。 */
      'margin:0 auto 10px var(--myh-composer-side)!important;',
      'width:var(--myh-composer-w)!important;max-width:var(--myh-composer-w)!important;',
      'border-radius:3px!important;',
      'border:0!important;',
      /* 上亮青 / 下亮蓝两道描边 —— 用 inset box-shadow 做，随色阶由变量给 */
      'box-shadow:inset 0 4px 0 -1px var(--myh-cap-top,rgba(61,250,252,.95)),',
      'inset 0 -5px 0 -1px var(--myh-cap-bot,rgba(42,165,244,.95)),',
      '0 8px 26px rgba(0,0,0,.55)!important;',
      /* ★ 半透明主体（实测原作 alpha 216/255 ≈ 85%） */
      'background:var(--myh-composer-grad)!important;',
      'background-color:transparent!important;',
      'backdrop-filter:none!important;',
      'transition:background .25s ease,box-shadow .25s ease}',
      /* 输入文字：明朝体 + 袋文字描边 */
      /* ★★★ 2026-09-20：**输入框靠右**（金鹿白天 A5）—— 与靠左严格镜像。
         左：`margin:0 auto 10px 2.5%`（左缘 2.5%，右侧 auto 吃掉富余）
         右：`margin:0 2.5% 10px auto`（右缘 2.5%，左侧 auto 吃掉富余）
         —— 2.5% 与宽度 50% 两个量**完全一致**，只交换哪一侧是 auto，这才是"反着来"。
         `data-myh-side` 是**输入框自己的方位**（由 JS 写在 `documentElement` 上，
         与 composer 那批变量同一桥梁）。默认（无该属性时）走上面的靠左规则。 */
      'html[data-myh-side="right"] body[data-myh-skin] [data-composer-card]{',
      'margin:0 var(--myh-composer-side) 10px auto!important}',
      /* ★ 2026-09-23：**原生待办栏跟输入框对齐**（用户：「这个站的位置也应该调整一下吧，
         跟输入框对齐吧」）。两者本是 `wSkVaW_composerStack` 里上下相邻的两个 flex 项
         （实测栈 x=56、宽 1534、gap 6px；栏底 760 → 卡顶 766，**垂直方向本来就对齐**），
         所以这里**只改横向**：宽度与左右留白全部引用上面那两个变量，与卡片严格同源。
         ⚠ 不动上下 margin：原生栏 `margin:0 auto` 的 bottom 是 0，栈 gap 提供 6px；
           若顺手写成卡片的 `… 10px …`，间隙会变成 16px。
         ⚠ 选择器同时写 `data-testid` 与类名：`data-testid="todo-panel"` 是稳定契约，
           `lXshSW_root` 是哈希 CSS Modules（随 DSH 构建变），两个都挂上，坏一个不塌。 */
      'body[data-myh-skin] [data-testid="todo-panel"],',
      'body[data-myh-skin] .lXshSW_root{',
      'width:var(--myh-composer-w)!important;max-width:var(--myh-composer-w)!important;',
      'margin-left:var(--myh-composer-side)!important;margin-right:auto!important}',
      'html[data-myh-side="right"] body[data-myh-skin] [data-testid="todo-panel"],',
      'html[data-myh-side="right"] body[data-myh-skin] .lXshSW_root{',
      'margin-left:auto!important;margin-right:var(--myh-composer-side)!important}',
      'body[data-myh-skin] [data-composer-card] *{font-family:var(--myh-mincho)!important}',
      'body[data-myh-skin] [data-composer-input]{color:#FFFFFF!important;',
      'font-size:clamp(15px,1.5vh,19px)!important;line-height:1.7!important;',
      'text-shadow:-1px -1px 0 rgba(6,15,22,.95),1px -1px 0 rgba(6,15,22,.95),',
      '-1px 1px 0 rgba(6,15,22,.95),1px 1px 0 rgba(6,15,22,.95)}',
      'body[data-myh-skin] [data-composer-placeholder]{color:rgba(240,237,229,.72)!important;',
      'text-shadow:0 1px 3px rgba(0,0,0,.75)!important}',
      'body[data-myh-skin] [data-composer-card] button{color:#EAF2F4!important}',
      'body[data-myh-skin] [data-composer-card] button:hover{color:#58FFFD!important}',
      /* 高度：单行 88、按 42px 步进（88→130 实测），上限 172 */
      'body[data-myh-skin] [data-composer-card]{min-height:var(--myh-input-h,88px)!important;',
      'justify-content:center}',
      /* ---------- ★ 2026-09-20（用户定案）：右端缠枝纹**整条删除** ---------- */
      /* 这里原先用 `card::after` 挂一枚 52×84 的 `ui/cap_scroll_r.png`
         （`sel_win` 那枚卷曲纹样的水平镜像，朝右伸出），贴在条身右缘。
         用户要求连同座位上那两枚 `mu_bar` 一起删掉，输入框附近不留花纹。

         `position:relative` 仍然保留 —— 卡片自己还有别的层要用它做定位基准。 */
      'body[data-myh-skin] [data-composer-card]{position:relative!important;',
      'overflow:visible!important}',

      /* ================================================================
         ★★★ 2026-09-20：输入框左侧那两枚**白色圆钮**（指令 / 添加附件）

         【问题】它们原本是 DSH 浅色档的**白底胶囊**：
         `background:rgb(245,246,247)` + `border-radius:999px` + 28×28，
         直接压在皮肤的深青半透明条上 —— 就是用户说的"这白色的，修好"。
         （实测：`<button class="uV2eYG_add" aria-label="指令">` 与
           `<button class="uV2eYG_add" aria-label="添加附件">`，两枚同款。）

         【做法】底色改成**半透明墨青**，让它们融进条里，保留圆钮的形状语言；
         图标是 `currentColor` 的 SVG，所以只改 `color` 就能着色，不用碰 path。
         ⚠ 只针对 `uV2eYG_add`，**不要碰发送键** `uV2eYG_primary` ——
           它是蓝底的主动作按钮，压成透明会让"发送"这个动作失去视觉重量。 */
      'body[data-myh-skin] [data-composer-card] button[class*="uV2eYG_add"]{',
      'background:rgba(6,15,22,.34)!important;',
      'color:#CFE3E8!important;',
      'border:1px solid rgba(120,190,205,.35)!important;',
      'border-radius:999px!important;',
      'transition:background .16s ease,color .16s ease,border-color .16s ease}',
      'body[data-myh-skin] [data-composer-card] button[class*="uV2eYG_add"]:hover{',
      'background:rgba(39,96,106,.72)!important;',
      'color:#58FFFD!important;',
      'border-color:rgba(88,255,253,.75)!important}',
      /* 聚焦态照红线 5：**只加一道发光细边**，不改填充、不改尺寸 */
      'body[data-myh-skin] [data-composer-card] button[class*="uV2eYG_add"]:focus-visible{',
      'outline:2px solid #58FFFD!important;outline-offset:2px}',
      /* 禁用态：压暗，但仍要能看见它在那儿 */
      'body[data-myh-skin] [data-composer-card] button[class*="uV2eYG_add"][disabled]{',
      'background:rgba(6,15,22,.22)!important;color:#6F8288!important;',
      'border-color:rgba(120,190,205,.18)!important;cursor:default!important}',



      /* ================================================================
         ---- 整屏皮肤：三层结构（★ 2026-09-16 重构成"全新 UI"） ----
         ================================================================
         用户定调：「不是皮肤，是给 DSH 的一个全新 UI」。所以层级这样分：

           z=0   皮肤底层   .myh-under   背景 / 立绘 / 正文暗带
           z=2   DSH 正文   （由 §1g 把中列抬到 2）—— 可读、可滚动、可选中
           z=8   皮肤交互层 .myh-over    对话框 / 菜单板 / 子页 / ED / 点击热区

         要点：
           · 皮肤容器本身 `pointer-events:none`，只有交互层里需要点击的元素打开
           · **热区不能整屏覆盖**，否则正文选不中、链接点不到 —— 见 §1g 的活区
           · 对话框不再压在输入框上：底部留出 DSH composer 的高度（--myh-composer-h）
         ================================================================ */
      /* ================================================================
         ★★★ 2026-09-20 背景适配：**整块重写**（旧代码全删）
         参考：`requinDr/tsukiweb-public`（初代月姬 Web 版）的画面适配逻辑，
         提取笔记见 `docs/24-参考项目构造逻辑-tsukiweb.md`。

         旧写法为什么废掉：一直在 `inset:0` / `position:fixed` / `100vw` 之间打补丁，
         每一版都依赖"父容器/包含块是谁"这个**不受我们控制**的前提。
         月姬项目的做法不依赖这些，它只靠两条：

         ① **地基是"流"布局的满尺寸盒**，不是浮动的覆盖层
               `div.page { width:100%; height:100%; display:flex; position:relative }`
            —— 尺寸由显式的 100%/100% 给出，**父容器多大它多大、父容器满它就满**。

         ② **图只负责"填满自己的盒子"，盒子由①保证满**
               `div.bg { position:absolute; inset:0; display:block; overflow:hidden }`
               `div.bg img { width:inherit; height:inherit; object-fit:cover }`
            —— 注意是 `width:inherit; height:inherit`（**跟随父盒**），
               不是 `100vw/100vh`（自己算视口，算错就露缝）。

         所以这里照抄这四条，**把尺寸责任交回给链式继承**，不再有任何一处
         自己解释"视口有多大"。
         ================================================================ */
      /* ① 地基：皮肤根。显式 100%×100%，`inset:0` 只用来钉住四条边，
            尺寸由 100%/100% 给出——两条都写，互为保险。 */
      /* ★★★ 2026-09-20 第三版修复（真根因）：**皮肤对"挂载后视口变化"毫无反应**。
         实测证据（用户控制台）：`innerWidth=1357`，而皮肤探针报 `.myh-root` = **1912×1115** ——
         宽差了 555px。原因：探针只在挂载后 200ms/1400ms 采两拍，用户**之后**调整了窗口尺寸，
         皮肤既没有重新测量、也没有把自己的盒子更新 → 于是按 1912 铺，真实窗口只有 1357，
         **多出来的部分就是黑边；图还被放大 → 糊**。两个症状同一个根因。
         修法三条（都必须有）：
           ① 尺寸用 **`100vw/100vh`**（视口单位**实时**跟随，不依赖挂载时算出的 100%）；
           ② 监听 `resize` / `orientationchange` **重新测量**（原来只有挂载时测一次）；
           ③ 背景/暗带用 `100%/100%` 跟随这个盒子（`inherit` 也行，但 100% 更直白）。 */
      '.myh-root{position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;',
      'z-index:0;pointer-events:none;background:#000;',
      'font-family:var(--myh-mincho);color:var(--myh-mist);overflow:hidden;',
      /* ★ 2026-09-21：一起截断滚动链。这一层虽然 `overflow:hidden` 不滚，
         但**它仍会参与链式传播判定**（实测：把它改成可滚后，
         文字列在底部继续滑会把它带走 300px，输入框随之"跳"）。 */
      'overscroll-behavior:contain}',
      /* ★★★ 2026-09-22（用户第 7 条）：**整屏页打开时，皮肤根盖住输入框**。
      
         病根：皮肤根的 `z-index:900` 写在 **inline style** 里（见 §9.5 挂载那段），
         而 composer 座位是 `901` —— 于是 L1 表紙页全屏铺开时，底部那条输入框
         还浮在皮肤之上（用户：「输入框永远在顶层，把这个bug改掉」）。
      
         ⚠ 不能简单把根抬到 1100 以上 —— 早先 `2147482000` 那次就是这么翻车的：
         把 DSH 自己的浮层（1100 档：下拉菜单 / 弹窗 / toast）全盖住了。
         所以这里**只在整屏页打开时**抬，取 950：
           · 950 > 901  → 盖住输入框
           · 950 < 1100 → 不碰 DSH 浮层
      
         ⚠ 且**审批卡在场时不抬**（`:not([data-guard="off"])`）—— 审批卡是
         "composer takeover"，「批准 / 拒绝」就在底部那一条里，那时必须留住它。
         `data-guard` 是既有的信号（见 §5 的 guard()），这里只是复用它。
      
         ⚠ 只对**整屏页**生效（L1 / 皮肤设置），不动 L2 侧栏板：
         侧栏板是贴右缘的局部面板，它自己的 `padding-bottom` 已经给输入框让了位。 */
      '#myh-skin-root[data-myh-page="on"]:not([data-guard="off"]){z-index:950!important}',
      /* ② 底层：与地基同盒。尺寸用 100vw/100vh 实时跟随视口 */
      '.myh-under{position:absolute;inset:0;width:100vw;height:100vh;margin:0;',
      'z-index:0;pointer-events:none;overflow:hidden;background:inherit}',
      /* 正文层：★ 自己画的会话流。夹在底层与交互层之间。
         ★ 底边停在**输入框上沿**（--myh-composer-top）：不能铺到屏幕底 ——
           铺下去就把 DSH 的输入框/审批卡盖住了（它们是 composer takeover，
           「批准/拒绝」按钮就在那一条里）。 */
      /* ★★★ 2026-09-21（用户定案）：**列铺满整个视口**，文字靠内边距让开输入框。
         用户："把显示区域过于小的bug修好"。

         病根（实测 1600×900）：列高 = 视口高 − 输入框上沿 = **166px**，
         而会话内容 1006px ⇒ 只能看到顶部一小条，下面 734px 全空着。
         之所以一直"短"，是这条老规则 `bottom:var(--myh-column-bottom)` 把
         列高**钉死**成了"到输入框上沿为止"，而内容却从列顶往下排。

         现在改成：列**铺满视口**（`bottom:0`），可用高度交给
         `.myh-columnInner` 的 `padding-bottom: var(--myh-composer-h)` 让开。
         这样列高恒等于视口高（900），内容够短时靠 `margin-top:auto` 贴底，
         够长时正常滚动 —— 两种情况下**可视区都不再被削成 166px**。

         ⚠ 为什么铺满不会吃掉输入框的点击（实测过，别再怀疑这条）：
           皮肤根 z-index **900**，而 composer 座位是 **901**（`docs/27` §1.4 的层级表），
           两者是"堂兄弟"—— 输入框那一支**盖在**皮肤之上，
           实机 `elementFromPoint(300,850)` 在列铺满后仍返回 `uV2eYG_card`。
         ⚠ `--myh-column-bottom` 变量保留（诊断与旧断言仍在读它），但不再驱动列高。 */
      /* ★★★ 2026-09-21：**`scrollbar-gutter:stable` 是"与输入框对齐"的前提**。
         实测（1600 视口，A4 有历史会话）：
             输入框卡片  l=94  r=861
             正文层      l=94  r=856   ← 右缘差 **5px**
         根因：列里出现了 10px 的滚动条 → 列的内容区只有 1590px，
         而右缘百分比是按**内容区**算的，于是比输入框（按视口算）少 5px。
         `scrollbar-gutter:stable` 让滚动条**始终占位**：
         内容区恒定 = 视口 − 10px，与"当前有没有滚动条"解耦，
         左右缘于是稳定对齐（差 5px 变成恒定 0）。
         ⚠ 不加 `overflow-y:scroll` 那种硬写法 —— 它会永久画出一条滚动槽；
           `scrollbar-gutter` 只在需要时留位，视觉更干净。 */
      /* ★★★ 2026-09-21（用户反馈修复）：**截断滚动链 —— `overscroll-behavior:contain`**。
         用户："文本内容滑到底的时候文本跳对话框跳，到了底部之后继续滑动输入框跳别的不动。"

         这是典型的**滚动链（scroll chaining）**：内层滚到边界后，
         剩余的滚动量会**传给最近的祖先滚动容器**，于是整个画面被带走
         —— 表现就是"文字不动了，但输入框和别的一起跳"。

         **复现与验证（都在实机上做的，不是推理）**：
         本地无头环境里祖先恰好不可滚，所以一开始复现不出来。
         手动把 `.myh-root` 改成可滚（塞一个 1200px 的占位）后：
             修前：列在底部继续滑 → 祖先 `scrollTop` 被带走 **300px**
             修后：列在底部继续滑 → 祖先 `scrollTop` 保持 **0**
         机制与修法都坐实了。

         ⚠ 两处都要写：`.myh-column` 是"滚动的那个"，`.myh-root` 是"被带走的那个"。
           只写一处的话，另一条路径（比如从根上起滚）仍会漏。
         ⚠ `contain` 而不是 `none`：`contain` 只阻断**往外传**，
           本元素自己的弹性/回弹行为保留；`none` 会连回弹一起关掉。
         ⚠ 顺带把 `documentElement/body` 也按住（见后面那段）——
           真实窗口里"被带走的祖先"未必是 `.myh-root`，写全才不会漏。 */
      '.myh-column{position:absolute;left:0;right:0;top:0;',
      'bottom:0;z-index:4;pointer-events:auto;',
      'overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;display:flex;flex-direction:column;',
      'overscroll-behavior:contain;scrollbar-gutter:stable}',
      '.myh-column::-webkit-scrollbar{width:10px}',
      '.myh-column::-webkit-scrollbar-thumb{background:rgba(48,129,152,.5);border-radius:5px}',
      /* ★★★ 2026-09-20（用户定案）：**正文文本层与输入框对齐**。
         用户："我让你把文本显示框与输入框对齐，但文本显示框现在依然在中间"。

         原来这里是 `max-width:min(1100px,76vw)` + `margin:0 auto` —— **居中**，
         实测（1584 视口）左缘 216 / 右缘 1368，左右各让 13.6%，所以看着"在中间"。

         现在左右边距改用 `--myh-cur-left` / `--myh-cur-right`
         （`measureShell()` **实测输入框卡片左右缘**后换算成视口百分比写下的那一组，
           与输入框上方那句台词层 `.myh-cur` 用的是**同一组变量** ——
           这样"正文、台词、输入框"三条左右缘永远在同一条竖直线上，
           且方位翻转（金鹿白天靠右）时一起翻，不会各自为政）。
         ⚠ `max-width` 必须让位：它一旦生效就会盖掉左右边距的意图
           （超宽时按 max-width 缩、两侧再 auto 居中）→ 又回到居中。
           所以改成 `none`，宽度完全由左右边距决定。
         ⚠ 变量读不到时（卡片没量到）退回居中式子 —— 但**这时候整列是隐藏的**
           （见下面的 `data-myh-measured` 规则），所以兜底值对错都不会被看见。
           隐藏是为了修"从中线漂移到自己那边"：兜底=居中、真值=靠边，
           两者之间原本是一次可见的硬跳（列自身没有 transition，所以是跳不是滑）。 */
      '.myh-columnInner{max-width:none;',
      'margin-left:var(--myh-cur-left,calc((100% - min(1100px,76vw)) / 2));',
      'margin-right:var(--myh-cur-right,calc((100% - min(1100px,76vw)) / 2));',
      /* ★★★ 2026-09-21：**文字贴底、从上往下增长**（原作构图）。
         列现在是 flex 容器（见 `.myh-column`），这一条 `margin-top:auto`
         把自己顶到列的**底部**，于是新增的文字把旧文字**往上推**，
         最后一句永远落在靠近输入框的位置 —— 与魔夜"文字在下三分之一"一致。

         ⚠ 为什么之前是"只有顶部一小条"：
           列高 = 视口高 − 输入框上沿（实测 900−734 = **166px**），
           而内容按默认的 `flex-start` **从列顶往下排**，
           内容 1006px 却只有 166px 可视区 ⇒ 只能看到顶部一小条，
           底下 734px 全空着。`margin-top:auto` 之后可视区仍是列高，
           但文字落在底部、且列的滚动会把历史往上带。
         ⚠ `margin-top:auto` 在"内容比列高"时会退化成 0（自动外边距吃掉剩余空间，
           没有剩余就是 0），不会把内容推出可视区 —— 这正是要的行为。 */
      'margin-top:auto;',
      /* ★★★ 2026-09-20 修：底部内边距**不再叠加 composer 高度**。
         原来是 `calc(150px + var(--myh-composer-h))` —— 那是"列铺到屏幕底、
         再靠内边距把文字顶到输入框上方"时代的补偿。而**列现在已经在输入框上沿停住了**
         （`.myh-column{bottom:var(--myh-column-bottom)}` = composerTop，实测 883px/1007px），
         于是这 274px 成了**双份留白**，直接把内容顶出列外 → 必然出现滚动条。

         实测（1629×1007，A3 景，空会话）：
           列高 124px，而 `.myh-columnInner` 高 758px
           = 26(上) + 438(内容) + 14(gap) + **274(下)** → 溢出 634px → 右侧滚动条
         用户看到的就是"右上角那条小滚动条"。

         ⚠ 这里**不能用固定像素**：列高随输入框高度变化（单行 88 / 多行递推），
           硬编码任何值都会在某个尺寸下失效 —— 这是项目里反复吃过的教训
           （"约束必须与盒子挂钩，固定值必然出框"，`docs/22` §9 R13）。
         ⚠ 也**不能用百分比 padding** —— CSS 规定百分比的 padding **按包含块的宽度解析**
           （不是高度），拿它调纵向留白在矮窗口下根本不会收缩。改用 `vh`。
         数值：视口高 1007px 时 = 26/28px（与原来观感一致）；矮窗口自动收缩到 8px。 */
      /* ★★★ 2026-09-21：**底部内边距改成"让开输入框"的真实高度**。
         列现在铺满视口（见 `.myh-column`），所以文字必须自己往上让 ——
         让多少由 `--myh-composer-h` 决定（`measureShell()` 实测输入框座高后写入，
         视口 1600×900 时是 166px）。这条替代了原来"靠列高截断"的做法：
         同样能让开输入框，但**可视区不再被削成一条**。

         ⚠ 仍然不用固定像素：输入框高度随行数变化（单行 88 / 多行递推），
           硬编码必然在某个尺寸下失效（`docs/22` §9 R13 的老教训）。
         ⚠ 兜底 `+ 12px` 是"量不到输入框高度"时的最小呼吸位；
           `--myh-composer-h` 缺失时 `var()` 会取 0，所以写成 `+ 12px` 而不是整体兜底。

         ★★★ 2026-09-21（用户定案）：**左右内边距归零**。
         用户："文字显示区的左右两侧要对齐输入框的左右两侧"。
         实测（1600×900）：
             输入框卡片   l=94  r=861
             columnInner  l=94  r=856   ← 盒子本来就对齐（margin 由实测变量给）
             而文字实际从 94+26=**120** 起 ← 差在这 26px 的左右 padding 上
         即"盒子对齐了、文字没对齐"。所以左右 padding 一律置 0，
         文字直接以输入框卡片的左右缘为起止。
         ⚠ 纵向 padding 保留（顶部呼吸位 + 底部让开输入框），只清左右。 */
      'padding:clamp(8px,2.6vh,26px) 0 calc(var(--myh-composer-h,0px) + 12px) 0;',
      'display:flex;flex-direction:column;gap:14px;',
      /* ★★★ 2026-09-21：**内层必须能被列当作"可滚动内容"看待**。
         实测（1600×900）：列 `scrollHeight === clientHeight === 900`，
         而内容实际画到 841（越过 722 的让位线、压到输入框上）——
         说明列**没察觉到溢出**，于是不滚动、也不裁剪。
         根因：`.myh-columnInner` 是 flex 子项，`min-height:0` 让它
         **在内容超出时反向收缩**（把内容挤出去），而不是撑开父列触发滚动。
         加 `flex:0 0 auto`（不许缩）之后，内层按内容长高，
         列才会出现真实的 `scrollHeight > clientHeight` → 正常滚动。

         ⚠ 三条一起才是完整的：列铺满视口（`.myh-column{bottom:0}`）
           + 内层不许缩（这里）+ 底部让位（上面的 padding-bottom）。 */
      'flex:0 0 auto;',
      'min-height:0}',
      /* ★★★ 2026-09-23：**量到之前不显示正文列**，避免首帧"居中 → 靠边"的硬跳。
         `#myh-skin-root` 刚挂载时没有 `data-myh-measured`，整列不可见；
         `measureShell()` 写完 `--myh-cur-left/right` 后才加上这个属性（见 4593 附近），
         列于是在**已经对齐的最终位置**淡入 —— 用户只看到一次淡入，没有位移。
         用 visibility 而不是 display：display 会改变布局，量出来的矩形就不准了。

         ⚠⚠ 这三条**必须放在 `.myh-columnInner{…}` 规则闭合之后**，而且选择器
           要带前缀。踩过的坑（本次实测，218 通过 / 3 失败）：
           · 写进上面那条规则的**内部** → `{visibility:hidden}` 的 `}` 会提前闭合
             整个规则，后面的 `margin-top:auto` / `padding` / `flex:0 0 auto`
             全部变成游离声明 → 版式直接坏掉（不只是断言失败）。
           · 写成裸的 `.myh-columnInner{…}` 且排在上面那条之前 → 离线自检
             （check-client.mjs 用 `css.match(/\.myh-columnInner\{([^}']*)/)` 抓
             **第一条**匹配）会抓到这三条空规则 → padding/flex/对齐三项假失败。
           两条都踩过，所以这里既带前缀、又放在闭合之后。 */
      '#myh-skin-root:not([data-myh-measured]) > .myh-column > .myh-columnInner{visibility:hidden}',
      '#myh-skin-root[data-myh-measured] > .myh-column > .myh-columnInner{visibility:visible;',
      'animation:myh-colIn .2s ease both}',
      '@keyframes myh-colIn{from{opacity:0}to{opacity:1}}',
      /* 标题条：像书页的页眉，不做成应用工具栏 */
      '.myh-titlebar{display:flex;align-items:baseline;gap:14px;padding:2px 4px 8px;',
      'border-bottom:1px solid rgba(48,129,152,.35);margin-bottom:6px}',
      '.myh-titlebarText{font-size:15px;letter-spacing:.22em;color:#EAF2F4;',
      'text-shadow:0 2px 6px rgba(0,0,0,.7)}',
      '.myh-titlebarMeta{font-size:11px;letter-spacing:.16em;opacity:.6}',

      /* ---- 会话流：ADV 读本样式，不是聊天气泡 ---- */
      /* ★★★ 2026-09-21：**列铺满视口之后，这里不再需要"收缩"那套补偿**。
         历史（留个记录，免得有人再按老注释去"修"）：
           · 2026-09-20 曾用 `min-height:40vh` → 视口相对，把矮列撑爆；
             改成 `flex:1 1 auto` + `min-height:0` 让它在矮列里能收缩。
           · 2026-09-21 列改成铺满视口（`.myh-column{bottom:0}`）后，
             "矮列"这个前提**消失了**：列高恒等于视口高，
             可视区不再被截成一条，所以收缩逻辑与配套的
             `@container (max-height:200px)` 紧凑档一并撤掉。
         ⚠ **唯一管滚动的容器仍然是 `.myh-column`**（`overflow-y:auto`），
           这里绝不能再开一个滚动容器（项目里踩过"藏掉滚动容器 → 整条链塌"）。 */
      '.myh-transcript{min-height:0;flex:1 1 auto;overflow:visible}',
      /* 旧的矮列自动紧凑档（`@container (max-height:200px)`）已整体撤掉，
         连同 `container-type:size` —— 列不再变矮，那个档位失去前提。 */
      '.myh-flow{display:flex;flex-direction:column;gap:18px}',
      '.myh-flowEmpty{opacity:.5;letter-spacing:.2em;font-size:13px;padding:20px 4px}',
      /* 助手正文：整段白字 + 袋文字描边，落在暗带上
         ★★★ 2026-09-21（用户定案）：**字号调小**。
         用户："文字的字号调小"。
         实测旧值（1600×900）：`clamp(15px, min(2.2vh,1.25vw), 25px)` → **19.8px**，
         行高 40.6px。在"一条整屏暗带"的读本语境里偏大 ——
         一屏只放得下七行左右，读起来像标题而不是正文。
         新值：`clamp(13px, min(1.8vh, 1.05vw), 21px)` → 同一视口下 **16.2px**，
         约降 18%。上下限同步收（13/21），保证小屏不至于小到看不清、
         大屏不至于又涨回去。
         ⚠ 行高跟着字号走用**倍数**（1.95），不写死像素 ——
           项目里踩过"固定像素行距在某个尺寸下失效"（`docs/22` §9 R13）。 */
      '.myh-say{font-size:clamp(13px,min(1.8vh,1.05vw),21px);line-height:1.95;',
      'letter-spacing:.03em;color:#FFFFFF;white-space:pre-wrap;word-break:break-word;',
      'text-shadow:-1px -1px 0 rgba(6,15,22,.92),1px -1px 0 rgba(6,15,22,.92),',
      '-1px 1px 0 rgba(6,15,22,.92),1px 1px 0 rgba(6,15,22,.92),0 2px 10px rgba(0,0,0,.6)}',
      '.myh-say[data-stopped="true"]{opacity:.72}',
      '.myh-stopped{font-size:11px;letter-spacing:.2em;opacity:.55;margin-top:4px}',
      /* 用户消息：与助手正文同排，用「」框起来（原作"人声"的起手标点）
         ★ 2026-09-21 用户定案：不要消息框，和发过来的内容一样排。
         所以这里**没有气泡、没有底色、没有右侧对齐** —— 只有：
           ① 同一条暗带上的同一种正文排版（字号/行高/描边全部继承 .myh-say）
           ② 起手与收尾各一个「」（.myh-quote）
           ③ 一点极淡的分隔，表明"这一行是另一个人说的"（不抢文字）
         旧的 `.myh-fusenMsg`（黄色便签气泡）已按用户要求整体移除。 */
      '.myh-sayUser{color:#F4EFE2}',
      '.myh-sayUser .myh-quote{color:#9FC3CC;opacity:.85}',
      '.myh-msg[data-role="user"] .myh-say{margin-top:-2px}',

      /* ---- Markdown 排版（★★★ 2026-09-23 新增） ----
         用户报告："现在的皮肤无法适配 markdown 格式，所以会出现一大堆符号乱码"。
         确实如此 —— 此前正文是把助手原文**当纯文本**直接当子节点画的，
         于是 `**`、`##`、三个反引号这些标记原样显示在屏幕上。

         这一组的做法：**保留 `.myh-say` 那套袋文字排版**（字号/行高/描边全部继承），
         块级元素只补"间距与容器"，行内元素只补"区别色与底"。
         原则是**不引入第二种排版语言** —— 屏幕上仍然是同一条暗带上的同一种正文，
         只是标记被解析掉了。

         ⚠ 代码类元素的 `text-shadow:none` 是必需的：`.myh-say` 有四向描边
           （袋文字），套在等宽小字上会糊成一团。 */
      '.myh-say .myh-mdP{margin:0 0 .5em}',
      '.myh-say .myh-mdP:last-child{margin-bottom:0}',
      '.myh-say .myh-mdH{margin:.75em 0 .4em;font-size:1.1em;letter-spacing:.08em;',
      'color:#EAF7F8;font-weight:600}',
      '.myh-say .myh-mdH:first-child{margin-top:0}',
      /* ⚠ 列表**不能用 `display:flex`** —— 那会把 `list-style` 的符号吃掉，
         "・" 与序号全都不显示（实测踩过）。用浏览器默认的 block 布局即可。 */
      '.myh-say .myh-mdList{margin:.35em 0 .55em;padding-left:1.5em}',
      '.myh-say .myh-mdList:last-child{margin-bottom:0}',
      '.myh-say .myh-mdLi{margin:.12em 0}',
      '.myh-say .myh-mdQuote{margin:.45em 0;padding-left:13px;opacity:.9;',
      'border-left:2px solid rgba(48,129,152,.55)}',
      '.myh-say .myh-mdHr{border:0;border-top:1px solid rgba(48,129,152,.4);margin:.85em 0}',
      '.myh-say .myh-mdLink{color:#8FE3E8;text-decoration:underline;',
      'text-decoration-color:rgba(143,227,232,.45);text-underline-offset:2px}',
      '.myh-say .myh-mdBold{font-weight:700;color:#FFFFFF}',
      '.myh-say .myh-mdItalic{font-style:italic}',
      '.myh-say .myh-mdDel{opacity:.62;text-decoration:line-through}',
      /* 行内代码：给一块深底，压掉描边 */
      '.myh-say .myh-mdCode{font-family:var(--myh-mono);font-size:.92em;',
      'padding:.06em .36em;border-radius:3px;text-shadow:none;',
      'background:rgba(6,15,22,.78);border:1px solid rgba(48,129,152,.42);color:#B7F0F0}',
      /* 代码块：整块深底 + 左侧一道青线，纵向可滚（不横向撑破暗带） */
      '.myh-say .myh-mdPre{margin:.5em 0;padding:10px 13px;overflow:auto;',
      'background:rgba(4,10,16,.8);border-left:2px solid rgba(48,129,152,.6);',
      'font-family:var(--myh-mono);font-size:.9em;line-height:1.7;text-shadow:none}',
      '.myh-say .myh-mdPre:last-child{margin-bottom:0}',
      '.myh-say .myh-mdPre code{white-space:pre;font-family:inherit;color:#CFE9EC}',
      /* 表格：细青线，表头比正文亮一档。
         ⚠ 外面必须套一层可横向滚动的容器 —— 宽表（很多列）会把暗带撑破，
           而暗带宽度是固定的（`BAND_W_PCT`），撑破就露到屏幕外。 */
      '.myh-say .myh-mdTableWrap{margin:.5em 0;overflow:auto;max-width:100%}',
      '.myh-say .myh-mdTableWrap:last-child{margin-bottom:0}',
      '.myh-say .myh-mdTable{border-collapse:collapse;font-size:.95em}',
      '.myh-say .myh-mdTable th,.myh-say .myh-mdTable td{',
      'border:1px solid rgba(48,129,152,.4);padding:3px 10px;text-align:left}',
      '.myh-say .myh-mdTable th{background:rgba(6,15,22,.62);color:#EAF7F8;font-weight:600}',
      /* 思维链：折叠的一行，克制 */
      '.myh-think{margin:2px 0 6px}',
      '.myh-thinkHead{border:0;background:transparent;cursor:pointer;padding:0;',
      'font-family:var(--myh-mincho);font-size:11px;letter-spacing:.22em;color:#9FC3CC;opacity:.8}',
      '.myh-thinkHead:hover{color:#58FFFD}',
      '.myh-thinkBody{margin-top:6px;padding:8px 12px;font-size:12px;line-height:1.8;',
      'color:#C7D6DA;background:rgba(6,15,22,.55);border-left:2px solid rgba(48,129,152,.6);',
      'white-space:pre-wrap;word-break:break-word;opacity:.9}',
      /* 工具调用：细窄状态条 */
      '.myh-tools{display:flex;flex-direction:column;gap:5px;margin-bottom:8px}',
      '.myh-tool{display:flex;align-items:center;gap:9px;padding:4px 12px;',
      'border-left:2px solid rgba(48,129,152,.55);background:rgba(6,15,22,.42);',
      'font-size:12px;letter-spacing:.1em;color:#B9D2D8}',
      '.myh-toolDot{width:6px;height:6px;border-radius:50%;background:#3D7C96;flex:none}',
      '.myh-tool[data-running="true"] .myh-toolDot{background:#58FFFD;',
      'box-shadow:0 0 8px #58FFFD;animation:myh-pulse 1.2s ease-in-out infinite}',
      '@keyframes myh-pulse{50%{opacity:.35}}',
      '.myh-toolName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.myh-toolState{font-size:11px;opacity:.7;flex:none}',
      /* 系统提示 / 错误 */
      '.myh-notice{font-size:12px;letter-spacing:.12em;color:#9FC3CC;opacity:.72;',
      'padding:6px 12px;background:rgba(6,15,22,.4);border-left:2px solid rgba(48,129,152,.45)}',
      '.myh-noticeErr{color:#FFB4B4;border-left-color:#7a2b2b;opacity:.95}',
      '.myh-typing{font-size:12px;letter-spacing:.3em;color:#7FBAC4;opacity:.75}',
      /* 交互层：对话框 / 菜单 / 子页 / ED */
      '.myh-over{position:absolute;inset:0;z-index:8;pointer-events:none}',
      '.myh-over>*{pointer-events:auto}',

      /* ---- 背景 ----
         ★★★ 2026-09-20 结论（多次试错后的定案）：
         满屏层一律 **`100vw × 100vh`**，**不做任何"物理像素补偿"**。
         曾经按 `screen.width × dpr / innerWidth` 算过一个补偿比值，实测算出
         `x=1.5063 y=1.6143` —— 那是把一个画面**放大 1.5 倍**，不是"补上缺口"，
         根因是 `dpr/screen/innerWidth` 这组数在本机环境里**本身就互相矛盾**
         （缩放 100% 却报 dpr=1.5、screen 1920、innerWidth 1912）。
         **拿脏数据做算术只会更糟**，所以补偿整个撤掉，回到唯一可信的口径：视口单位。
         `object-fit:cover` 保证按原比例裁切、绝不拉伸。 */
      '.myh-bg{position:absolute;inset:0;display:block;width:100vw;height:100vh;',
      'max-width:none;max-height:none;margin:0;overflow:hidden;',
      'object-fit:cover;object-position:50% 50%;user-select:none;-webkit-user-drag:none}',
      /* ★★★ 2026-09-23：**删掉了 `.myh-bg` 上的 `transition:opacity .55s ease`**。
         它和下面 `.myh-bgFade` 的 `animation` 抢同一个属性（都是 opacity），
         而两者挂在**同一个元素**上（见 `stSafe.bg` 那个 img，同时给了两个类）。
         后果是换背景时淡入时长不恒定，且 `.55s` 与 `.6s` 差 50ms 互相干扰。
         换图时 React 会按 `key` 重建元素 → animation 从头放，这才是要的效果；
         transition 在"元素已存在、opacity 值变化"时才起作用，本场景用不上。
         保留 animation、删掉 transition，行为变得确定。 */
      '.myh-bgFade{animation:myh-bgIn .6s ease both}',
      '@keyframes myh-bgIn{from{opacity:0}to{opacity:1}}',

      /* ---- 正文暗带（★ 跟着正文收窄，2026-09-20 用户定案）----
         用户："阴影没有跟着改" —— 正文已与输入框对齐（靠左、48% 宽），
         而这条暗带原来还是 `100vw` 满屏，于是右边一大片照样压着暗色，
         与"文字只占左边一条"对不上。

         素材 `txtwindow*` 的横向剖面（实测 y=540 行，1921×1081）：
             0% → 0    5% → 0    10% → 38   15% → 114
             18.3%~81.7% **恒定 153**（这是"真正压暗"的核心区）
             85% → 114  90% → 40   95% → 0   100% → 0
         ⇒ 两侧各约 15~18% 是**羽化渐变**，中间约 63% 是恒定浓度。

         ⚠ 所以**不能直接裁窄素材**（会把羽化切掉、边缘变硬边）。
           这里保留整张素材，用 `object-fit:cover` 让它填满新的盒、
           内容按比例放大——羽化区随之贴到新的左右缘，观感与原作一致。

         左右缘用 `--myh-cur-left/right` —— 与正文层、台词层**同一组真源**
         （`measureShell()` 实测输入框卡片的左右缘），三者永远在同一条竖直线上。
         兜底回满屏：量不到卡片时宁可"暗带铺满"，也不要"暗带没了"。 */
      /* ⚠⚠ `left`+`right`+`width:auto` **在这个环境里不生效** —— 这一条是实测撞出来的：
         `<img>` 是**替换元素**，`width:auto` 时浏览器取它的**固有宽度**（素材 1921px），
         把 `right` 让位。实测：视口 1584、父宽 1584，元素却算成 **1599px 宽、右缘 1693（出框）**。
         在独立对照页里同样的写法是对的（500px），说明是运行环境（DSH 页面）里的
         某种解析差异 —— 但**结论很干脆：不要依赖 auto**。
         现场克隆实验（同一父元素、同一 class）三档对照：
             width:auto                        → 宽 1599（固有宽，✗）
             width:auto 再显式置 auto          → 仍 1599（✗）
             width:calc(100% - 52%)            → 宽 760  ✓
         ⇒ 用 `calc` 把宽度**算出来**。`max-width:none` 留着：防全局 img 上限夹回固有宽。 */
      /* ⚠⚠ `object-fit` **必须用 `fill`，不能用 `cover`** —— 也是实测撞出来的：
         盒子比素材 1921×1081 窄时，`cover` 会**按高度撑满再裁两侧**
         （两侧各裁约 22%），而羽化区只有 15% ⇒ **羽化被整条裁掉**，
         剩下 alpha=153 的实心区，暗带边缘变成一道**硬切边**（截图里非常刺眼）。
         `fill` 则把素材**拉伸**进盒子：羽化按比例保留，边缘自然渐隐。 */
      /* ★★★ 2026-09-20（用户定案）：**暗带加宽 —— 中心不动，两条边各往外扩**。
         用户："太窄了，宽一点" / "肯定是暗带" / "**别的我一点都不想改**" /
               "保持同样的位置往两边扩"。
         ⚠ 我在这条上表达拧了两次，记下来免得再犯：
           · 第一次：理解成"搬到屏幕中间再放大"（错——那是挪位置，不是加宽）
           · 第二次：说成"左缘不动、往右扩"（也错——**两条边都要动**，
             左边往左、右边往右，中心点保持不动）
         ⇒ 正确 = **以当前盒子中心为轴，左右各扩相同的量**。

         ⇒ 只有暗带动：文本层、台词层、输入框的几何**一个字都不碰**。
         ⇒ 数学上：宽 W、中心 C ⇒ 左缘 = C − W/2、右缘 = C + W/2。
           `--myh-band-l` 由 JS 按这个式子写，`--myh-band-w` 给宽度。
         兜底 48% / 6%：量不到时退回上一个已定案的宽度，不会突然变样。 */
      '.myh-band{position:absolute;top:0;height:100vh;',
      'left:var(--myh-band-l,6%);right:auto;width:var(--myh-band-w,48%);',
      'max-width:none;max-height:none;margin:0;z-index:2;object-fit:fill;pointer-events:none;opacity:.88}',

      /* ---- 立绘：整身构图（身体层+脸层，见 docs/17）----
         素材画布本身就是**按屏幕尺寸做的取景**（胸像 1272px 高），
         但按 100vh 摆会顶满整屏、头占掉一半画面（用户实测："不咋好看"）。
         实测定 76vh：头落在画面中线附近，背景留得住，胸口仍被下边缘切掉。
         ★ 立绘**按素材画布整张输出**（不按内容 bbox 裁）—— 画布上方那点透明留白
           就是发型余量，裁掉会让画面顶边把头发切平（上一版的毛病）。
         ★★ 左右站位（2026-09-19 改由 manifest 驱动）：`manifest.expressions[景].spriteSide` 决定，
            JS 把 `--myh-sprite-x` 写成内联变量（'right'→+30vw / 'left'→-30vw）。
            **为什么金鹿（A5）在左**：她的立绘素材面朝右，站画面右侧等于冲着屏幕外看；
            站左侧视线横穿画面、落在中央的对话框上。
            生成侧同一理由写在 assemble-assets.mjs 的 SPRITE_SIDE_LEFT 上。

         ★★★ 2026-09-20（用户定案）：偏移 **20vw → 30vw**（"往自己的那一边再靠近 50%"）。
            ⚠ **`--myh-sprite-x` 是"从中线起算的位移"，越大越靠自己的那一边** ——
              它**不是**"离边的距离"。这个方向我一开始搞反过（把 20vw 减半成 10vw，
              效果是把立绘从右边往中间拉，与要求正好相反），被用户当场指出。
            ⚠ 30vw 会**触碰 clamp 上限**（`D ≤ (W-B)/2`）：1629×1007 下上限是 27.2vw，
              所以实际落在 27.2vw，立绘右缘正好贴到画面边（离边 0px）。
              这是**有意的** —— 上限就是"不出画"的保证，贴边损失的只是右缘极稀疏的发丝像素。
            用户明确补充"**金鹿的与别人相反方向同比例**"，所以：
              · 符号仍由 `spriteSide` 决定（'left' 自动取负 → 金鹿朝左，别人朝右）；
              · 数值只有**一个真源**（`Sprite()` 里的 `±30vw`），本行只是 CSS 兜底。
            实测（1629×1007、A4、盒子宽 744px、居中时左缘 442px）：
              20vw → 左缘 768、离右边缘 117px
              30vw → 削到 27.2vw → 左缘 885、右缘 1629（贴边）

         ★★ 出框修复（2026-09-21）：`--myh-sprite-x` 只是**期望站位偏移 D**，不是最终位移。
            上一版是「grid 居中 + transform:translateX(±20vw)」——20vw 是**容器宽**的比例、
            与**盒子宽 B 无关**，画布越宽/窗口越窄越偏。实测（Edge 无头 + 本文件 CSS 原样）
            在 1080 高的视口下，1640 画布走旧公式的右缘是：
              1280 视口 → 1425（**出框 145px**）　1440 视口 → 1537（**出框 97px**）
              1920 视口 → 1873（恰好放得下，余 47px —— 所以只在窄一点的窗口才现形）
            诊断页更明显：它的舞台只有几百 px 宽，位移却仍按**窗口**的 20vw 算
            （1920 窗口=384px）→ 每张立绘都撞出舞台、被 overflow:hidden 切掉，
            用户截图里"全都贴边"就是这个。
            现在位移与 B 挂钩，推导（W=容器宽、B=盒子宽、D=期望偏移、x0=(W-B)/2=居中时左缘）：

              约束① 左缘 ≥ 0 ： x0 + D ≥ 0     → D ≥ -(W-B)/2
              约束② 右缘 ≤ W ： x0 + D + B ≤ W → D ≤ +(W-B)/2
              ⇒ 最终左缘 = clamp(x0 + D, 0, W-B)

            · B ≤ W：0 ≤ W-B，区间合法 → 就是上面那个 clamp。
            · B > W：W-B < 0，**clamp() 的 min 会大于 max，CSS 规定此时返回 min**
              （贴左缘、右缘出多少都不管）→ 行为错乱。所以这里不用 clamp()，
              用 min()/max() 显式排序：

                margin-left = max( min(x0 + D, W - B), min(x0, 0px) )

              · B ≤ W：min(x0,0px)=0 → max(min(x0+D, W-B), 0) = clamp(x0+D, 0, W-B) ✓
              · B > W：x0<0、W-B<0，而 min(x0+D, W-B) ≤ W-B < x0 → 外层 max 恒取 x0，
                即**盒子居中、左右各切一半**（两约束不可能同时满足，这是唯一不偏心的选择）✓

            为什么是 margin-left（不是 transform / left）：
              · 百分比按**包含块宽度**解析 → 与容器同口径。`100vw` 含滚动条（Chrome 下多 ~17px），
                拿它当 W，右缘贴边时又会冒出半条滚动条。
              · B 在 CSS 里 = ar × 渲染高（ar = 素材宽高比）。ar 由 Sprite 在 onLoad 量一次
                naturalWidth/naturalHeight 写进 `--myh-sprite-ar`；视口一变 vh/% 由浏览器自己重算，
                **不需要 JS 定时器或 resize 监听**（红线：常驻定时器会让 render-selftest 挂死）。
              · 量不到 ar 时兜底 1.2893 = 最宽画布 1640/1272：**高估** B → 只会往里收，不会出框。 */
      /* ⚠⚠ 两个槽**必须放到同一个格子**里（`grid-area:1/1`），否则各占一行。
         这是 2026-09-23 用户报的偶发 bug 的根因：
           总高 = 76vh × 2 = 152vh，而 `align-content:end` 会把溢出的 52vh
           顶到视口**上方** → 第一个槽只剩 100vh−152vh=−52vh 起算的那一段可见，
           屏幕上就是"立绘被拦腰截断、底边停在视口约 1/4 高处"。
         ⚠ 只在**交叉淡入进行中**（两个槽同时存在）才触发，动画一结束就恢复 ——
           这正是用户说的"几次之中会有概率触发"。
         ⚠ 用 `grid-area:1/1` 而不是 `grid-template-areas`：两层完全重合，
           交叉期间的定位/尺寸不受影响（两者本来就该像素级对齐）。 */
      '.myh-stage{position:absolute;inset:0;z-index:1;display:grid;align-items:end;align-content:end;justify-items:start;',
      'pointer-events:none;--myh-sprite-x:30vw}',
      '.myh-sprite{grid-area:1/1;--myh-sprite-ar:1.2893;--myh-sprite-bw:calc(var(--myh-sprite-ar) * 76vh);max-width:none;height:76vh;width:auto;',
      'margin-left:max(min(calc(50% - var(--myh-sprite-bw) / 2 + var(--myh-sprite-x,30vw)),calc(100% - var(--myh-sprite-bw))),min(calc(50% - var(--myh-sprite-bw) / 2),0px));',
      /* ★★★ 2026-09-23：立绘换图改成**双槽交叉淡入**（见 Sprite() 里的长注释）。
         两个 `.myh-sprite` 槽轮流当"可见层"：
           · `data-on="true"`  → opacity 1（可见）
           · 其它              → opacity 0（透明，但**仍在 DOM 里**，所以还能淡出）
         过渡挂在 `.myh-sprite` 自己身上，切图时两层同时过渡 → 真正的交叉淡化，
         全程至少一层可见，**没有全透明谷底**（旧的单层实现那个谷底就是"闪一下"的来源）。

         ⚠ `data-on` 为**未设值**（首帧）时走 opacity:1 —— 首屏那张必须可见。
         ⚠ 时长 0.35s：比整屏页的 0.2s 稍长（它是"叠加"而非"替换"，慢一点更自然），
           但远短于背景的 0.6s，不会显得拖沓。 */
      'filter:drop-shadow(0 18px 34px rgba(0,0,0,.45));',
      'opacity:1;transition:opacity .35s ease;will-change:opacity}',
      '.myh-sprite[data-on="false"]{opacity:0}',

      /* ---- 打字机光标 ----
         ★★★ 2026-09-21：这里原来还有一整段 `.myh-cur` / `.myh-curText` ——
         输入框上方那层独立的"当前台词"。用户定案：**「下面这个弹文字的部分删掉」**。
         它其实是"底部对话框"思路的残留：同一句话在正文流里已经显示过一次，
         再在底部大字重播一遍，既有两处文字载体，又占了画面下部一大块。
         现在打字机与光标都进正文流（见 `MessageRow` / `Transcript`），
         **整屏只剩一条文字载体**，与魔夜"文字落在暗带上"一致。
         `.myh-caret` 保留 —— 它现在跟在正文最后一句的句尾。 */
      '.myh-caret{display:inline-block;width:.5em;color:var(--myh-focus-text);',
      'animation:myh-blink 1.1s steps(1,end) infinite}',
      '@keyframes myh-blink{50%{opacity:0}}',

      /* ---- 落叶推进指示器（lineBreak 45×45） ---- */
      '.myh-leaf{position:absolute;right:3.2%;bottom:150px;width:45px;height:45px;',
      'background-repeat:no-repeat;background-position:center;background-size:contain;',
      'animation:myh-leaf 2.6s ease-in-out infinite;pointer-events:none}',
      '@keyframes myh-leaf{0%,100%{transform:translateY(0) rotate(-6deg);opacity:.55}',
      '50%{transform:translateY(10px) rotate(8deg);opacity:1}}',

      /* ================================================================
         ---- 点击唤出菜单：三条离散矩形，只覆盖正文**外侧** ----
         （正文区必须能选中/滚动；输入框那一条必须完整留给 DSH）

         老写法是一个 `inset:0` 的全屏块 + `clip-path:polygon(...)`，用两个
         "逆时针的子路径"挖两个洞（正文矩形 + 输入框那一条）。
         实测故障（`elementFromPoint` 取证）：**输入框中心点命中的是 `.myh-hotzone`**，
         即皮肤自己的热区把输入框吃了 —— 用户点不动、也发不出消息。

         实际算出来的 clip-path 是：
             polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,
                     56px 0px, 56px 1115px, 1910px 1115px, 1910px 0px, 56px 0px,
                     0px 1001px, ...)
         洞① 一路挖到 **1115（画面底边）**，洞② 又从 1001 起挖 —— 两块重叠、
         绕向相消 → **输入框那一条重新变成实心**。

         这类"用多边形绕向表达多个洞"的写法**极难验证**：写错了界面上完全看不出来，
         只能靠数形状，而且每加一个洞就要重新推一遍绕向。**所以整个换掉。**

         新做法：三条**互不重叠**的矩形，各自独立，不做任何几何运算 ——
           ① `.myh-hotL` 左空白条   ② `.myh-hotR` 右空白条   ③ `.myh-hotT` 顶部条
         底部那一条（输入框所在）**没有任何热区覆盖** → 点击必然落到 composer。

         ✓ 红线 13（退化方向）：三块都按"最小可用"给，
           正文宽度量不到时就退化成最窄的左右边条，**绝不退化成整屏**。
         ================================================================ */
      '.myh-hotzone{position:absolute;cursor:pointer;background:transparent;',
      'pointer-events:auto;z-index:9}',
      /* ① 左空白条：正文左缘之外 */
      '.myh-hotL{left:0;top:0;width:var(--myh-hole-l,15%);',
      'bottom:var(--myh-composer-h,96px)}',
      /* ② 右空白条：正文右缘之外 */
      '.myh-hotR{right:0;top:0;width:calc(100% - var(--myh-hole-r,85%));',
      'bottom:var(--myh-composer-h,96px)}',
      /* ③ 顶部条：正文上方（标题条那一点留给皮肤自己，所以很矮） */
      '.myh-hotT{left:var(--myh-hole-l,15%);right:calc(100% - var(--myh-hole-r,85%));',
      'top:0;height:var(--myh-hole-t,0px)}',
      '.myh-hotzone[data-armed="false"]{pointer-events:none}',
      /* ★ 第二道闸：DSH 自己的审批卡/对话框在场时由 JS 打上 data-guard="off"。
         与 data-armed 解耦，两者任一为"关"就彻底不接点击。 */
      '.myh-hotzone[data-guard="off"]{pointer-events:none!important}',
      /* ★★ 审批在场时，**皮肤的整片点击面全部让位**：
         热区 + 正文层都不接点击 —— 保证「批准/拒绝」一定点得到。
         皮肤照常绘制（用户还能看），只是这一瞬间不抢鼠标。
         判据见 uiNeedsPointer()：审批卡自己写的 [data-approval-key]。 */
      '#myh-skin-root[data-guard="off"] .myh-hotzone,',
      '#myh-skin-root[data-guard="off"] .myh-column{pointer-events:none!important}',

      /* ---- L2 菜单板：贴右缘、自右向左滑入 --------------------------------
         ★★★ 2026-09-21 实测更正：原作是【从右边滑入】的（旧实现放 left:0 向左滑，方向反了）。
         menu_window.cbg.png（700×1080）alpha 实测剖面：
             x=0→0, 70→4, 140→20, 210→59, 280→235, 350..700→235
         即只有左缘 285px 羽化，右缘与下缘是硬边。羽化是【融进画面】的一侧，
         硬边是【贴屏幕边】的一侧 → 板子贴右缘，柔边朝画面中央。
         ⚠ 内容必须排在实心区（x≥285 ≈ 板宽 42%）：旧实现 padding:0 26px
           把文字压在羽化段上，正文透过板子透出来 —— 不是缺底板，是文字放错位置。
         板面实测是「暗 #060F16 → 墨蓝 #233243 → 更暗 #020A11」三段渐变 + 底部叶影带，
         且板内原本没有标题、没有分组线（纯背景板）。 */
      /* ★★★ 2026-09-21 现场命中测试确诊：`.myh-hotzone{z-index:9}`，而本面板原在
         `.myh-over`(z8) 内且自身 z-index:auto → **整块面板被右热区盖住**，
         实测 (1420,761)(1500,400)(1300,300) 三点全部命中 `myh-hotR`，
         于是"点会话行/点更多"只会把菜单**关掉**（toggle），根本选不中。
         修法：面板抬到热区之上（10）。面板以外仍是热区，所以"点空白收回"照旧可用。 */
      /* ⚠ 底部留白必须扣掉 DSH composer 的高度（实测 composer 座位 z-index:901 > 皮肤根 900），
         否则面板最下面那 124px 里的一切都点不到 —— 子菜单底部的「返回」正是这样失效的。 */
      '.myh-menu{position:absolute;top:0;bottom:0;right:0;z-index:10;width:clamp(300px,36.5%,46%);',
      'transform:translateX(100%);transition:transform .26s cubic-bezier(.22,.61,.36,1);',
      'display:flex;flex-direction:column;',
      'padding:26px 0 calc(var(--myh-composer-h,96px) + 22px)}',
      '.myh-menu[data-open="true"]{transform:translateX(0)}',
      /* 底板单独一层：金鹿镜像时只翻它，不动内容布局 */
      /* ★★★ 2026-09-21 实测定量：menu_window 是 700×1080，柔边在 **x=278（占宽 39.7%）**
         达到满不透明，右/下/上三缘全是硬边（alpha=235）。
         上一版用 `100% 100%` 把它压到面板宽(584)，等于缩放 0.834 —— 柔边跟着缩到 232px，
         而内容区 margin 是按面板宽算的 42%(245px)，**两者基准不同** → 内容压在柔边上、
         还露出多余的板边。改为等比铺高 + 贴右缘：柔边保持原比例、按高度缩放，不再被压扁。 */
      '.myh-menuBg{position:absolute;inset:0;z-index:0;background-repeat:no-repeat;',
      'background-size:auto 100%;background-position:right center;',
      'filter:drop-shadow(-6px 0 26px rgba(0,0,0,.55))}',
      /* 内容区起点：**与底图同源**。底图按 `auto 100%` 缩放后宽 = 100vh × (700/1080)，
         柔边终点 = 该宽 × 39.7% ≈ 25.7vh。再加 12px 余量，内容就稳稳落在实心区里。
         ⚠ 不能用百分比：百分比 margin 按**面板宽**解析，而柔边是按**面板高**缩放的，
           两个基准不同正是上一版内容压到柔边上的原因（实测 245px vs 232px 差 13px）。 */
      /* 内容区起点：底板右对齐后，柔边**永远占板宽的 40%**（700 图里柔边止于 278），
         所以按板宽百分比取 40% 是与底图同源的写法；下限 200px 防小屏过挤。
         旧的 `25.7vh` 是按底图高度算的，在 1600×900 下给到 243px，
         把内容区压到 321px —— 放大的字全被截断（实测「会话列表（196）」显示成「会话列表（19…」）。 */
      '.myh-menuBody{position:relative;z-index:1;flex:1 1 auto;display:flex;flex-direction:column;',
      'min-height:0;margin-left:max(200px,40%);padding-right:12px}',
      /* 会话区：**只有它滚**。动作区固定在下面，绝不跟着滚（否则永远够不到）。 */
      '.myh-menuList{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;',
      'overflow:auto;overscroll-behavior:contain;padding:2px 4px 2px 2px}',
      /* 2026-09-22：补滚动条样式。它是全文件四个滚动容器里漏配的一个
         （另三个 .myh-column / .myh-scroll / .myh-confBody 都有），
         漏了就会在会话列表右缘露出原生滚动条 —— 与「原生 chrome 让位」的口径不一致。
         两条与那三处逐字一致。 */
      '.myh-menuList::-webkit-scrollbar{width:10px}',
      '.myh-menuList::-webkit-scrollbar-thumb{background:rgba(48,129,152,.5);border-radius:5px}',
      /* ★ 2026-09-22（第 10 条）：列表里的行条与动作条统一放宽（圆角不贴边）。
         ⚠ 左右内边距也必须**与 menuList 一致**，否则列表行 324px、动作区 338px，
         同一屏里两种宽度并排，一眼就看得出来不是一套（实测差 14px）。 */
      '.myh-menuList .myh-mrow,.myh-menuList .myh-act{width:auto;align-self:stretch}',
      '.myh-menu[data-mode="list"] .myh-menuActs{padding:2px 4px 2px 2px}',
      /* 动作区。⚠ 原作菜单板**板内没有任何线**（逐像素扫过：只有渐变 + 底部叶影），
         所以这里不留 border-top。主列表态没有会话区，三项要用 flex 撑到视觉中段，
         而不是贴顶 —— 原作那 8 项就是从上到下一路排开的。 */
      '.myh-menuActs{flex:none;display:flex;flex-direction:column;padding-top:6px}',
      /* 主列表态：上方留白把三项推到偏下的位置（原作的项序是自上而下铺满） */
      '.myh-menu[data-mode="main"] .myh-menuBody{justify-content:center}',
      '.myh-menuInfo{margin:8px 0 0;font-size:11px;letter-spacing:.1em;opacity:.6;line-height:1.7}',
      '.myh-menuEmpty{font-size:13px;letter-spacing:.1em;opacity:.62;padding:12px 2px}',
      /* 子菜单标题：像原作那样给一行小题头，说明"现在在哪一层"。 */
      '.myh-menuCrumb{font-size:12px;letter-spacing:.24em;opacity:.7;padding:2px 2px 8px}',
      /* 场景变暗：原作层 2 = 「画面变暗但仍可见」，不是全屏遮罩。
         用一整屏的 scrim，但**不吃点击**（pointer-events:none），否则会盖掉 DSH。 */
      '.myh-scrim{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;',
      'background:radial-gradient(120% 100% at 30% 50%,rgba(3,7,12,.18),rgba(3,7,12,.55));',
      /* ★★★ 2026-09-23：缓动从 `ease` 改成与 `.myh-menu` **同一个 bezier**。
         这两个是"一次开菜单"的协动部件（板子滑出 + 暗幕变深），时长本来都是
         .26s，但缓动不同 → 前段速度对不上（板子在冲、暗幕在匀），看着像两件事。
         时长保持不变，只统一缓动。 */
      'transition:opacity .26s cubic-bezier(.22,.61,.36,1)}',
      '.myh-scrim[data-on="true"]{opacity:1}',

      /* ---- L1 起始页：菜单块按原作 zc 版落位（左边距约 10%，整块垂直居中） ---- */
      '.myh-titleWrap{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;min-height:0}',
      '.myh-titleList{display:flex;flex-direction:column;gap:0;',
      'width:min(30%,420px);margin-left:10%}',
      /* ★★★ 2026-09-22（用户第 6 条的实际病根）：**L1 必须按明暗主题换字色**。
         `.myh-srow` 的默认色（`#B9D6DE` 暗青 + 极弱冷发光）是给 **L2 那块深色菜单板**
         配的；L1 的背景是壳景 B3（白天，近白的城市），同一套色搬过去**几乎看不见**
         （实测截图：五个菜单项糊在浅色城市上，只能勉强认出轮廓）。
         ⚠ 旧 `.myh-item` 本来就是**主题分色**的（浅 `#462C1D` / 深 `#E6ECEF`），
           是第 3/5/6 条换成 `.myh-srow` 时**把这层分色丢了** —— 这里恢复同一口径：
             · 浅色主题（B3 白天）：墨棕字 + 暖白晕，压在浅底上可读
             · 深色主题（B4 夜）：回到亮青 + 冷发光（与 L2 一致）
         ⚠ 选择器一律带 `.myh-titleList` 前缀 —— **只作用于 L1**，
           绝不碰 L2 的会话行与会话列表行条。 */
      '.myh-titleList .myh-srow{color:#2B1F14;',
      'text-shadow:0 1px 0 rgba(255,255,255,.62),0 0 14px rgba(255,248,236,.85)}',
      '.myh-titleList .myh-srow:hover{color:#162D94;',
      'text-shadow:0 1px 0 rgba(255,255,255,.7),0 0 16px rgba(150,180,255,.6)}',
      '.myh-titleList .myh-srow:focus-visible,.myh-titleList .myh-srow[data-focus="true"]{',
      'color:#0E1747;text-shadow:0 1px 0 rgba(255,255,255,.78),0 0 18px rgba(150,180,255,.7)}',
      /* ⚠ 深色下**不能只靠冷光**：壳景 B4 是「上深蓝星空 + 下亮白雪原」两段，
         「打开工作区」「返回对话」正好落在雪原上 —— 实测亮青字压白底几乎看不见。
         所以每条都加一层**暗晕**打底：暗底上冷光提亮、亮底上暗晕把字托出来。 */
      'body[data-ds-dark-theme] .myh-titleList .myh-srow{color:#CFE9F0;',
      'text-shadow:0 1px 4px rgba(0,12,26,.92),0 0 14px rgba(0,18,38,.75),0 0 6px rgba(88,255,253,.30)}',
      'body[data-ds-dark-theme] .myh-titleList .myh-srow:hover{color:#F2FBFD;',
      'text-shadow:0 1px 4px rgba(0,12,26,.95),0 0 16px rgba(0,18,38,.8),0 0 9px rgba(88,255,253,.6)}',
      'body[data-ds-dark-theme] .myh-titleList .myh-srow:focus-visible,',
      'body[data-ds-dark-theme] .myh-titleList .myh-srow[data-focus="true"]{color:#FFFFFF;',
      'text-shadow:0 1px 5px rgba(0,12,26,1),0 0 22px rgba(0,18,38,.85),',
      '0 0 2px #E8FFFF,0 0 12px #58FFFD,0 0 22px rgba(88,255,253,.9)}',

      /* ---- L2 会话行：原作行条语言（深青底 + 亮青顶边 + 明朝体） ---- */
      /* ==== L2 按钮条：照 menu_btn 实测重画 ====================================
         实测（menu_btn_zc.cbg.png，4 栏 × 8 行，格 409×80）：
           · 条高 **60**、步进 **110**（条间 50px 空档）、宽 **409**
           · 条内**没有图标**，只有左对齐明朝体大字，字距极宽
           · 常态：填充极暗青黑 + **顶部 1px 亮青描边 `#CCF5FE` 贯穿全宽**，底部几乎无边框
           · 聚焦：整条**外圈 1px 亮青闭合描边** + 文字**青白发光**，填充不变、尺寸不变
           · 禁用：描边转灰、文字转灰，其余不动
         两条硬约束（红线 4）：**描边不改变尺寸**（用 outline + 负 offset），
         **聚焦不改填充**，否则整列会抖。 */
      /* ★★★ 2026-09-21 用户定调：**只有文字 + 发光，不要任何框线**。
         撤掉填充、顶边线、outline —— 状态只由"文字"本身表达（亮度 + 发光半径）。
         条本身仍占位（保证可点区域与行距），只是不画出来。 */
      /* ★★★ 2026-09-21 体量对齐原作（这是"相差甚远"的量化根源）：
         原作 1080 基准上 **字身宽 ≈37px、步进 110px**；我之前是 14px 字 / 50px 步进，
         字小 2.2 倍、节奏密 1.8 倍。改用 vh 表达 → 900 高视口得 31px 字 / 92px 步进，
         并随视口等比缩放（与原作者按 1080 画布同一口径）。
         条**不画任何东西**（无填充/无边框/无 outline），只留文字与发光。 */
      '.myh-srow{position:relative;display:flex;flex-direction:column;align-items:stretch;',
      'justify-content:center;width:100%;min-height:calc(7.4vh);margin:0 0 calc(2.8vh);',
      'padding:0 0 0 2px;border:0;background:none;box-shadow:none;outline:none;',
      'cursor:pointer;text-align:left;font-family:var(--myh-mincho);color:#B9D6DE;',
      'text-shadow:0 0 6px rgba(88,255,253,.28);',
      'transition:color .13s ease,text-shadow .13s ease}',
      /* 常态：暗青文字 + 极弱发光；当前会话稍亮一档 */
      '.myh-srow[data-current="true"]{color:#DFF9F9;text-shadow:0 0 8px rgba(88,255,253,.5)}',
      /* 悬停：亮一档 */
      '.myh-srow:hover{color:#EAF6F8;text-shadow:0 0 8px rgba(88,255,253,.55)}',
      /* 聚焦：最亮 + 最强发光（原作聚焦就是"文字发光变强"，没有别的） */
      '.myh-srow:focus-visible,.myh-srow[data-focus="true"]{',
      'color:#FFFFFF;text-shadow:0 0 2px #E8FFFF,0 0 10px #58FFFD,0 0 20px rgba(88,255,253,.85)}',
      /* ⚠ MenuItem 渲染的是 `myh-itemCn` / `myh-itemEn`（不是 srowName/srowMeta），
         所以样式必须挂在这两个类上 —— 上一版写错了选择器，一个都没命中，
         于是会话行一直在用 L1 表紙菜单项的字号(20.7px)，折行后 54px **溢出** 44px 的行高。 */
      '.myh-srow{overflow:hidden}',                       /* 兜底：行内绝不外溢 */
      /* 会话行：标题大字（原作口径 3.45vh ≈ 31px @900），时间小字 */
      '.myh-srow .myh-itemCn{font-size:clamp(19px,3.45vh,38px);letter-spacing:.16em;',
      'line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.myh-srow .myh-itemEn{font-size:clamp(10px,1.25vh,15px);letter-spacing:.08em;',
      'opacity:.5;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      /* 动作条：一行大字、更疏（原作按钮也是单行大字） */
      '.myh-act{flex-direction:row;align-items:center;justify-content:flex-start}',
      /* 字距收到 .12em：原作字距宽是因为每项只有 2–4 字，我的标签最长 9 字
         （「会话列表（196）」），按 .3em 必然截断（实测过）。 */
      '.myh-act .myh-itemCn{font-size:clamp(17px,2.7vh,30px);letter-spacing:.12em;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      /* 更多子菜单的返回：小一号，弱化 */

      /* ---- 金鹿白天（A5）整条方位镜像 --------------------------------------
         跟 data-myh-side 走（= 输入框所在边，由 §景 effect 写在 documentElement 上），
         不新增第二份方位配置（方位只有一个真源）。
         只翻底板（.myh-menuBg），内容层用 margin 换边，文字不镜像。 */
      'html[data-myh-side="right"] body[data-myh-skin] .myh-menu{right:auto;left:0;',
      'transform:translateX(-100%)}',
      'html[data-myh-side="right"] body[data-myh-skin] .myh-menu[data-open="true"]{transform:translateX(0)}',
      'html[data-myh-side="right"] body[data-myh-skin] .myh-menuBg{transform:scaleX(-1);',
      'filter:drop-shadow(6px 0 26px rgba(0,0,0,.55))}',
      'html[data-myh-side="right"] body[data-myh-skin] .myh-menuBody{margin-left:0;margin-right:42%;',
      'padding-right:0;padding-left:22px}',
      'html[data-myh-side="right"] body[data-myh-skin] .myh-srow{text-align:right}',
      'html[data-myh-side="right"] body[data-myh-skin] .myh-mrow{text-align:right}',

      /* ══════════════════════════════════════════════════════════════════
         会话行 = **乐曲界面的行条**（用户 2026-09-22 第 10 条定案）。

         为什么另起一个类而不是改 `.myh-srow`：L1 表紙菜单**也在用** `.myh-srow`
         （纯文字 + 发光，是用户第 3/5/6 条刚定的样子）。
         两者共用一套就会「改会话列表、顺手改掉 L1」 —— 所以拆成两套：
           · `.myh-srow`  纯文字发光，给 L1 用（不动）
           · `.myh-mrow`  圆角行条 + 青边，给会话列表用（新增）

         几何实测自 `mu_text1/3_select_zc.cbg.png`：
           行高 64 / 步进 72 / 圆角 8 / 填充 rgba(1,23,36,.90) / 描边 rgba(42,106,126,.90)
         ⚠ 原作那页是**两列**（各 516px），而 L2 面板内容区只有约 350px ⇒ 这里**单列**。
         用户已认可这条差异（第 10 条选的是「圆角行条 + 青边」，预览即单列）。 */
      '.myh-mrow{position:relative;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;width:100%;box-sizing:border-box;',
      'min-height:64px;margin:0 0 8px;padding:6px 14px;',
      'border-radius:8px;border:1px solid rgba(42,106,126,.9);background:rgba(1,23,36,.9);',
      'cursor:pointer;text-align:center;font-family:var(--myh-mincho);color:#B9D6DE;',
      'text-shadow:0 0 6px rgba(88,255,253,.28);',
      'transition:border-color .13s ease,box-shadow .13s ease,color .13s ease}',
      /* 当前会话：描边亮一档 */
      '.myh-mrow[data-current="true"]{color:#DFF9F9;border-color:rgba(88,255,253,.5);',
      'box-shadow:0 0 8px rgba(88,255,253,.22) inset}',
      /* 悬停：描边与发光都强一档 */
      '.myh-mrow:hover{color:#EAF6F8;border-color:rgba(88,255,253,.62);',
      'box-shadow:0 0 10px rgba(88,255,253,.28)}',
      /* 聚焦：最亮（原作聚焦同样是「整条亮起来」） */
      '.myh-mrow:focus-visible,.myh-mrow[data-focus="true"]{',
      'color:#FFFFFF;border-color:#58FFFD;',
      'box-shadow:0 0 2px #E8FFFF,0 0 12px rgba(88,255,253,.55),0 0 0 1px rgba(88,255,253,.35)}',
      '.myh-mrow .myh-itemCn{font-size:clamp(15px,2.1vh,22px);letter-spacing:.08em;',
      'line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.myh-mrow .myh-itemEn{font-size:clamp(10px,1.15vh,13px);letter-spacing:.04em;',
      'opacity:.55;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      /* 列表里的「返回」也走同一形态，但矮一档，不抢戏 */
      '.myh-mrow.myh-act{flex-direction:row;min-height:52px}',
      '.myh-mrow.myh-act .myh-itemCn{font-size:clamp(14px,1.9vh,20px);letter-spacing:.12em}',
      /* ══════════════════════════════════════════════════════════════════ */

      /* ---- L1 表紙菜单项：title_menu 形态（明朝体大字 + 宽字距） -------------
         ★★★ 2026-09-21 实测更正：title_menu 图集是 2 栏 × 12 行 = 24 格，
         每 6 行 = 一个完整的 6 项菜单 = 一种状态（不是文档说的 6 项 × 4 状态排法）。
         zc（中文）版实测：没有英文小字、也没有下划线 → 这里不再画 En/Rule。
         实测字号/字距：字身宽 ≈37px、步进 ≈49px → letter-spacing ≈0.28em。
         实测四态主色（中位色）：墨棕 #462C1D / 深蓝 #162D94 / 白填充+棕描边 / 白填充+青蓝发光。 */
      '.myh-item{position:relative;display:block;width:100%;padding:9px 4px 8px;border:0;',
      'background:transparent;text-align:left;cursor:pointer;color:#462C1D;',
      'font-family:var(--myh-mincho);transition:color .13s ease}',
      'body[data-ds-dark-theme] .myh-item{color:#E6ECEF}',
      '.myh-itemCn{display:block;font-size:clamp(20px,2.3vh,30px);letter-spacing:.28em;line-height:1.3}',
      '.myh-item:hover{color:#162D94}',
      /* 聚焦态：只加一道发光细边 + 外发光，填充/尺寸不变、无位移（docs/08 §1.3 / 红线 4） */
      '.myh-item:focus-visible,.myh-item[data-focus="true"]{outline:2px solid var(--myh-focus-text);',
      'outline-offset:-3px;color:#FFF;',
      'text-shadow:0 0 2px #E8FFFF,0 0 10px #58FFFD,0 0 18px rgba(88,255,253,.7)}',
      '.myh-item[aria-disabled="true"]{color:#A3A3A3;cursor:default}',

      /* ---- menu_btn 是灰度遮罩表：mask + tint（docs/09 §9.2 坑） ---- */
      '.myh-btn{position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:7px 12px;',
      'border:0;background:transparent;cursor:pointer;font-family:var(--myh-mincho);color:#E9E4D8}',
      '.myh-btnMask{width:26px;height:26px;flex:none;background-color:var(--myh-glow);',
      '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;',
      'mask-position:center;-webkit-mask-size:contain;mask-size:contain}',
      '.myh-btnLabel{font-size:14px;letter-spacing:.2em}',
      '.myh-btn:hover .myh-btnMask{background-color:var(--myh-focus-btn)}',
      '.myh-btn:focus-visible{outline:2px solid var(--myh-focus-btn);outline-offset:-3px}',
      '.myh-btn[aria-disabled="true"] .myh-btnMask{background-color:#A3A3A3}',

      /* ---- 子页：整屏替换 ---- */
      '.myh-page{position:absolute;inset:0;pointer-events:auto;display:flex;flex-direction:column;',
      'animation:myh-bgIn .2s ease both}',
      '.myh-pageBg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      /* 木框 archive_frame：九宫格拉伸，永不整体缩放（docs/08 §2.4） */
      '.myh-wood{position:absolute;inset:0;border-style:solid;border-width:34px;',
      'border-image-slice:96 fill;border-image-repeat:stretch;pointer-events:none}',
      /* ⚠ 底部必须扣掉 composer 高度（实测 composer 座位 z-index:901 > 皮肤根 900，
         盖在皮肤之上且吃掉点击）。不扣的话：工作区列表最下 30px 压进输入框底下、
         设置页的低位控件直接落在视口外。与 `.myh-menu` 用的是同一修法。 */
      '.myh-pageInner{position:relative;flex:1 1 auto;display:flex;flex-direction:column;',
      'padding:46px 58px calc(var(--myh-composer-h,96px) + 24px);min-height:0}',
      '.myh-pageTitle{align-self:flex-start;height:40px;min-width:180px;background-repeat:no-repeat;',
      'background-position:left center;background-size:contain;margin-bottom:14px}',
      '.myh-pageHint{font-size:12px;letter-spacing:.18em;opacity:.72;margin-bottom:12px}',
      '.myh-scroll{flex:1 1 auto;overflow:auto;min-height:0;padding-right:7px}',
      '.myh-scroll::-webkit-scrollbar{width:10px}',
      '.myh-scroll::-webkit-scrollbar-thumb{background:rgba(48,129,152,.5);border-radius:5px}',



      /* ---- 環境設定（2026-09-22 重做：按原著五页签布局） ----
         ★★★ 用户原话：「皮肤设置界面完全不合格。相比于之前不是根本就没有改过吗？」
                     「你啥没有原著设置参考页？原著就在项目中啥是没有？是你自己没有看」

         他说得对。此前这里是**竖排四组自造开关清单**（自拟的"角色/画面/声音/彩蛋"
         分组 + 自造开关 + 自造滑条），与原作毫无关系。真正的原著環境設定从
         `hfa_png/out/data00000/` 的实图读出如下（全部逐像素量过）：

           conf_title_zc   600×88   标题「环境设置」白字 + 下划线
           btn_base0_zc   1648×384  五页签 × 四态，322×79 一格
                                   「声音设置 / 语音设置 / 文本设置 / 操作设置 / 操作说明」
           btn_base2_zc    940×364  选项按钮 × 四态，216×72 一格
                                   「OFF / ON / 2ch / 5.1ch」—— OFF/ON 正是原作自己的布尔控件
           btn_default_zc  608×420  「恢复初始设置」× 四态，526×78 一格
           conf_sbtn        64×132  滑条旋钮两态（上=亮白青光晕 / 下=灰）
           conf_stxt01_zc  244×84   滑条两端「小 大」
           conf_stxt2_zc   244×84   滑条两端「慢 快」
           conf_manual1_zc 1736×840 第五页「操作说明」的键位表整页

         ★ 关键事实：**这一屏的文字全部烧在 PNG 上** —— 250 个编译脚本里没有一条
           设置页文案（只有 `test_script.chs` 出现过「音量」二字）。原作就是这么画的，
           所以「切图就有字」才是正确还原方式，也是此前"从素材尺寸瞎猜文案"必然失败的原因。
         ★ 因此分工是：**文字烧在图上的部件直接用真图**（页签 / OFF·ON / 恢复按钮 /
           小大 / 慢快）；**需要显示我们自己的文字的部件**（页签上的项名）用 CSS
           按实测色值画 —— 选中填充 rgb(10,98,95)、未选中 rgb(6,53,52)、
           描边 rgb(174,255,250)。不是偷懒，是"能用真图的地方一律用真图"。
         ★ 所有部件按 `aspect-ratio` 定比例，**绝不拉伸变形**（红线 3）。
         切片产物在 `skin/assets/ui/conf/`（80 个文件，由 .tmp/crop-conf.py 从图集裁出）。 */
      /* ★★★ 2026-09-22 修：**外框不许被拉伸**（红线 3）。
         `conf_frame` 原图 1820×936（aspect 1.9444），而这里原来是
         `width:100%` + `background-size:100% 100%` —— 面板跟着视口比例变，
         实测两个视口分别是 **2.1020（+8.1%）** 与 **1.9208（-1.22%）**，
         同一张外框变成两个形状。
         现在把**盒子**锁在原图比例上，由高度驱动宽度、水平居中
         （`.myh-pageInner` 是 column flex，`align-self:center` 即水平居中；
           auto 外边距同时使 align-self 不再 stretch，宽度才会由比例算出）。
         `max-width/max-height:100%` 保证永远不会溢出视口。 */
      '.myh-conf{position:relative;display:flex;flex-direction:column;box-sizing:border-box;',
      'aspect-ratio:1820/936;align-self:center;width:auto;max-width:100%;max-height:100%;',
      'margin:0;flex:1 1 auto;min-height:0;gap:14px;',
      'padding:34px clamp(26px,3.6vw,60px)}',
      '.myh-conf::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;',
      'background-image:var(--myh-confFrame,none);background-repeat:no-repeat;',
      'background-size:100% 100%;filter:drop-shadow(0 0 26px rgba(88,255,253,.10))}',
      '.myh-conf>*{position:relative;z-index:1}',
      /* 标题：conf_title_zc（600×88 含下划线）。按宽高比缩，不拉伸。 */
      '.myh-confTitle{flex:none;align-self:flex-start;height:42px;aspect-ratio:600/88;',
      'background-repeat:no-repeat;background-position:left center;background-size:contain}',
      /* 页签条：五格横排。每格 322×79，用 aspect-ratio 锁比例。 */
      '.myh-confTabs{flex:none;display:flex;gap:8px;flex-wrap:wrap}',
      '.myh-tab{flex:none;height:46px;aspect-ratio:322/79;padding:0;border:0;margin:0;',
      'background:transparent;background-repeat:no-repeat;background-position:center;',
      'background-size:100% 100%;cursor:pointer}',
      '.myh-tab:hover,.myh-tab[data-focus="true"]{',
      'filter:drop-shadow(0 0 3px #E8FFFF) drop-shadow(0 0 10px rgba(88,255,253,.50))}',
      /* 页体：可滚动，纵向排项 */
      '.myh-confBody{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;',
      'gap:10px;padding:8px 2px 2px}',
      '.myh-confBody::-webkit-scrollbar{width:10px}',
      '.myh-confBody::-webkit-scrollbar-thumb{background:rgba(48,129,152,.5);border-radius:5px}',
      /* 一行 = 左标签 + 右控件组（原著就是这个排法） */
      '.myh-crow{display:flex;align-items:center;gap:18px;padding:7px 4px;border-radius:6px;',
      'transition:box-shadow .13s ease}',
      /* ★ 焦点反馈与全文件其它可聚焦项一致：**只加发光细边，不改填充、不改尺寸**（红线 4）*/
      '.myh-crow[data-focus="true"]{box-shadow:inset 0 0 0 1px #58FFFD,0 0 2px #E8FFFF,',
      '0 0 12px rgba(88,255,253,.40)}',
      '.myh-clab{flex:1 1 auto;font-size:13px;letter-spacing:.12em}',
      '.myh-clab small{display:block;opacity:.62;font-size:11px;letter-spacing:.04em;margin-top:3px}',
      /* 控件组：OFF / ON 或角色按钮 */
      '.myh-opts{flex:none;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      /* ★ 布尔按钮用**真图**（btn_base2_zc 的 OFF / ON 两枚，216×72 一格）
         —— s0 = 被选中（亮青填充 rgb(10,98,95) + 青描边 rgb(174,255,250)）
            s1 = 未选中（暗青填充 rgb(6,53,52)） */
      '.myh-opt{flex:none;height:38px;aspect-ratio:216/72;padding:0;border:0;margin:0;',
      'background:transparent;background-repeat:no-repeat;background-position:center;',
      'background-size:100% 100%;cursor:pointer;position:relative}',
      '.myh-opt[data-focus="true"]{',
      'filter:drop-shadow(0 0 3px #E8FFFF) drop-shadow(0 0 9px rgba(88,255,253,.50))}',
      /* 角色按钮同理：焦点要能落在**具体那一个**上（与 OFF/ON 同一套语义）。 */
      '.myh-optTxt[data-focus="true"]{',
      'filter:drop-shadow(0 0 3px #E8FFFF) drop-shadow(0 0 9px rgba(88,255,253,.50))}',
      /* 设置页的暗底：压在 L1 壳景之上、面板之下。
         没有它的话，壳景（尤其 B4 那种亮底）会把面板上的白字吃掉。 */
      '.myh-confScrim{position:absolute;inset:0;pointer-events:none;',
      'background:linear-gradient(180deg,rgba(4,7,11,.58),rgba(4,7,11,.70))}',
      /* 需要自有文字的按钮（角色名）：按实测色值画，比例与真图一致 */
      '.myh-optTxt{display:flex;align-items:center;justify-content:center;height:38px;',
      'min-width:96px;padding:0 16px;border-radius:8px;border:1px solid rgba(174,255,250,.55);',
      'background:rgb(6,53,52);color:#EAF7F8;font-family:var(--myh-mincho);font-size:13px;',
      'letter-spacing:.10em}',
      /* ★★★ 2026-09-22 修：**键名必须与 DOM 一致**。
         DOM 侧用 `role="radio"` + `aria-checked`（见 ConfigPage 的角色组），
         而这里原来写的是 `[aria-pressed="true"]` —— 于是规则**永不匹配**，
         三格全都是未选中色 `rgb(6,53,52)`，**当前角色在屏幕上没有任何标识**。
         实测（CDP 读 computed）：`aria-checked="true"` 挂在有珠那格，
         但 `backgroundColor` 仍是 `rgb(6,53,52)`。
         ⚠ 同时保留 `aria-pressed` 一条，用来兜"将来有人改回 toggle 语义"的情况。 */
      '.myh-optTxt[aria-checked="true"],.myh-optTxt[aria-pressed="true"]{',
      'background:rgb(10,98,95);border-color:#AEFFFA;box-shadow:0 0 10px rgba(166,250,255,.35)}',
      /* 音量：**五个档位方块**（0 / 25 / 50 / 75 / 100）。
         ★ 2026-09-23（用户第 2 版）：原来是一条滑条 + 两端 小/大，而两端是**硬跳**
           （一点就 0 或 1），手感是「一下最大 / 一下最小」。
           现在与布尔行的 OFF / ON 同一套观感（青描边 + 选中填充 + 焦点环），
           只是从两枚变五枚，方块里直接写百分比数字。
         ⚠ 容器类名保留 `.myh-sl` —— 页根的排除表用的是它（ConfigPage 的 onClick）。 */
      '.myh-sl{flex:none;display:flex;align-items:center;gap:6px}',
      '.myh-step{display:flex;align-items:center;justify-content:center;height:32px;',
      'min-width:52px;padding:0 10px;border-radius:8px;border:1px solid rgba(174,255,250,.55);',
      'background:rgb(6,53,52);color:#EAF7F8;font-family:var(--myh-mincho);font-size:12.5px;',
      'letter-spacing:.04em;cursor:pointer;user-select:none}',
      '.myh-step[data-on="true"]{background:rgb(10,98,95);border-color:#AEFFFA;',
      'box-shadow:0 0 10px rgba(166,250,255,.35)}',
      '.myh-step[data-focus="true"]{filter:drop-shadow(0 0 3px #E8FFFF) drop-shadow(0 0 9px rgba(88,255,253,.50))}',
      /* 底部：恢复初始设置（btn_default_zc 的 526×78 一格） */
      '.myh-confFoot{flex:none;display:flex;justify-content:center;padding-top:2px}',
      '.myh-dflt{flex:none;height:39px;aspect-ratio:526/78;padding:0;border:0;margin:0;',
      'background:transparent;background-repeat:no-repeat;background-position:center;',
      'background-size:100% 100%;cursor:pointer}',
      '.myh-dflt:hover,.myh-dflt[data-focus="true"]{',
      'filter:drop-shadow(0 0 3px #E8FFFF) drop-shadow(0 0 10px rgba(88,255,253,.50))}',
      /* 操作说明页：原著那一页是键位表（conf_manual1_zc 整页图）。
         ⚠ 那张图上写的是**游戏本体**的键位（A/B/X/Y、Alt+F4…），套到皮肤上会误导，
         所以第五页显示**本皮肤自己的操作**，字体与配色沿用原作（明朝体 + 白字）。 */
      '.myh-confNote{margin:0;font-family:var(--myh-mincho);font-size:12.5px;line-height:2.1;',
      'letter-spacing:.10em;opacity:.92;white-space:pre-line}',
      '.myh-confNote b{color:#AEFFFA;font-weight:400}',
      '.myh-confStat{margin-top:14px;font-size:11.5px;letter-spacing:.10em;opacity:.66}',

      /* ---- ED 彩蛋 ---- */
      '.myh-ed{position:absolute;inset:0;z-index:40;background:#04070B;overflow:hidden;',
      'animation:myh-bgIn 1.4s ease both}',
      '.myh-edBg{position:absolute;left:0;right:0;width:100%;height:auto;object-fit:cover;',
      'object-position:50% 0;animation:myh-edPan 70s linear both;opacity:.92}',
      '@keyframes myh-edPan{from{transform:translateY(0)}to{transform:translateY(-16%)}}',
      '.myh-edScrim{position:absolute;inset:0;',
      'background:linear-gradient(180deg,rgba(4,7,11,.55),rgba(4,7,11,.2) 35%,rgba(4,7,11,.72))}',
      '.myh-edRoll{position:absolute;left:0;right:0;bottom:-45%;display:flex;flex-direction:column;',
      'align-items:center;gap:20px;animation:myh-edRoll 44s linear both}',
      '@keyframes myh-edRoll{from{transform:translateY(0)}to{transform:translateY(-250%)}}',
      '.myh-edTitle{font-size:clamp(26px,4.2vh,52px);letter-spacing:.34em;color:#F5F1E6;',
      'text-shadow:0 4px 24px rgba(0,0,0,.7)}',
      '.myh-edSub{font-size:clamp(11px,1.5vh,15px);letter-spacing:.5em;color:#AFC3CB}',
      '.myh-edLine{font-size:clamp(12px,1.7vh,17px);letter-spacing:.18em;color:#DDE4E6;',
      'text-align:center;line-height:1.9;opacity:.92}',
      '.myh-edHint{position:absolute;right:3%;bottom:3%;font-size:12px;letter-spacing:.2em;opacity:.5}',

      /* ---- 无障碍与降级 ---- */
      '@media (prefers-reduced-motion:reduce){',
      /* ★★★ 2026-09-23：**补全漏掉的选择器**。原来只列了 bg/sprite/menu/leaf/
         edBg/edRoll/caret，于是开了"减弱动态效果"的用户，**整屏页淡入、菜单暗幕、
         背景换图、正文列淡入、composer 卡片变色仍然在动** —— 降级声明不完整。
         现在把上述几类都收进来；`.myh-bgFade` / `.myh-page` / 正文列的
         animation 一并取消（它们的效果是纯 opacity，取消后直接显示终态）。

         ⚠ `.myh-columnInner` **不能写进上面那条选择器列表**：离线自检
           （check-client.mjs 的 padding / flex / 对齐三组断言）用
           `css.match(/\.myh-columnInner\{([^}']*)/)` 抓**第一条**匹配，
           而这个降级块排在正式规则之前 —— 写进去就会让断言抓到这个空盒子，
           3 项**假失败**（本次实测踩过）。所以正文列单独用一条**只含 animation**
           的规则收尾：它不影响上面那条匹配（那里找的是 `padding:`），
           而 `transition` 正文列本来也没有。

         ⚠ `.myh-toolDot`（工具调用进行中的脉冲）**故意不收**：
           它是**语义指示**（"工具在跑"），`animation:none` 会让状态看不出来。
           单独给它一条静态高亮规则，保住"看得见"这件事。 */
      'body[data-myh-skin] .myh-bg,body[data-myh-skin] .myh-bgFade,body[data-myh-skin] .myh-sprite,',
      'body[data-myh-skin] .myh-menu,body[data-myh-skin] .myh-scrim,body[data-myh-skin] .myh-leaf,',
      'body[data-myh-skin] .myh-edBg,body[data-myh-skin] .myh-edRoll,body[data-myh-skin] .myh-caret,',
      'body[data-myh-skin] .myh-page,body[data-myh-skin] [data-composer-card]',
      '{animation:none!important;transition:none!important}',
      /* 正文列：只取消 animation，不进上面那条列表（理由见上）。 */
      '#myh-skin-root .myh-columnInner{animation:none!important}',
      /* 工具指示：去掉脉冲，但保留"在跑"的高亮，否则状态不可见。 */
      'body[data-myh-skin] .myh-toolDot{animation:none!important;opacity:1!important}',
      'body[data-myh-skin] .myh-edRoll{bottom:8%}}',
      /* ★ 窄视口（视口宽/高 < 1820/936 时，上面的 max-width 会咬住 → 又会变形）：
         改成**宽度驱动 + 高度由比例推出**，仍然不变形；内容超出就由 pageInner 滚动。 */
      /* ★★★ 2026-09-22 补：**视口太矮**也要走这条路（实测回归）。
         只判宽高比时，1600×420 这种矮窗口会这样：面板锁了比例 + `max-height:100%`
         → 高度被 cap 到 272 → 宽度跟着缩到 ~400 → 五枚页签（各 187px）放不下
         → 折成 **5 行** → 标题+页签+页脚把盒高吃光，`.myh-confBody` 被 `min-height:0`
         压到 **2px**，页脚（恢复初始设置）被顶到 477、**跑出视口**。
         实测阈值：页体可视 580px→93、540px→10、500px→2；页脚 ≤420 出界。
         所以触发条件加 `(max-height:600px)` —— 仍在 540–580 那档之上，留了余量。
         ⚠ 比例本身一直是对的（各档 distPct 全 0），所以**不放松 aspect-ratio**，
           只是让盒子改由宽度驱动，内容超出交给 pageInner 滚动。 */
      '@media (max-aspect-ratio:1820/936),(max-height:600px){',
      'body[data-myh-skin] .myh-pageInner{overflow:auto}',
      /* 2026-09-22：同上，补滚动条样式。矮视口（高度 <=600px）下它必须能滚
         （实测可滚量 229-529、滚到底页脚可达），但露的是原生滚动条。 */
      'body[data-myh-skin] .myh-pageInner::-webkit-scrollbar{width:10px}',
      'body[data-myh-skin] .myh-pageInner::-webkit-scrollbar-thumb{background:rgba(48,129,152,.5);border-radius:5px}',
      'body[data-myh-skin] .myh-conf{width:100%;height:auto;max-height:none;flex:0 0 auto}}',
      /* ★★★ 2026-09-22 修：**设置页把那 148px 的输入框让位收回去**（实测 sbW=8 → 0）。
         上面那条媒体查询在 1600×900（aspect 1.778）就命中，pageInner 成了滚动容器；
         而下内距还是 `calc(--myh-composer-h + 24px)` = 148px（给 composer 让位），
         于是内容 46+759+148=953 > 900 → **多出一条 8px 原生滚动条**，
         可用宽从 1484 缩到 1476、面板跟着缩到 1476×759。
         但设置页的皮肤根带 `data-myh-page="on"` → z-index **950**，而 composer 座位是
         **901** —— 输入框本来就被整片盖住，留白只把内容顶出可视区、白生滚动条。
         ⚠ **只对设置页收**：`.myh-pageInner` 是 L1 / 工作区列表 / 设置页共用的，
           L1 那两处真的需要让位（否则最下 30px 压进输入框底下）。
           `:has(.myh-conf)` 全文件已有 12 处先例（`html:has(body[data-myh-skin])` 等）。
         实测：sbW 8 → **0**、面板 1476×759 → **1484×763**、页体 520 → **524**、
         比例仍 **0%**、页签仍 **1 行**。 */
      'body[data-myh-skin] .myh-pageInner:has(.myh-conf){padding-bottom:24px}',
      '@media (max-width:700px){',
      'body[data-myh-skin] .myh-menu{width:100%}',
      /* ⚠ 这里**不能写 `opacity`**（2026-09-23 修）。
         立绘现在是双槽交叉淡入，显隐由 `.myh-sprite[data-on]` 的 opacity 驱动。
         而 `body[data-myh-skin] .myh-sprite` 的优先级**高于** `.myh-sprite[data-on="false"]`，
         一旦在这里写 `opacity:.9`，窄屏下两层都会停在 0.9 ——
         交叉淡化失效、两张立绘叠着显示。
         窄屏"立绘淡一点"的效果改用 `filter` 实现（与显隐控制互不干扰）。 */
      'body[data-myh-skin] .myh-sprite{height:60vh;--myh-sprite-bw:calc(var(--myh-sprite-ar) * 60vh);',
      'filter:drop-shadow(0 18px 34px rgba(0,0,0,.45)) brightness(.9)}',


      'body[data-myh-skin] .myh-pageInner{padding:26px 20px 22px}',
      'body[data-myh-skin] .myh-wood{border-width:16px;border-image-slice:64 fill}}',
    ].join('\n')

    // ==================================================================
    // §2 桥：manifest / 设置
    // ==================================================================

    const manifestBox = { m: null }
    const settingsBox = { s: null }
    const spriteBox = { t: {} }
    let lexiconIndex = []

    function fetchManifest() {
      return fetch(ROUTE + '/manifest.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('manifest HTTP ' + r.status)
        return r.json()
      })
    }
    function fetchSettings() {
      return fetch(ROUTE + '/settings', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('settings HTTP ' + r.status)
        return r.json()
      })
    }
    function pushSettings(patch) {
      return fetch(ROUTE + '/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(function (r) {
        if (!r.ok) throw new Error('settings write HTTP ' + r.status)
        return r.json()
      })
    }

    // ==================================================================
    // §3 共享 store
    // ==================================================================

    const store = createStore({
      ready: false, error: '', dark: false,
      character: 'aoko', scene: 'A3', bg: '', sprite: '', slot: 'neutral', line: '',
      agent: 'idle', menu: false, page: null, ed: false,
      pressure: null, sessions: [], sessionId: null, fushin: [],
      workspaces: [], workspaceId: null, titleMode: 'menu', menuMode: 'main',
      settings: null, tabFallback: false, confTab: 'sound',
      /** ★ 自己画正文用的会话流（由 SessionSensor 写入）。 */
      messages: [],
    })

    /** 由 SessionSensor 写入的实时状态。 */
    const live = { sessionId: null, running: false, text: '', sessions: [], workspaceId: null, workspaces: [] }

    /**
     * 路径归一化：只在"比较"时用，不改写任何存下来的路径。
     *   · Windows 路径大小写不敏感 → 统一小写
     *   · 反斜杠/正斜杠混用 → 统一成 `/`
     *   · 末尾多余的斜杠 → 去掉
     */
    function normPath(p) {
      /* ⚠ 用 `\/+` 而不是 `\/+$`：**任意位置**的重复分隔符都折叠成一个。
         实测复算里 `D:\\DeepSeek\\`（重复分隔符）在只处理"末尾"的写法下
         会变成 `d://deepseek`，与 `d:/deepseek` 匹配不上 → 判成"无归属"。
         折叠全体分隔符后两侧归一结果一致（UNC `\\server\share` 同样如此），
         不会引入新的不对称。 */
      return String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase()
    }

    /**
     * 会话 → 工作区 id。**两级判定**（2026-09-22 修正）：
     *
     *   ① `WorkspaceView.sessionIds` 里有 → 直接归属（权威，DSH 自己记的）
     *   ② 否则按 **cwd 最长前缀**匹配工作区 `path`
     *
     * 为什么必须加 ②：实测本项目 208 条会话里，只有 **19 条**出现在任何
     * `sessionIds` 里 —— 因为那个列表只记"从工作区入口进去过"的会话，
     * 而从项目目录直接开的会话不在其中。于是 `sessionsOfWorkspace()` 的
     * `!x.wid || x.wid === wsid` 把 189 条"无归属"的全部放行 ⇒
     * **L2 列出了一整个 DSH 的所有聊天**（用户报的就是这个）。
     *
     * ② 的可靠性已实测：运行时 `cwd` 样本正好是
     *   `D:\DeepSeek` / `D:\DeepSeek\APP1` / `D:\QuickLook插件包\moye`，
     * 与 `workspace.json` 里的 `path` 逐字对应；且
     *   109 + 2 + 97 = 208 = 会话总数（按目录计数完全自洽）。
     *
     * ⚠ 用**最长前缀**而不是相等：`workspace.json` 里有 4 个工作区，
     *   而投影只给了 3 个（少的是 `…\moye\WITCH ON THE HOLY NIGHT.7z`）。
     *   若只做相等匹配，落在那个子目录的会话会变成"无归属"被丢掉；
     *   最长前缀会把它归到 `…\moye`，**不丢任何会话**。
     */
    function widOfSession(id, cwd) {
      const ws = live.workspaces || []
      /* ① 权威来源：sessionIds */
      for (let i = 0; i < ws.length; i++) {
        const ids = ws[i].sessionIds || []
        for (let k = 0; k < ids.length; k++) if (ids[k] === id) return ws[i].id
      }
      /* ② 兜底：cwd 最长前缀 */
      const c = normPath(cwd)
      if (!c) return null
      let best = null
      let bestLen = -1
      for (let i = 0; i < ws.length; i++) {
        const p = normPath(ws[i].path)
        if (!p) continue
        /* 前缀匹配必须落在**路径边界**上：`/a/b` 不该匹配 `/a/bc` */
        if (c === p || c.indexOf(p + '/') === 0) {
          if (p.length > bestLen) { bestLen = p.length; best = ws[i].id }
        }
      }
      return best
    }

    /** 本工作区的会话（L2 列表与键盘焦点表共用同一真源）。 */
    /** 会话行展示用的一次性投影：标题 + 一句有信息量的副标题（不放 cwd —— 198 行全一样）。 */
    function sessionRowsOf(s) {
      return sessionsOfWorkspace(s).map(function (x) {
        let meta = ''
        if (x.running) meta = '生成中'
        else if (x.blank) meta = '空对话'
        if (x.updatedAt) {
          const d = new Date(x.updatedAt)
          if (!isNaN(d.getTime())) {
            const pad = function (n) { return (n < 10 ? '0' : '') + n }
            const t = pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
            meta = meta ? (meta + ' · ' + t) : t
          }
        }
        return { id: x.id, title: x.title, meta: meta, running: x.running }
      })
    }

    /**
     * 本工作区的会话（L2 列表与键盘焦点表共用同一真源）。
     *
     * ★★★ 2026-09-22（用户：**会话列表会展现所有聊天，而不只是这个工作区的**）
     *   原判据是 `!x.wid || x.wid === wsid` —— "**无归属就放行**"。
     *   而实测 208 条里只有 19 条有 `wid`（`sessionIds` 只记过入口打开的那些），
     *   于是 189 条被放行 ⇒ 列表成了"这台机器上所有会话"。
     *   现在改成**严格按归属筛**：`wid` 由 `widOfSession()` 的两级判定给出
     *   （sessionIds → cwd 最长前缀），所以"无归属"是**真无归属**
     *   （既不在 sessionIds 里、cwd 也匹配不上任何工作区），那种才该排除。
     *
     *   退化方向（红线 13）：`workspaceId` 本身拿不到时**仍然返回全部** ——
     *   宁可多显示，也不要在一个认不出自己身份的环境里把列表清空。
     */
    function sessionsOfWorkspace(s) {
      const wsid = s.workspaceId
      const all = s.sessions || []
      if (!wsid) return all
      return all.filter(function (x) { return x.wid === wsid })
    }

    /**
     * 当前界面的导航 id 表（键盘上下键用）。
     * 与画面**同一真源**：L2 读 sessionsOfWorkspace，L1 读 workspaces。
     * 不能写死一份 —— 会话随工作区变，写死就会走到不存在的项上。
     */
    function navIdsOf(s) {
      if (s.page === 'title') {
        if (s.titleMode === 'workspaces') {
          return ['newws']
            .concat((s.workspaces || []).map(function (w) { return 'ws:' + w.id }))
            .concat(['back'])
        }
        /* ★ 2026-09-22（用户第 1 条）：`dskset`（界面设置）**已删除**。
           原话「界面设置还是没用，直接删了吧」——
           那个动作是"放出侧栏 + 去点 DSH 自己 aria-label 为『设置』的按钮"，
           在 DSH 版本变动后一直不可靠，删掉比留着半坏更干净。
           ⚠ 焦点表与菜单项必须**同时**删，只删一处会让键盘焦点落到不存在的项上。 */
        return ['setskin', 'newws', 'openws', 'back']
      }
      /* ★★★ 2026-09-22（用户第 6 条）：**设置页也纳入这套焦点表**。
         原来 `navIdsOf` 只认 L1/L2，`config` 页返回的是 `['new','list','back']`
         —— 方向键在设置页会去移动**菜单**的焦点，而屏幕上根本没有那个菜单。
         现在按页面自上而下的顺序给出设置项，末位是「返回」。 */
      /* ★★★ 2026-09-22（原著五页签重做）：焦点表按**当前页签**算 ——
         五枚页签永远在表里，其后是**本页**的项，末位是页脚的「恢复初始设置」。
         ⚠ 没有 `c:back`：原著这一屏的退回是**左键 / Esc**（见 handleMenuBack），
           页面上不存在「返回」按钮，焦点表里也不该有。 */
      if (s.page === 'config') {
        const ctab = CONF_TABS.indexOf(s.confTab) >= 0 ? s.confTab : 'sound'
        /* 2026-09-22（用户第 2 条）：**行要展开成选项**。
           原来这里直接给 `CONF_ROWS[ctab]`（纯行 id），方向键只能停在行上，
           行内的 OFF / ON 与角色名**永远拿不到焦点**，也就选不中。
           现在：有 CONF_OPTS 的行展开成 `c:bgm#off` / `c:bgm#on`；没有的保持行级。 */
        const rows = CONF_ROWS[ctab] || []
        const flat = []
        for (let i = 0; i < rows.length; i++) {
          const base = rows[i]
          const opts = CONF_OPTS[base]
          if (opts) {
            for (let k = 0; k < opts.length; k++) flat.push(base + '#' + opts[k])
          } else {
            /* ★ 2026-09-23：音量那行是**五个档位方块**，每档各是一个焦点项
               （`c:vol#0` … `c:vol#4`），与布尔行的 OFF / ON 同理 ——
               方向键能走进去并直接选中。 */
            if (base === 'c:vol') {
              for (let k = 0; k < 5; k++) flat.push(base + '#' + k)
            } else {
              flat.push(base)
            }
          }
        }
        return CONF_TABS.map(function (t) { return 't:' + t })
          .concat(flat)
          .concat(['c:dflt'])
      }
      /* ★★★ 2026-09-21 用户定案：**L2 主列表不列会话**，只放固定项；
         会话列表挪进「会话列表」子菜单（menuMode === 'list'）。 */
      if (s.menuMode === 'list') {
        return sessionsOfWorkspace(s).map(function (x) { return 'sess:' + x.id }).concat(['listback'])
      }
      return ['new', 'list', 'back']
    }

    /**
     * ★ 只读诊断口（2026-09-21）。
     *
     * 为什么需要它：`readMessages()` 的输入是 DSH 的 `ChatSnapshot`，而那个对象
     * **在 React 闭包里、从外部拿不到**（`useChat` 是 `useSyncExternalStore` 包装，
     * 直接调用会抛 React error #321）。于是"正文为什么空"这件事只能靠**转述**，
     * 而 `docs/26`/`docs/27` 的教训正是"别再靠转述判断"。
     *
     * 所以：把**刚算出来的那份原始快照**留一个引用在这里，
     * 诊断时用 `window.__myhDebug().chat` 就能原地复算 `readMessages(snap)`。
     * **纯只读**：只赋值、不读取参与任何判定，也不写回 store。
     * ⚠ 只存引用，不深拷贝 —— 避免每条消息复制一份 DOM 快照级别的大对象。
     */
    const debugChat = { snapshot: null }

    /** 情绪引擎状态（跨渲染保留）。 */
    const emo = { slot: 'neutral', since: 0, weakStreak: 0, lastSwitch: 0, roll: 0, sentence: '' }

    // ==================================================================
    // §4 情绪分类器与分句（spec-switching §2 / §4 / §4.6）
    // ==================================================================

    /** 词表索引：长词优先（避免「笑」吃掉「苦笑」）。 */
    function buildLexiconIndex(lexicon) {
      const pairs = []
      for (const slot of Object.keys(lexicon || {})) {
        const arr = lexicon[slot]
        for (let i = 0; i < arr.length; i++) pairs.push([arr[i].w, slot, arr[i].n])
      }
      return pairs.sort(function (a, b) { return b[0].length - a[0].length })
    }

    /**
     * ★★ 角色专属词表（2026-09-19）——
     * 三个人物的口癖差别极大：青子外放毒舌（莫迦ね／真是的）、
     * 有珠走「更冷更短沉默」、金鹿是吐槽式（なにそれ／ふてくさ）。
     * 通用词表听不懂这些说法，于是把 `manifest.lexiconByCharacter[角色]` 并进来。
     * 数据来源：`skin/tools/persona-emotions.mjs` ← 各 skill 的 `references/voice.md`。
     * 合并规则与 `skin/tools/lexicon-build.mjs` 的 `mergeLexicon` 一致（同词取较大权重）。
     */
    function mergeLexicon(base, extra) {
      const out = {}
      const slots = Object.keys(base || {}).concat(Object.keys(extra || {}))
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        if (out[slot]) continue
        const m = {}
        const add = function (arr) {
          for (let k = 0; arr && k < arr.length; k++) {
            const e = arr[k]
            m[e.w] = Math.max(m[e.w] || 0, e.n)
          }
        }
        add((base || {})[slot])
        add((extra || {})[slot])
        out[slot] = Object.keys(m).map(function (w) { return { w: w, n: m[w] } })
      }
      return out
    }

    const lexiconCache = { key: '', index: [] }

    /** 按"当前角色"取词表索引（角色或 manifest 变了就重建）。 */
    function activeLexicon() {
      const m = manifestBox.m
      const ch = (settingsBox.s && settingsBox.s.character) || ''
      const key = ch + '|' + ((m && m.generated_at) || '')
      if (lexiconCache.key !== key) {
        const extra = (m && m.lexiconByCharacter && m.lexiconByCharacter[ch]) || null
        const lx = extra ? mergeLexicon(m.lexicon || {}, extra) : ((m && m.lexicon) || {})
        lexiconCache.key = key
        lexiconCache.index = buildLexiconIndex(lx)
        lexiconIndex = lexiconCache.index
      }
      return lexiconCache.index
    }

    /**
     * 一句中文 → {slot, score, conf, words}。
     *
     * ★ 计分规则：命中一个词时，**给所有含该词的槽位都加该槽位的权重**。
     * 于是歧义词（如「点头」既在 smile 也在 neutral）会同时抬高两侧，
     * 判别力强的词靠权重胜出；只给单一最高权重槽位加分会把歧义词变成噪声。
     */
    function classifyText(text, index) {
      const t = String(text || '')
      if (!t) return { slot: 'neutral', score: 0, conf: 0, words: [] }
      const score = Object.create(null)
      const words = Object.create(null)
      for (let i = 0; i < index.length; i++) {
        const w = index[i][0]
        if (t.indexOf(w) === -1) continue
        // index 已按长词优先排序；同一 (词,槽位) 只可能有一条，无需去重
        const slot = index[i][1]
        score[slot] = (score[slot] || 0) + index[i][2]
        if (!words[slot]) words[slot] = []
        words[slot].push(w)
      }
      let winner = 'neutral'
      let top = 0
      for (let i = 0; i < PRIORITY.length; i++) {
        const v = score[PRIORITY[i]] || 0
        if (v > top) { top = v; winner = PRIORITY[i] }
      }
      if (top === 0) return { slot: 'neutral', score: 0, conf: 0, words: [] }
      return { slot: winner, score: top, conf: clamp(top / (top + 8), 0, 1), words: words[winner] || [] }
    }

    /**
     * 迟滞：强情绪立即、回落需连续 2 句、置信度 <0.5 保持现状、同槽位 ≥3 句轮换、180ms 节流。
     *
     * @param {string} text 当前句
     * @param {number} now  毫秒时间戳（外部传，便于测试）
     * @param {Array}  [index] 词表索引。**不传就用"当前角色"的**（`activeLexicon()`）。
     *   显式可传是为了让实验台/离线探针能抽出这段逻辑单独跑 —— 它们没有 `activeLexicon`。
     */
    function stepEmotion(text, now, index) {
      if (now - emo.lastSwitch < 180) return null
      const r = classifyText(text, index || activeLexicon())
      if (r.conf < 0.5) { emo.weakStreak++; return null }
      const incoming = r.slot
      if (incoming === emo.slot) {
        emo.since++
        if (emo.since >= 3) { emo.roll++; return { slot: incoming, roll: emo.roll } }
        return null
      }
      if (incoming !== 'neutral') {
        emo.slot = incoming; emo.since = 0; emo.weakStreak = 0; emo.lastSwitch = now
        return { slot: incoming, roll: emo.roll }
      }
      emo.weakStreak++
      if (emo.weakStreak >= 2) {
        emo.slot = 'neutral'; emo.since = 0; emo.weakStreak = 0; emo.lastSwitch = now
        return { slot: 'neutral', roll: emo.roll }
      }
      return null
    }

    /** 分句：换行 + 句末标点；>40 字按逗号二次切分；<4 字并入上句。 */
    function splitSentences(text) {
      const out = []
      const paras = String(text || '').split(/\n+/)
      for (let p = 0; p < paras.length; p++) {
        const raw = paras[p].split(/(?<=[。！？…—～!?」』])/)
        for (let q = 0; q < raw.length; q++) {
          let s = raw[q].trim()
          if (!s) continue
          if (s.length > 40) {
            let buf = ''
            const segs = s.split(/(?<=[，,、；;：])/)
            for (let i = 0; i < segs.length; i++) {
              if (buf && (buf + segs[i]).length > 40) { out.push(buf); buf = segs[i] } else buf += segs[i]
            }
            s = buf
          }
          if (s) out.push(s)
        }
      }
      const merged = []
      for (let i = 0; i < out.length; i++) {
        if (out[i].length < 4 && merged.length) merged[merged.length - 1] += out[i]
        else merged.push(out[i])
      }
      // 空文本也要返回一个元素：调用方（打字机）依赖「至少有一句」的不变量
      return merged.length ? merged : ['']
    }

    /**
     * ★ 立绘站哪一侧 —— **由 manifest 按景决定**（`expressions[景].spriteSide`）。
     * 唯一事实来源在装配侧（`skin/tools/assemble-assets.mjs` 的 SPRITE_SIDE_LEFT）；
     * 这里只归一化取值，缺字段/脏值一律当 'right'（= 历史行为，旧 manifest 不会变样）。
     * 为什么金鹿（A5/A6）是 'left'：她**面朝右**，站右侧视线冲向屏幕外，
     * 站左侧才横穿画面落到中央对话框上（同一段理由也写在 §1 CSS 与装配脚本里）。
     */
    function spriteSideOf(sceneId) {
      const box = spriteBox.t[sceneId]
      return box && box.side === 'left' ? 'left' : 'right'
    }

    /** 把 manifest.expressions 预展开成绝对 URL（并带上该景的立绘站位）。 */
    function buildSpriteTable(m) {
      const table = {}
      const exp = m.expressions || {}
      for (const sid of Object.keys(exp)) {
        const slots = {}
        const raw = exp[sid].slots || {}
        for (const slot of Object.keys(raw)) slots[slot] = raw[slot].map(assetURL)
        // side：manifest 里只认 'left'，其余（含缺字段）归 'right' —— 与 spriteSideOf 同一口径
        table[sid] = {
          slots: slots, fallback: exp[sid].fallback || DEFAULT_FALLBACK,
          side: exp[sid].spriteSide === 'left' ? 'left' : 'right',
        }
      }
      return table
    }

    /** 按槽位（含回退链）挑一张立绘；roll 用于同槽位轮换防呆板。 */
    function pickSprite(sceneId, slot, roll) {
      const sc = spriteBox.t[sceneId]
      if (sc) {
        const chain = [slot]
          .concat((sc.fallback && sc.fallback[slot]) || DEFAULT_FALLBACK[slot] || [])
          .concat(['neutral'])
        for (let i = 0; i < chain.length; i++) {
          const files = sc.slots[chain[i]]
          if (files && files.length) return files[roll % files.length]
        }
      }
      // 该景整体没有 → 退回任意景的 neutral（永不空手，避免立绘闪掉）
      for (const sid of Object.keys(spriteBox.t)) {
        const alt = spriteBox.t[sid]
        if (alt.slots.neutral && alt.slots.neutral.length) return alt.slots.neutral[0]
      }
      return ''
    }

    // ==================================================================
    // §5 音频：BGM 与 UI 音效
    // ==================================================================

    const audio = {
      el: null, current: '', playlist: [], index: 0, unlocked: false, cache: {},
      /* ★ 2026-09-23 断点续播新增两个字段：
         · `kind`        —— 当前歌单标识（'dailyLight' 等），"播到第几首"按它记
         · `pendingSeek` —— 换 src 后**待恢复**的秒数。不能在赋值 src 之后立刻
                            写 currentTime（元数据未就绪会被静默忽略），
                            所以挂在这里，等 `loadedmetadata` 到了再落。 */
      kind: '', pendingSeek: 0,
    }

    /* ==================================================================
       BGM 断点续播（★★★ 2026-09-23 用户需求）
       ------------------------------------------------------------------
       用户原话：「初始界面有自己单独的 bgm，所以进到初始界面之后会换背景音，
       但只要背景音中间有间断（比如切换角色，或者进入一次初始界面），
       bgm 就会又变成从一开头开始播放。能不能加个记忆功能，即使播放中间间断，
       也能从间断的那个点开始播放」

       根因有**三处**，缺一不可，所以三处都要治：
         ① `playIndex` 里 `el.src = url` —— **换 src 必然从 0 开始**，
            这是浏览器行为，绕不过去，只能"换完再 seek 回去"。
         ② `setBgm` 里 `audio.index = 0` —— 重进列表永远从第一首起。
         ③ L1 表紙的歌单（`titleLight/titleDark`，**单曲**）与阅读态的
            `dailyLight/dailyDark`（5~8 首）**不同源**。`playlist.join('|')`
            一比就不等 → 每次都当成"换了歌单"→ 重设 + 重播。
            所以「进一次表紙再退回来」= 歌单被换掉两次，**哪怕没切角色也会重来**。

       做法：
         · `bgmMemo.pos[url]`  —— 每首曲子的播放位置（按 URL 记，URL 里带
           `?v=BUILD_ID`，所以它是稳定且唯一的 key；**不要用 `el.src`**，
           浏览器会把它绝对化，同一首歌在两次会话里拿到的串不一致）
         · `bgmMemo.list[key]` —— 每个歌单上次播到第几首，保证列表内续播
         · 进表紙时**记住阅读态的歌单与位置**，退回阅读态时原样恢复
         · 位置写进 `sessionStorage`，刷新页面也还在（用户要的"记忆"）

       ⚠ 三条边界：
         · seek 必须在 `loadedmetadata` 之后 —— 元数据没到就写 `currentTime`
           会被浏览器直接忽略（不报错，静默失效）。
         · 接近结尾（<1.5s 或 >98%）时**不恢复**，回 0 —— 否则一进来就触发
           `ended` 立刻跳下一首，听感像"跳过了一首"。
         · `sessionStorage` 在隐私模式下会抛异常 → 全部包 try/catch，
           读失败就当没有记忆（与 kill switch 那里同一套写法）。
       ================================================================== */
    const BGM_POS_KEY = 'moye-skin:bgm-pos'

    /**
     * 读回持久化的播放位置表。任何异常都返回空表（隐私模式、配额满、脏数据）。
     * @returns {{pos: Object, list: Object}}
     */
    function bgmMemoLoad() {
      try {
        const raw = sessionStorage.getItem(BGM_POS_KEY)
        if (!raw) return { pos: {}, list: {} }
        const j = JSON.parse(raw)
        return {
          pos: (j && typeof j.pos === 'object' && j.pos) || {},
          list: (j && typeof j.list === 'object' && j.list) || {},
        }
      } catch (_e) { return { pos: {}, list: {} } }
    }

    const bgmMemo = bgmMemoLoad()

    /** 把当前记忆写回 sessionStorage（静默失败）。 */
    function bgmMemoSave() {
      try { sessionStorage.setItem(BGM_POS_KEY, JSON.stringify(bgmMemo)) } catch (_e) { /* 静默 */ }
    }

    /**
     * 判断记住的位置该不该恢复。**纯函数**，便于离线断言。
     *
     * 返回应 seek 到的秒数；`0` 表示"从头播"。
     * @param {number} saved 记住的位置（秒）
     * @param {number} dur 曲长（秒，未知时传 NaN / 0）
     * @returns {number} 目标秒数
     */
    function bgmResumeAt(saved, dur) {
      if (!(saved > 1)) return 0                       // 太靠前（或非法）不值得 seek
      if (!(dur > 0)) return 0                         // 时长未知 → 不敢 seek，从头
      if (saved > dur - 1.5) return 0                  // 离结尾太近 → 否则立刻 ended
      if (saved > dur * 0.98) return 0
      return saved
    }

    /**
     * 记住当前播放位置。`timeupdate` 每秒都在响，所以**只在跨过整秒时写**，
     * 避免把 sessionStorage 写爆（那里是同步 IO）。
     * @param {boolean} force 强制写（暂停 / 切曲 / 卸载时用）
     */
    function bgmRemember(force) {
      const el = audio.el
      if (!el || !audio.current) return
      if (!el.duration || !isFinite(el.duration)) return
      const t = el.currentTime
      if (!(t > 0)) return
      const last = bgmMemo.pos[audio.current] || 0
      if (!force && Math.floor(t) === Math.floor(last)) return
      bgmMemo.pos[audio.current] = t
      bgmMemoSave()
    }

    /**
     * 原作 UI 音效 —— 来自 `data00300.hfa`（该归档**只有 7 个条目，全是界面提示音**）。
     *
     * `.hw` = 64 字节头 + 完整 OGG Vorbis，**未再压缩** → 切掉头就是合法 `.ogg`，
     * 不需要任何解码器。导出工具：`persona_work/tools/export_ui_sfx.py --write`
     * （2026-09-21 实跑，7/7 成功，落在 `skin/assets/se/`）。
     *
     * ⚠ 别照 README §7 去 `data03100.hfa`（906 个 / 94 MB，那是音效+环境音，
     *   会把环境音一起拖进来）；`docs/22` §3.6 指的那条才是对的。
     *
     * 原名 → 用途（实测自 `data00300` 条目表）：
     *   SSETurnedPage   翻页  ← 唤出/收回菜单
     *   SSEDecided      确认  ← Enter / 右键确认
     *   SSEChoiced      焦点移动
     *   SSEBookDecided  書庫内确认
     *   SSEBookChoiced  書庫内移动焦点
     *   SSECancelled    取消  ← Esc
     *   SSEUnable       禁用操作
     */
    const SFX = {
      menu: 'se/SSETurnedPage.ogg',
      decide: 'se/SSEDecided.ogg',
      move: 'se/SSEChoiced.ogg',
      book: 'se/SSEBookDecided.ogg',
      bookMove: 'se/SSEBookChoiced.ogg',
      cancel: 'se/SSECancelled.ogg',
      unable: 'se/SSEUnable.ogg',
    }

    function unlockAudio() {
      if (audio.unlocked) return
      audio.unlocked = true
      if (audio.el && audio.el.paused && audio.el.src) audio.el.play().catch(function () {})
    }

    function bgmList(m, dark, isTitle) {
      const bgm = (m && m.bgm) || {}
      if (isTitle) {
        const t = dark ? bgm.titleDark : bgm.titleLight
        return t ? [assetURL(t)] : []
      }
      const list = (dark ? bgm.dailyDark : bgm.dailyLight) || []
      return list.map(function (x) { return assetURL(typeof x === 'string' ? x : x.url) }).filter(Boolean)
    }

    /** 歌单的稳定标识（用于「上次播到第几首」的记忆）。 */
    function bgmKind(dark, isTitle) {
      if (isTitle) return dark ? 'titleDark' : 'titleLight'
      return dark ? 'dailyDark' : 'dailyLight'
    }

    /**
     * 播歌单里的第 i 首。**换 src 之后会把记住的位置 seek 回去**（断点续播）。
     * @param {number} i 歌单下标（自动取模）
     * @param {string} [kind] 歌单标识，用于记住"播到第几首"
     */
    function playIndex(i, kind) {
      if (!audio.el || !audio.playlist.length) return
      const url = audio.playlist[i % audio.playlist.length]
      if (!url) return
      if (kind) { bgmMemo.list[kind] = i % audio.playlist.length; bgmMemoSave() }
      /* 同曲且正在播 → 不动（此时 currentTime 天然保留，不需要 seek）。 */
      if (audio.current === url && !audio.el.paused) return
      /* ★ 换曲之前先把**当前这首**的位置存下来 —— 换完 src 就读不到了。 */
      bgmRemember(true)
      audio.current = url
      /* ★ 断点续播的关键：换 src 必然把播放位置归零（浏览器行为，绕不过），
         所以把要恢复的位置**挂在元素上**，等 `loadedmetadata` 到了再写。
         ⚠ 不能在这里直接写 `el.currentTime` —— 新 src 的元数据还没加载完，
           那时赋值会被浏览器**静默忽略**（不报错，但位置还是 0）。 */
      const dur = audio.el.duration
      audio.pendingSeek = bgmResumeAt(bgmMemo.pos[url] || 0, dur)
      audio.el.src = url
      audio.el.play().catch(function () {})
    }

    /**
     * 切歌单。**恢复该歌单上次播到第几首**（用户要的"记忆"）。
     * @param {object} m manifest
     * @param {boolean} dark 昼夜
     * @param {boolean} isTitle 是否在 L1 表紙
     */
    function setBgm(m, dark, isTitle) {
      const list = bgmList(m, dark, isTitle)
      if (!list.length) return
      /* ⚠ 这条提前返回**不能删** —— 它就是"没换歌单就别动"的保证。
         曾经的问题是：表紙与阅读态的歌单不同源，来回一次就被判定成"换了"，
         于是每次都从头播（用户报的 bug）。现在配合 memo 恢复位置，
         即便歌单真的换了，回来也能接上。 */
      const kind = bgmKind(dark, isTitle)
      if (audio.playlist.join('|') === list.join('|')) {
        audio.kind = kind
        return
      }
      audio.playlist = list
      audio.kind = kind
      const want = bgmMemo.list[kind]
      const idx = (typeof want === 'number' && want >= 0 && want < list.length) ? want : 0
      audio.index = idx
      playIndex(idx, kind)
    }

    function playSfx(name) {
      const s = settingsBox.s
      if (!s || !s.sfx || !audio.unlocked) return
      const rel = SFX[name]
      if (!rel) return
      try {
        let el = audio.cache[name]
        if (!el) { el = new Audio(assetURL(rel)); el.preload = 'auto'; audio.cache[name] = el }
        el.volume = clamp(s.sfxVolume == null ? 0.5 : s.sfxVolume, 0, 1)
        el.currentTime = 0
        el.play().catch(function () {})
      } catch (_e) { /* 静默 */ }
    }

    // ==================================================================
    // §6 SessionSensor —— session 作用域，唯一拿得到 chat 的位置
    // ==================================================================

    function SessionSensor(props) {
      const useChat = props.useChat
      const useSession = props.useSession
      const useProjection = props.useProjection
      const useSessions = props.useSessions
      const useWorkspaces = props.useWorkspaces
      const sessionId = props.sessionId

      // ★★★ 这五个必须**无条件**调用。
      //   写成 `useChat ? useChat(...) : undefined` 是 hooks 规则违例：
      //   槽位每次传下来的 props 只要有一次缺了 useChat，
      //   这次渲染就少算一个 hook → React 立刻抛 error #310
      //   （Rendered more/fewer hooks than during the previous render）。
      //   宿主没给就退化成"取不到值"，绝不能退化成"少调一个 hook"。
      const noSub = function () { return undefined }
      const chat = (useChat || noSub)(function (s) { return s })
      const session = (useSession || noSub)(function (s) { return s })
      const pressure = (useProjection || noSub)('contextPressure')
      const list = (useSessions || noSub)(function (s) { return s })
      const workspaces = (useWorkspaces || noSub)(function (s) { return s })

      // ★ 只读诊断：留一份快照引用（见 debugChat 注释）。不参与任何判定。
      debugChat.snapshot = chat || null

      const text = useMemo(function () { return extractAssistantText(chat) }, [chat])
      // ★ 完整会话流：不再只取"最后一句台词"，而是把整条会话读出来自己画
      const messages = useMemo(function () { return readMessages(chat) }, [chat])
      const running = !!(session && session.running)

      useEffect(function () {
        live.sessionId = sessionId || null
        /* ⚠ 必须**先**把 list.current 落进 live.sessionId ——
           下面推工作区时要拿它做"当前会话属于哪个工作区"的判据。 */
        if (list && list.current) live.sessionId = list.current
        live.running = running
        live.text = text
        live.messages = messages
        /* ★★★ 2026-09-22（用户：**会话列表列出了所有聊天，不只本工作区**）：
           病根是**顺序**。原来这段是 rows 在前、workspaces 在后，而 rows 里要调
           `widOfSession(id)` —— 它读 `live.workspaces`，那一刻还是**上一次的值（首轮是空）**
           ⇒ 每个会话的 `wid` 都是 `null` ⇒ `sessionsOfWorkspace()` 的
           `!x.wid || x.wid === wsid` **全量放行** ⇒ 198 条全列出来。
           （对照 DSH 自己的定义：`WorkspaceView { workspaceId; path; title; sessionIds }`，
             形状与这里假设的一致，所以不是字段名的问题，纯粹是赋值晚了一步。）

           现在：**先把工作区表算好，再构建会话行**，一次跑对，不依赖第二轮重跑。 */
        if (workspaces) {
          const items = workspaces.items || []
          /* ★ 工作区表**先**建好再推定 —— 下面第二级兜底要调 `widOfSession()`，
             而它正是从 `live.workspaces` 取 path 的。
             （2026-09-22 那次"列出全机会话"的根因就是赋值晚了半步，别再犯。） */
          live.workspaces = items.map(function (w) {
            return {
              id: w.workspaceId,
              title: w.title || String(w.path || '').split(/[\/]/).pop() || w.workspaceId,
              path: w.path || '',
              sessionIds: w.sessionIds || [],
            }
          })
          /* ★★★ 2026-09-23 修（用户：「打开一个项目，选取一个曾经的会话之后，
             会话列表就会变成最新项目空间中有的会话，而不是当前项目空间的会话」）：
             原来这里写的是 `if (!wid && items.length) wid = items[0].workspaceId`
             —— **找不到就退回第一个**，而 `items[0]` 是**最新**那个工作区。
             于是"打开一个旧会话"（它不在任何 `sessionIds` 里、只被记过 cwd）
             会把当前工作区整片换成最新那个 ⇒ L2 列出的是**别的项目**的会话。

             现在第二级兜底走 **cwd 最长前缀**（与 `widOfSession()` 同一套判定）：
             当前会话的 `cwd` 落在哪个工作区目录下，就归哪个。
             `items[0]` 降级为**最后一级** —— 连 cwd 都拿不到时才用。
             ⚠ `widOfSession` 匹配不上会返回 `null`，所以它绝不会把 `wid` 写成空串。 */
          let wid = null
          const cur = live.sessionId
          for (let i = 0; i < items.length; i++) {
            const w = items[i]
            if (w.sessionIds && cur && w.sessionIds.indexOf(cur) >= 0) { wid = w.workspaceId; break }
          }
          if (!wid && cur) {
            const curRow = (list && list.byId && list.byId[cur]) || null
            wid = widOfSession(cur, curRow ? curRow.cwd : '')
          }
          if (!wid && items.length) wid = items[0].workspaceId
          live.workspaceId = wid
        }
        if (list) {
          const rows = []
          const ids = list.ids || []
          for (let i = 0; i < ids.length; i++) {
            const id = ids[i]
            const s = (list.byId && list.byId[id]) || {}
            rows.push({
              id: id,
              title: s.displayTitle || s.title || id,
              cwd: s.cwd || '',
              running: !!s.running,
              blank: !!s.blank,
              /* 会话所属工作区。SessionSummary 不带这个字段，只有 WorkspaceView.sessionIds 有
                 → 从这里对照出来（`live.workspaces` 已在上一步填好）。 */
              wid: widOfSession(id, s.cwd),
              updatedAt: s.updatedAt || 0,
            })
          }
          live.sessions = rows
        }
        let pct = null
        if (pressure && pressure.contextWindow) {
          const used = pressure.projectedTokens != null ? pressure.projectedTokens : pressure.pressureTokens
          if (used != null) pct = clamp(used / pressure.contextWindow, 0, 1)
        }
        store.set({
          sessionId: live.sessionId,
          sessions: live.sessions,
          workspaces: live.workspaces,
          workspaceId: live.workspaceId,
          pressure: pct,
          agent: running ? 'generating' : (session && session.awaitingFirstTurn ? 'waiting' : 'idle'),
          messages: messages,
          /* ★★ 2026-09-20：**台词终于接上了**。
             这一行缺席了很久（全仓库 31 处 `store.set` 里没有一处写过 `line`），
             于是 store.line 恒为 '' → 底部对话框永远空着，
             打字机 effect 被 `if (!sentence) return` 挡住 →
             `stepEmotion()` 一次都不被调用 → **立绘永远停在 neutral**。
             两个功能一起哑掉，就是缺这一个字段。 */
          line: text,
        })
      }, [sessionId, running, text, messages, list, workspaces, pressure])

      /* ★ 2026-09-20：不再 `return null`，改渲染一个**零尺寸的标记节点**。
         为什么要这个：传感器是写在 store 里的"I/O 口"，但"它到底有没有被渲染"
         以前完全看不出来 —— `return null` 在 DOM 里不留任何痕迹，
         于是"槽位没注册"和"注册了但没数据"两种情况长得一模一样。
         加一个 1px、不可见、不接点击的标记，诊断就能直接回答这个问题。
         ⚠ 不能影响布局：`position:absolute` + 尺寸 0 + `pointer-events:none`。 */
      /* ★★★ 2026-09-20：**把"槽位到底给了什么"直接写在 DOM 上**。
         实测 `liveMessages:0 / liveText:""` 而会话 id 有值 ——
         传感器在跑，但 `useChat` 给回来的快照是空的。
         这只可能是两种情况之一：
           ① 槽位压根没注入 `useChat`（props 里是 undefined，走了 noSub 兜底）
           ② 注入了，但那个 binding 对应的 chat source 是空的
         DOM 属性是最好读的凭据（不用进控制台、不用改上报结构），
         刷新后读一眼就知道是哪种。 */
      return h('span', {
        'data-myh-sensor': '1',
        'data-sensor-props': [
          'chat=' + (useChat ? 'yes' : 'NO'),
          'session=' + (useSession ? 'yes' : 'NO'),
          'projection=' + (useProjection ? 'yes' : 'NO'),
          'sessions=' + (useSessions ? 'yes' : 'NO'),
          'workspaces=' + (useWorkspaces ? 'yes' : 'NO'),
          /* ★★★ 2026-09-22（用户：会话列表列出了**所有**聊天）——**形状诊断**。
             只打印"函数在不在"是不够的：`workspaces=yes` 而快照为 undefined 时，
             `live.workspaces` 永远是 `[]` ⇒ 每个会话的 `wid` 都是 `null` ⇒
             `sessionsOfWorkspace()` 的 `!x.wid || x.wid === wsid` **全量放行**。
             这里把四件事一次打出来：
               wsType   投影本身的类型（undef / null / arr / object）
               wsItems  `workspaces.items` 是不是数组、有几个（DSH 官方用这个字段）
               wsid     当前工作区 id 的前 8 位（null = 没认出来）
               widNull  会话里"没有归属"的条数 / 总条数 */
          'wsType=' + (workspaces === undefined ? 'undef' : (workspaces === null ? 'null' : (Array.isArray(workspaces) ? 'arr' : typeof workspaces))),
          'wsItems=' + (workspaces && workspaces.items && Array.isArray(workspaces.items) ? String(workspaces.items.length) : 'none'),
          'wsid=' + (live.workspaceId ? String(live.workspaceId).slice(0, 8) : 'null'),
          'widNull=' + String((live.sessions || []).filter(function (r) { return !r.wid }).length) + '/' + String((live.sessions || []).length),
          /* ★ 2026-09-22：**cwd 样本** —— 决定"能不能按 cwd 归属会话"。
             若 `cwd` 是空的，就只能退回"只认 sessionIds"；
             若有值，就能按 `cwd ≈ workspace.path` 把 189 条无归属的补回来。
             只打前 3 条不同的 cwd（去重、截断，避免把长路径塞满诊断）。 */
          'cwds=' + (function () {
            const set = []
            const rows = live.sessions || []
            for (let i = 0; i < rows.length && set.length < 3; i++) {
              const c = String(rows[i].cwd || '')
              if (!c) continue
              if (set.indexOf(c) < 0) set.push(c)
            }
            if (!set.length) return 'none'
            return set.map(function (c) { return String(c).slice(-24) }).join('|')
          })(),
          /* ★ 2026-09-22：**按工作区的条数分布** —— 一次坐实归属切分是否正确。
             期望（按会话目录计数）：DeepSeek 109 / APP1 2 / moye 97 = 208。
             只打每个工作区 id 的前 6 位与条数，避免诊断过长。 */
          'widCounts=' + (function () {
            const m = Object.create(null)
            const rows = live.sessions || []
            for (let i = 0; i < rows.length; i++) {
              const k = rows[i].wid ? String(rows[i].wid).slice(0, 6) : 'none'
              m[k] = (m[k] || 0) + 1
            }
            const ks = Object.keys(m)
            if (!ks.length) return 'none'
            return ks.map(function (k) { return k + ':' + m[k] }).join('|')
          })(),
        ].join(','),
        'data-sensor-counts': 'msgs=' + messages.length + ',line=' + text.length +
          ',sid=' + (sessionId ? 'y' : 'n'),
        'aria-hidden': 'true',
        style: {
          position: 'absolute', width: 0, height: 0, overflow: 'hidden',
          opacity: 0, pointerEvents: 'none',
        },
      })
    }

    // ==================================================================
    // §6.5 会话流读取器 —— "全新 UI"的数据源
    // ==================================================================
    //
    // 用户定调：这不是皮肤，是给 DSH 的一套**全新 UI**。也就是说界面要自己画，
    // 而自己画的前提是**自己拿得到数据**。这里把 ChatSnapshot 归一化成
    // 一个纯数据数组，皮肤根只认这个形状，不碰 DSH 的内部结构。
    //
    // 已核对的节点形状（dsh-client-ui-conversation/lib/types/client/contract/records.d.ts）：
    //   UserMessageNode      { kind:'user',      seq, time, content: ContentBlock[] }
    //   AssistantMessageNode { kind:'assistant', seq, time, turn, step,
    //                          blocks: ({kind:'text'|'reasoning'|'tool-call'|'image'|'other'})[],
    //                          interrupted?, provenance?, timing? }
    //   还有 tool / steering / command / compaction-summary / turn-error 等变体。
    // 本函数**宽容**处理：认不出 kind 的节点按聊天文本尽量提取，实在不行就丢掉。

    /** ContentBlock[] → 纯文本。 */
    function blocksToText(blocks) {
      if (!blocks) return ''
      if (typeof blocks === 'string') return blocks
      if (!Array.isArray(blocks)) return ''
      const out = []
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]
        if (!b) continue
        if (typeof b === 'string') { out.push(b); continue }
        if (b.kind === 'text' && typeof b.text === 'string') { out.push(b.text); continue }
        if (b.type === 'text' && typeof b.text === 'string') { out.push(b.text); continue }
        if (typeof b.text === 'string' && !b.kind) { out.push(b.text); continue }
      }
      return out.join('\n').trim()
    }

    /**
     * ★★ 2026-09-20：DSH 真实 Chat 节点 → 文本 / 推理 / 工具。
     *
     * 为什么需要这个（**正文一条都显示不出来的根因**）：
     * 实机 `useChat` 返回的快照里，助手正文**不在** `kind:'assistant'` 节点上 ——
     * DSH 的会话节点是 `kind:'assistant-step'`，正文在 `node.data.blocks`
     * （`dsh-client-ui-chat/lib/client.js` 的 `chatNode(context,'assistant-step',…,data)`；
     * 流式中的那一段则走 `legacy.partial.blocks`，同一个 blocks 形状）。
     * 而旧版 `normalizeNode` 只认 `kind:'assistant'` + `n.blocks`，
     * 于是每个 assistant-step 都落到兜底分支 → `blocksToText(n.content)` 拿到 undefined
     * → 返回 `''` → `normalizeNode` 返回 null → **整条会话一条正文都没有**。
     *
     * 同样是"认不出就丢"的还有工具调用：DSH 是 `kind:'tool-call'` + `node.data.root`
     * （`root.name` / `root.argsRaw`；已完成时 `root.kind==='tool-result'`）。
     *
     * 所以这里补一个**块分类器**，assistant-step / partial / assistant 三条路共用。
     */
    function classifyBlocks(blocks) {
      const texts = []
      const reasoning = []
      const tools = []
      const arr = Array.isArray(blocks) ? blocks : []
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i]
        if (!b) continue
        if (typeof b === 'string') { texts.push(b); continue }
        const k = b.kind || b.type
        if (k === 'text' && typeof b.text === 'string') { texts.push(b.text); continue }
        if (k === 'reasoning' && typeof b.text === 'string') { reasoning.push(b.text); continue }
        if (k === 'tool-call') {
          /* DSH 会给同一个工具调用**两个节点**：`assistant-step` 的 blocks 里一份，
             以及独立的 `tool-call` 节点（`data.root`）。两者 id 不同（anchorSeq vs seq），
             按 id 去重拦不住 → 界面上会出现两行一模一样的工具条。
             所以在这个**步内**按 callId/名字去重。 */
          const nm = b.name || 'tool'
          const cid = b.callId != null ? String(b.callId) : ''
          let dup = false
          for (let j = 0; j < tools.length; j++) {
            if (cid && tools[j].cid === cid) { dup = true; break }
            if (!cid && tools[j].name === nm) { dup = true; break }
          }
          if (!dup) tools.push({ name: nm, cid: cid, args: String(b.argsRaw || b.arguments || '').slice(0, 400) })
          continue
        }
        if (k === 'image') continue // 图像块不参与纯文本流
        if (typeof b.text === 'string' && b.text) texts.push(b.text)
      }
      return {
        text: texts.join('\n').trim(),
        reasoning: reasoning.join('\n').trim(),
        tools: tools,
      }
    }

    /** `tool-call` 节点（`data.root`）→ 工具条。 */
    function toolFromRoot(root) {
      if (!root || typeof root !== 'object') return null
      const settled = root.kind === 'tool-result'
      const name = (settled && root.call && root.call.name) || root.name || 'tool'
      return { name: name, running: !settled, args: String(root.argsRaw || '').slice(0, 400) }
    }

    /**
     * 用户消息 → 文本。DSH 的 `user` 节点里 `content` 是 ContentBlock[]
     * （`{type:'text',text}` —— 注意是 `type` 不是 `kind`），
     * 但也见过 `{kind:'text'}` 与纯字符串两种形态，所以三路都试。
     */
    function userTextOf(n) {
      const c = n && (n.content || (n.data && n.data.content))
      if (typeof c === 'string') return c.trim()
      if (!Array.isArray(c)) return ''
      const out = []
      for (let i = 0; i < c.length; i++) {
        const b = c[i]
        if (!b) continue
        if (typeof b === 'string') { out.push(b); continue }
        const k = b.kind || b.type
        if ((k === 'text' || k === undefined) && typeof b.text === 'string') out.push(b.text)
      }
      return out.join('\n').trim()
    }

    /** 一个节点 → 归一化消息（{id, role, text, reasoning, tools, time, streaming, stopped}）。 */
    function normalizeNode(n, index) {
      if (!n || typeof n !== 'object') return null
      const kind = n.kind || n.role
      const id = 'm' + (n.seq != null ? n.seq : index)

      if (kind === 'user' || kind === 'steering') {
        const text = userTextOf(n) || blocksToText(n.content) || (typeof n.text === 'string' ? n.text : '')
        if (!text) return null
        return { id: id, role: 'user', text: text, time: n.time || 0, steering: kind === 'steering' }
      }

      /* ★ 2026-09-20：**DSH 现实里的主路径**。正文不在 `kind:'assistant'`，
         而在 `kind:'assistant-step'` 的 `data.blocks`（见 classifyBlocks 的说明）。
         流式中的那一段由 `legacy.partial` 单独补进来，形状同 blocks。 */
      if (kind === 'assistant-step') {
        const data = n.data || n
        const c = classifyBlocks(data.blocks)
        if (!c.text && !c.reasoning && !c.tools.length) return null
        return {
          id: id, role: 'assistant', text: c.text,
          reasoning: c.reasoning, tools: c.tools,
          time: n.time || data.time || 0,
          interrupted: data.interrupted === true,
          streaming: data.status === 'running' || data.finalNode === undefined,
          model: (data.provenance && data.provenance.model) || '',
        }
      }

      /* DSH 的工具节点：`kind:'tool-call'` + `data.root` */
      if (kind === 'tool-call') {
        const t = toolFromRoot(n.data && n.data.root)
        if (!t) return null
        return { id: id, role: 'tool', text: '', name: t.name, time: n.time || 0, running: t.running, ok: true }
      }

      if (kind === 'assistant') {
        const c = classifyBlocks(n.blocks)
        if (!c.text && !c.reasoning && !c.tools.length) return null
        return {
          id: id, role: 'assistant', text: c.text,
          reasoning: c.reasoning,
          tools: c.tools,
          time: n.time || 0,
          interrupted: !!n.interrupted,
          model: (n.provenance && n.provenance.model) || '',
        }
      }

      if (kind === 'tool' || kind === 'tool-result') {
        const text = blocksToText(n.content) || (typeof n.text === 'string' ? n.text : '')
        return { id: id, role: 'tool', text: text.slice(0, 4000), name: n.name || '', time: n.time || 0, ok: n.ok !== false }
      }

      if (kind === 'command') {
        return { id: id, role: 'command', text: String(n.text || n.command || ''), time: n.time || 0 }
      }
      /* ★★★ 2026-09-23 修：**只有真压缩才报「（上下文已压缩）」**。
         原来 `compaction-summary` 与 `context` 共用这一个兜底文案 —— 而 DSH 的
         `context` 是**每轮都可能出现的「上下文快照」节点**，不是压缩事件，
         它多数时候没有 `text`，于是**每轮凭空多出一行「（上下文已压缩）」**。
         实测症状（用户 2026-09-23）：「这老是出现"上下文已压缩"的问题」。
         现在：`compaction-summary` 才是真压缩，保留兜底文案；
         `context` **没有正文就整条丢掉**（不上屏），有正文才按 notice 显示。 */
      if (kind === 'compaction-summary') {
        return { id: id, role: 'notice', text: String(n.text || '（上下文已压缩）'), time: n.time || 0 }
      }
      if (kind === 'context') {
        const ctxText = String(n.text || '').trim()
        if (!ctxText) return null
        return { id: id, role: 'notice', text: ctxText, time: n.time || 0 }
      }
      if (kind === 'turn-error') {
        return { id: id, role: 'error', text: String((n.error && n.error.message) || n.message || '出错了'), time: n.time || 0 }
      }

      // 认不出的：尽力抠文本
      const fallback = blocksToText(n.content) || (typeof n.text === 'string' ? n.text : '')
      if (fallback) return { id: id, role: 'notice', text: fallback.slice(0, 2000), time: n.time || 0 }
      return null
    }

    /**
     * 把 ChatSnapshot 读成有序消息数组。
     * 多路兜底：`order` + `nodes.get()` 是主路径，`legacy.nodes` 是备路径。
     * 全失败返回空数组（界面照常画，只是没有消息）。
     */
    function readMessages(chat) {
      if (!chat) return []
      const raw = []
      try {
        const nodes = chat.nodes
        const order = Array.isArray(chat.order) ? chat.order : null
        if (order && nodes && typeof nodes.get === 'function') {
          for (let i = 0; i < order.length; i++) {
            const v = nodes.get(order[i])
            if (v) raw.push(v)
          }
        }
        /* ★★★ 2026-09-23 修：**legacy.nodes 只在主路径拿不到东西时才用**。
           2026-09-20 那版注释写的是「谁给得出内容就用谁」（兜底），实现却写成了
           **无条件并一份** —— 同一条消息于是同时来自 order/nodes 与 legacy.nodes。
           去重键是 —— 见 normalizeNode：`m + (seq != null ? seq : index)`：
           同一节点在两条路上只要一边缺 seq，就退化成**各自的数组下标** →
           两个 id 不相等 → seen[m.id] 拦不住 → **屏幕上每条都出现两遍**。
           实测（3199 / window.__myhChat()）：
             · orderLen 14 / legacyNodesLen 7 / viaOrder 7 / viaLegacy 7 → readBack **13**
             · DOM 文本后半段是前半段的**原样重复**
           改成真正的兜底：主路径拿得到就不并备路径（与 L2674 那段注释的意图一致）。
           ⚠ 不用「按内容去重」—— 用户连发两句一模一样的「嗯」是**两条真实消息**。 */
        const legacy = chat.legacy
        if (!raw.length && legacy && Array.isArray(legacy.nodes)) {
          for (let i = 0; i < legacy.nodes.length; i++) raw.push(legacy.nodes[i])
        }
        // 流式中的那一段（partial）单独补在末尾
        const partial = chat.legacy && chat.legacy.partial
        if (partial) raw.push(partial)
      } catch { /* 形状不符就用已收集到的 */ }

      const out = []
      const seen = {}
      const push = function (m) {
        if (!m) return
        // 去重：同 id 只留一条（order 与 legacy 会给出同一批节点）
        const prev = seen[m.id]
        if (prev) {
          // 择优：有正文的胜过没正文的（legacy 的投影有时只有壳）
          if (!prev.text && m.text) { out[out.indexOf(prev)] = m; seen[m.id] = m }
          return
        }
        seen[m.id] = m
        out.push(m)
      }
      // ★ 顺序就是 DSH 给的顺序（order 在前、legacy 在后），只去重**不重排** ——
      //   `time` 在多数节点上是 0，拿它排序会把顺序打乱。
      for (let i = 0; i < raw.length; i++) push(normalizeNode(raw[i], i))

      // 实时工具调用（assistant-step 的 blocks 里已带一份，这里只补没出现在上面的）
      try {
        const runningCalls = chat.legacy && chat.legacy.runningCalls
        if (Array.isArray(runningCalls)) {
          for (let i = 0; i < runningCalls.length; i++) {
            const c = runningCalls[i]
            if (!c) continue
            const nm = c.name || 'tool'
            let dup = false
            for (let k = 0; k < out.length; k++) {
              if (out[k].role === 'tool' && out[k].name === nm && out[k].running) { dup = true; break }
            }
            if (!dup) out.push({ id: 'run-' + i, role: 'tool', text: '', name: nm, time: 0, running: true })
          }
        }
      } catch { /* ignore */ }

      return out
    }

    /**
     * 从 ChatSnapshot 里取最近一条 assistant 正文（对话框的"当前台词"）。
     *
     * ★ 2026-09-20：**流式中的那一段优先**。
     *   流式正文只在 `legacy.partial.blocks` 里（DSH 的 `partial` 是
     *   "正在生成的那一步"，`assistant-step` 的 finalNode 要等结束才出现）。
     *   若只看已完成节点，用户会盯着空对话框等一整轮 —— 打字机也就没得可打。
     *   所以顺序是：**partial（正在写） → 已完成节点（回放）**。
     */
    function extractAssistantText(chat) {
      if (!chat) return ''
      try {
        // ① 正在生成的那一段
        const partial = chat.legacy && chat.legacy.partial
        if (partial && Array.isArray(partial.blocks)) {
          const t = classifyBlocks(partial.blocks).text
          if (t) return t
        }
        // ② 已完成的历史
        const legacy = chat.legacy
        if (legacy && Array.isArray(legacy.nodes)) {
          const t = lastAssistantFrom(legacy.nodes)
          if (t) return t
        }
        if (chat.nodes && typeof chat.nodes.getSnapshot === 'function') {
          const snap = chat.nodes.getSnapshot()
          if (Array.isArray(snap)) { const t = lastAssistantFrom(snap); if (t) return t }
        }
        if (Array.isArray(chat.order) && chat.nodes) {
          const arr = []
          for (let i = 0; i < chat.order.length; i++) {
            const k = chat.order[i]
            const v = chat.nodes.get ? chat.nodes.get(k) : chat.nodes[k]
            if (v) arr.push(v)
          }
          const t = lastAssistantFrom(arr)
          if (t) return t
        }
        if (Array.isArray(chat.transcript)) {
          const t = lastAssistantFrom(chat.transcript)
          if (t) return t
        }
      } catch (_e) { /* 形状不符就放弃 */ }
      return ''
    }

    function lastAssistantFrom(nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (!n) continue
        const role = n.role || (n.message && n.message.role) || n.kind
        // ★ assistant-step 是 DSH 现实里的助手节点名（正文在 data.blocks）
        if (role === 'assistant-step') {
          const data = n.data || n
          const t = classifyBlocks(data.blocks).text
          if (t) return t
          continue
        }
        if (role !== 'assistant' && role !== 'agent') continue
        // 同样先试真实字段，再退老字段
        const t = classifyBlocks(n.blocks).text || textOfNode(n)
        if (t) return t
      }
      return ''
    }

    function textOfNode(n) {
      const msg = n.message || n
      if (typeof msg.text === 'string' && msg.text) return msg.text
      if (typeof msg.content === 'string' && msg.content) return msg.content
      if (Array.isArray(msg.content)) {
        const out = []
        for (let i = 0; i < msg.content.length; i++) {
          const b = msg.content[i]
          if (!b) continue
          if (typeof b === 'string') { out.push(b); continue }
          if (b.type === 'text' && typeof b.text === 'string') out.push(b.text)
        }
        if (out.length) return out.join('\n')
      }
      if (typeof n.text === 'string' && n.text) return n.text
      return ''
    }

    // ==================================================================
    // §7 展示组件
    // ==================================================================

    /**
     * 立绘 crossfade 120ms（红线：切换不跳位 —— 尺寸由 CSS 高度决定，与图无关）。
     * side 来自 manifest 的按景字段（调用方用 spriteSideOf(景) 取），
     * 它只翻**期望站位偏移的符号**（'right'→+20vw / 'left'→-20vw）；
     * 最终位移由 CSS 按**盒子宽**clamp（推导见 §1 里 .myh-stage/.myh-sprite 那段注释），
     * 这里的 ±20vw 只进变量、不直接决定位置（上一版拿它当位移 → 1280 视口下 1640 画布出框 145px）。
     *
     * 盒子宽 B 在 CSS 里算不出来（素材宽高比只有图自己知道），所以 onLoad 量一次
     * naturalWidth/naturalHeight 写 `--myh-sprite-ar`；量到之前 CSS 用兜底比例 1.2893
     * （= 最宽画布 1640/1272，**高估** B → 只会往里收，不会出框）。
     * ★ 只量这一下：没有定时器、没有 resize 监听 —— 视口变了由 CSS 的 vh/% 自己重算。
     */
    /* ------------------------------------------------------------------
       立绘双槽状态机（★★★ 2026-09-23 重写）—— 纯函数，便于离线断言。

       为什么要有它：上一版把"哪个槽逻辑上是当前"与"哪个槽视觉上可见"混成
       一个字段（`cur`），用兜底求值驱动 opacity，并用一个**全局**的 `ar`
       记画布比例。这三件事各造成一个用户可见的 bug：

         ① `data-on` 的兜底写成 `slots.on || slots.cur` —— 新图**挂载那一刻**
            它的 `data-on` 就已经是 `true`。而"挂载时初始值就等于目标值"
            **不会触发 transition**，于是新图是**直接弹出来**的、
            旧图还在慢慢淡出；中间那段"旧的淡出 + 新的尚未解码"就是**黑闪**。
         ② 可见槽的 `src` 会被下一次切换**直接改掉**（React 按 `key=槽名`
            复用同一个 `img` 元素）→ 正在显示的那张图被换走 →
            快速切换时看到**错误的人物画像**。
         ③ `ar` 是**全局**的，还带 `if (ar > 0) return` 守卫 → 量到第一张之后
            再也不更新。换角色时两张画的画布尺寸不同，`--myh-sprite-bw`
            用的是**上一张**的比例 → 盒子宽算错 → clamp 把立绘推到错误的
            横向位置 = **偏掉**。

       新规则（三条，缺一不可）：

         · **每个槽自带 `ar`** —— 比例跟着图走，不跟组件走。
         · **只有 `ok`（已 load 完）的槽才允许被点亮** —— 新图必须**解码完成**
           才开始淡入，于是任何时刻屏幕上至少有一张**已解码**的图。
         · **可见槽的 `src` 永不改动** —— 新图一律先放进**不可见**的那个槽，
           等它 load 完再翻转 `vis`，由 `vis` 的变化驱动两侧 opacity 过渡。
       ------------------------------------------------------------------ */

    /** 初始状态：`A` 装首图（尚未 load），`B` 空。 */
    function spriteInit(url) {
      return {
        A: { src: url || '', ar: 0, ok: false },
        B: { src: '', ar: 0, ok: false },
        vis: 'A',
      }
    }

    /** 把新图放进**不可见**的槽。可见槽原样不动（这是"不闪"的关键）。 */
    function spriteSwap(s, url) {
      const other = s.vis === 'A' ? 'B' : 'A'
      const next = { A: s.A, B: s.B, vis: s.vis }
      next[other] = { src: url || '', ar: 0, ok: false }
      return next
    }

    /** 某槽 load 完成：记下**它自己的**比例并标记就绪；若它不是可见槽则翻过去。 */
    function spriteLoaded(s, name, ar) {
      const sl = s[name]
      if (!sl || !sl.src || !(ar > 0)) return s
      if (sl.ok && sl.ar === ar) return s       // 无变化 → 返回原对象，让 React 跳过重渲
      const next = { A: s.A, B: s.B, vis: s.vis }
      next[name] = { src: sl.src, ar: ar, ok: true }
      if (name !== s.vis) next.vis = name       // ★ 就绪即翻面，两侧同时过渡
      return next
    }

    /** 某槽此刻该不该显示：**既是可见槽、又已就绪**才点亮。 */
    function spriteOn(s, name) {
      return name === s.vis && !!(s[name] && s[name].ok)
    }

    function Sprite(props) {
      const url = props.url
      /* ══════════════════════════════════════════════════════════════════
         ★★★ 2026-09-23：双层交叉淡入（crossfade）的状态。

         为什么不能沿用"单层 img 换 src"：单层做不了交叉，只能
         淡出旧图 → 换 src → 淡入新图，中间**必然经过一次接近全透明的谷底** ——
         用户报告的"切界面时闪一下人物画像"就是这个谷底。

         用**两个槽** `A`/`B` 轮流当"底层"，每层自带 `on`（目标不透明度）：
           · 切图时不卸载旧层，只把 `on` 置 false → 它自己淡出
           · 新层挂上去时 `on` 先为 false，**下一帧**再置 true → 过渡真的会跑
         ⚠ "下一帧再置 true"是关键：元素**初次挂载**时如果 `data-on` 已经是 true，
           浏览器不会为初始值跑 transition（没有"前一个值"可过渡），
           于是 `onTransitionEnd` 永不触发、状态永远清不掉 —— 实测踩过这个坑。
         ══════════════════════════════════════════════════════════════════ */
      const [slots, setSlots] = useState(function () { return spriteInit(url) })
      const prev = useRef(url)
      useEffect(function () {
        if (url === prev.current) return
        prev.current = url
        /* ★ 只动**不可见**的那个槽（见 spriteSwap 的说明）。
           可见槽的 src 一个字节都不碰 —— 这是"不闪黑、不显示错图"的关键。 */
        setSlots(function (s) { return spriteSwap(s, url) })
      }, [url])
      // 'right' 走历史值；'left' 是它的镜像值（金鹿面朝右 → 站左侧，视线横穿画面到对话框）
      // ★★★ 2026-09-20（用户定案）：偏移 **20vw → 30vw**（"往自己的那一边再靠近 50%"）。
      //   ⚠ 我先前的实现把方向搞反了：`--myh-sprite-x` 是**从中线起算的位移**，
      //     **越大越靠自己的那一边**。我把它减半（20vw→10vw），效果是"从右边往中间拉"，
      //     与用户要求正好相反，已被用户指出并纠正。现在按 ×1.5 放大。
      //   用户明确补充："**金鹿的与别人相反方向同比例**" —— 所以这里提成**一个常量**，
      //     两个方向只由符号决定，不会出现两边不对称。
      //   实测（1629×1007、A4、盒子宽 744px、居中时左缘 442px）：
      //     20vw → 左缘 768、离右边缘 117px
      //     30vw → 触碰 clamp 上限 27.2vw → 左缘 885、右缘 1629（贴边）
      //   ⚠ 30vw 会被上限削成 27.2vw（`D ≤ (W-B)/2`，见 §1 那段推导）——
      //     这是**有意的**：上限就是"右缘不出画"的保证。贴边会切掉右缘极少量发丝像素，
      //     实测（A4 立绘 1225×1260）末 14 列每列仅 4~23 个不透明像素，
      //     贴边总损失 **0.005%**，肉眼不可见。
      const x = props.side === 'left' ? '-30vw' : '30vw'
      /* 每个槽**用自己的** `ar`（不再共用一个全局值）——
         换角色时两张画画布尺寸不同，用上一张的比例算盒子宽会让 clamp 推错位置。 */
      const onLayerLoad = function (name) {
        return function (e) {
          const el = e && e.currentTarget
          const w = el && el.naturalWidth
          const hh = el && el.naturalHeight
          if (w > 0 && hh > 0) {
            setSlots(function (s) { return spriteLoaded(s, name, w / hh) })
          }
        }
      }
      /* ★ 兜"图片已缓存、onLoad 早于处理函数挂上"的情形。
         浏览器可能在 React 把 `onLoad` 绑上之前就已经解码完一张命中缓存的图，
         那个事件就丢了 —— 该槽永远 `ok:false`、永远不点亮（立绘不动）。
         ref 回调在元素挂载时同步执行，此时 `complete` 已为真就能补上这次测量。 */
      const onLayerRef = function (name) {
        return function (el) {
          if (!el || !el.complete) return
          const w = el.naturalWidth
          const hh = el.naturalHeight
          if (w > 0 && hh > 0) {
            setSlots(function (s) { return spriteLoaded(s, name, w / hh) })
          }
        }
      }
      /* 空槽渲染 null 而不是空 img：`src=""` 会让浏览器去请求当前文档地址。 */
      const renderSlot = function (name) {
        const sl = slots[name]
        if (!sl || !sl.src) return null
        return h('img', {
          key: name,
          ref: onLayerRef(name),
          className: 'myh-sprite',
          src: sl.src, alt: '', draggable: false,
          style: sl.ar > 0 ? { '--myh-sprite-ar': String(sl.ar) } : null,
          /* `data-on` 驱动 `.myh-sprite{opacity}` 的过渡（见 §1 CSS）。
             ⚠ 判据是 `spriteOn()`：**既是可见槽、又已 load 完**才点亮。
               这两个条件缺一个都会出问题 ——
               · 少了 `ok`：新图挂载即点亮，而它的 `data-on` 初始值就等于目标值
                 → **不触发过渡**（直接弹出），中间那段就是用户看到的**黑闪**。
               · 少了 `vis` 判定：两个槽会同时点亮，两张立绘叠在一起。 */
          'data-on': spriteOn(slots, name) ? 'true' : 'false',
          onLoad: onLayerLoad(name),
        })
      }
      return h('div', { className: 'myh-stage', 'aria-hidden': 'true', style: { '--myh-sprite-x': x } },
        renderSlot('A'), renderSlot('B'))
    }

    /* ==================================================================
       ★★★ 2026-09-20：**删掉"底部对话框"** —— 它是 skin 自己造的，原作没有。

       起因：用户指出我不该在没读源码的情况下断言"魔夜的对话框是显示台词的地方"。
       读 `game_scripts/ctd/data00200.hfa/script_text_ja.ctd`（24,134 行）
       + 复核 `ui/txtwindow*` 素材之后，事实是：

         · 剧本里文字有**四种形态**，靠起手标点区分，**没有名字牌**：
             　…    旁述（全角空格起头）
             「…」  人声台词
             『…』  无机 / 魔法之声
             “… ”  心声
         · 原作**没有底部对话框**。文字直接铺在**整屏一条羽化暗带**上：
             `txtwindow00/01/02` 各 1921×1081（= 整个画布），
             纵向 y=0%→99.7% **恒定**（实测 alpha 恒为 153），
             横向：边缘 0 → 15% 处 135 → **20~80% 恒定 153** → 90% 处 38 → 0。
             三变体 = 三档**浓度**，不是三个位置。

       而 `docs/04` 那份"对话框规格"（`H = 86+44×(行数−1)`、端帽、名字牌）
       是把 **`sel_win`（选项条）** 的高度规律套到"对话框"上 —— 那份文档自己
       也写着「原作没有对话框」「原作没有名字牌」。它是**设计提案**
       （"不新造构件，把选项条从中部搬到下部"），与 `docs/02` 公理 A
       「忠于原作」直接冲突。按用户 2026-09-20 的决定：**以原作为准，提案作废。**

       所以这里不再渲染独立对话框。当前台词改由 `CurrentLine` 画在
       **正文暗带**上（与原作同一条载体）；打字机与表情链路原样保留。
       ================================================================== */

    // ==================================================================
    // §7.5 会话流组件 —— 这套 UI 的"正文"
    // ==================================================================
    //
    // 用户定调：「不是套一层壳，是整个 UI 要完全不同」。
    // 所以这里不是给 DSH 的消息加样式，而是**自己画**：
    //   · 用户消息 → 右侧一枚"付箋"（原作便签语言）
    //   · 助手正文 → 左侧 ADV 文本块，按句切换立绘
    //   · 思维链   → 折叠的一行小字，默认不展开
    //   · 工具调用 → 细窄的状态条（名字 + 运行中/完成）
    //   · 系统/错误 → 一行notice
    // 滚动由本组件自己管，不依赖 DSH 的滚动容器。

    /** 思维链折叠行。 */
    function ReasoningRow(props) {
      const [open, setOpen] = useState(false)
      if (!props.text) return null
      return h('div', { className: 'myh-think', 'data-open': open ? 'true' : 'false' },
        h('button', {
          type: 'button', className: 'myh-thinkHead',
          onClick: function () { setOpen(!open) },
        }, '思考过程 ' + (open ? '▾' : '▸')),
        open ? h('div', { className: 'myh-thinkBody' }, props.text) : null)
    }

    /** 工具调用条。 */
    function ToolRow(props) {
      const t = props.tool
      return h('div', { className: 'myh-tool', 'data-running': t.running ? 'true' : undefined },
        h('span', { className: 'myh-toolDot' }),
        h('span', { className: 'myh-toolName' }, t.name || 'tool'),
        t.running ? h('span', { className: 'myh-toolState' }, '进行中') : null)
    }

    /* ==================================================================
       §7.55 Markdown 渲染（★★★ 2026-09-23 新增）
       ------------------------------------------------------------------
       背景：用户报告「现在的皮肤无法适配 markdown 格式，所以会出现一大堆
       符号乱码」。此前 `MessageRow` 把助手原文**当纯文本**直接塞进
       `.myh-say`，于是 `**`、`##`、三个反引号这些标记原样显示在屏幕上。

       三条硬约束决定了这里只能是**手写解析器**：

        ① **引不了库。** 种子模块名单是冻结的 9 个，本包只用其中 3 个
           （`react` / `react/jsx-runtime` / `react-dom/client`），
           `check-client.mjs` 有一条断言守着「只 require 播种模块」。
           引 markdown-it / marked 会当场把那条断言打红，而且浏览器里
           那两个模块根本不存在 → 皮肤直接白屏。

        ② **正文是流式的。** 打字机按句推进，`shown` 是完整文本的**前缀**，
           所以解析器随时会收到半截标记：`**后两条同时为真`（粗体没闭合）、
           围栏开了没关、表头行还没有分隔行。这类输入**必须优雅降级** ——
           未闭合的标记原样输出，绝不能整段吞掉或抛错，否则打字过程中
           屏幕会一截一截地闪。

        ③ **正文是不可信输入**（模型输出、文件内容、命令回显）。
           所以一律用 React 元素渲染，**绝不碰 `innerHTML`**；
           链接还要过一道协议白名单 —— 否则 `[点我](javascript:...)`
           就是一条注入路径。

       排版原则：只补「间距与区别色」，字号/行高/描边**全部继承 `.myh-say`** ——
       屏幕上仍然是同一条暗带上的同一种正文，没有引入第二种排版语言。
       ================================================================== */

    /** 链接协议白名单：只放行这几类，其余当纯文本。 */
    const MD_URL_OK = /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i

    /** 把（可能含元素的）节点展平成纯文本。链接协议不合法时只保留文字用。 */
    function mdPlain(nodes) {
      if (nodes == null) return ''
      if (typeof nodes === 'string') return nodes
      if (typeof nodes === 'number') return String(nodes)
      if (Array.isArray(nodes)) return nodes.map(mdPlain).join('')
      if (nodes.props && nodes.props.children != null) return mdPlain(nodes.props.children)
      return ''
    }

    /**
     * 行内解析：行内代码 / 粗体 / 斜体 / 删除线 / 链接 / 转义。
     *
     * 递归下降，但每层都只在**找到闭合标记**时才构造元素；
     * 找不到就原样输出标记字符 —— 这就是流式降级的实现方式。
     *
     * @param {string} src 原文（可能只是前缀）
     * @returns {Array} React 子节点（字符串与元素混合）
     */
    function mdInline(src) {
      const s = String(src == null ? '' : src)
      const out = []
      let buf = ''
      let i = 0
      let k = 0
      const flush = function () { if (buf) { out.push(buf); buf = '' } }
      const push = function (tag, cls, children, extra) {
        flush()
        const props = { key: 'mi' + (k++), className: cls }
        if (extra) { for (const p in extra) props[p] = extra[p] }
        out.push(h(tag, props, children))
      }
      while (i < s.length) {
        const rest = s.slice(i)
        let m
        /* ---- 行内代码**优先**：反引号里的一切都不再解析 ---- */
        if (s[i] === '`') {
          m = /^(`+)([\s\S]*?)\1/.exec(rest)
          if (m) { push('code', 'myh-mdCode', m[2]); i += m[0].length; continue }
          buf += s[i]; i++; continue                 // 未闭合：原样
        }
        /* ---- 转义：\* \_ \` 等输出下一个字符本身 ---- */
        if (s[i] === '\\' && i + 1 < s.length && '\\`*_{}[]()#+-.!|~>'.indexOf(s[i + 1]) >= 0) {
          buf += s[i + 1]; i += 2; continue
        }
        /* ---- 粗体：**…** / __…__（必须先于斜体判，否则 ** 会被吃成两次 *） ---- */
        if (rest.slice(0, 2) === '**' || rest.slice(0, 2) === '__') {
          const mark = rest.slice(0, 2)
          const end = rest.indexOf(mark, 2)
          if (end > 2) { push('strong', 'myh-mdBold', mdInline(rest.slice(2, end))); i += end + 2; continue }
          buf += mark; i += 2; continue              // 未闭合：原样
        }
        /* ---- 删除线 ---- */
        if (rest.slice(0, 2) === '~~') {
          const end = rest.indexOf('~~', 2)
          if (end > 2) { push('del', 'myh-mdDel', mdInline(rest.slice(2, end))); i += end + 2; continue }
          buf += '~~'; i += 2; continue
        }
        /* ---- 链接 [文字](url) ---- */
        if (s[i] === '[') {
          m = /^\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"[^"]*")?\s*\)/.exec(rest)
          if (m) {
            if (MD_URL_OK.test(m[2])) {
              push('a', 'myh-mdLink', mdInline(m[1]),
                { href: m[2], target: '_blank', rel: 'noreferrer noopener' })
            } else {
              buf += mdPlain(mdInline(m[1]))          // 不安全协议：只留文字
            }
            i += m[0].length; continue
          }
          buf += s[i]; i++; continue
        }
        /* ---- 斜体：*…* / _…_（内容为纯空格时不当斜体，避免吃掉 “a * b”） ---- */
        if (s[i] === '*' || s[i] === '_') {
          const mark = s[i]
          const end = rest.indexOf(mark, 1)
          if (end > 1 && rest.slice(1, end).trim()) {
            push('em', 'myh-mdItalic', mdInline(rest.slice(1, end)))
            i += end + 1; continue
          }
          buf += mark; i++; continue
        }
        buf += s[i]; i++
      }
      flush()
      return out
    }

    /** 这一行是不是某个块级结构的开头（段落循环用它判断何时停）。 */
    function mdIsBlockStart(lines, i) {
      const t = lines[i]
      if (t == null) return false
      if (/^\s*(`{3,}|~{3,})/.test(t)) return true
      if (/^\s{0,3}#{1,6}\s/.test(t)) return true
      if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) return true
      if (/^\s{0,3}>/.test(t)) return true
      if (/^\s*([-*+]|\d+[.)])\s+/.test(t)) return true
      return false
    }

    /** 表格分隔行：只由 `| - : 空白` 组成，且至少一个 `-`。 */
    function mdIsTableSep(t) {
      if (t == null || t.indexOf('-') < 0 || t.indexOf('|') < 0) return false
      return /^[\s|:\-]+$/.test(t)
    }

    /**
     * 块级解析：围栏代码 / 标题 / 分隔线 / 引用 / 表格 / 列表 / 段落。
     *
     * ⚠ 围栏**未闭合也照渲染**：打字到一半时「``` 开了没关」是**正确**的中间态，
     *   那时后面所有内容本来就该显示成代码块。
     * @param {string} src 原文（可能只是前缀）
     * @returns {Array} 块级 React 元素
     */
    function mdBlocks(src) {
      const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n')
      const out = []
      let k = 0
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        let m
        /* ---- 围栏代码 ---- */
        m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
        if (m) {
          const ch = m[1][0]
          const len = m[1].length
          const lang = m[2].trim()
          const body = []
          i++
          const closeRe = new RegExp('^\\s*' + ch + '{' + len + ',}\\s*$')
          while (i < lines.length) {
            if (closeRe.test(lines[i])) { i++; break }
            body.push(lines[i]); i++
          }
          out.push(h('pre', {
            key: 'mb' + (k++), className: 'myh-mdPre',
            'data-lang': lang || undefined,
          }, h('code', null, body.join('\n'))))
          continue
        }
        /* ---- 标题 ---- */
        m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
        if (m) {
          out.push(h('div', {
            key: 'mb' + (k++), className: 'myh-mdH', 'data-lvl': String(m[1].length),
          }, mdInline(m[2])))
          i++; continue
        }
        /* ---- 分隔线 ---- */
        if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          out.push(h('hr', { key: 'mb' + (k++), className: 'myh-mdHr' }))
          i++; continue
        }
        /* ---- 引用：连续的 > 行合成一块 ---- */
        if (/^\s{0,3}>/.test(line)) {
          const q = []
          while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
            q.push(lines[i].replace(/^\s{0,3}>\s?/, '')); i++
          }
          out.push(h('div', { key: 'mb' + (k++), className: 'myh-mdQuote' }, mdInline(q.join('\n'))))
          continue
        }
        /* ---- 表格：表头行 + 分隔行 + 若干数据行 ---- */
        if (line.indexOf('|') >= 0 && mdIsTableSep(lines[i + 1])) {
          const splitCells = function (t) {
            return t.trim().replace(/^\|/, '').replace(/\|$/, '')
              .split('|').map(function (x) { return x.trim() })
          }
          const head = splitCells(line)
          i += 2
          const rows = []
          while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') >= 0) {
            rows.push(splitCells(lines[i])); i++
          }
          out.push(h('div', { key: 'mb' + (k++), className: 'myh-mdTableWrap' },
            h('table', { className: 'myh-mdTable' },
              h('thead', null, h('tr', null, head.map(function (c, ci) {
                return h('th', { key: 'th' + ci }, mdInline(c))
              }))),
              h('tbody', null, rows.map(function (r, ri) {
                return h('tr', { key: 'tr' + ri }, r.map(function (c, ci) {
                  return h('td', { key: 'td' + ci }, mdInline(c))
                }))
              })))))
          continue
        }
        /* ---- 列表：同类标记连续的行合成一个列表 ---- */
        m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
        if (m) {
          const ordered = /\d/.test(m[2])
          const items = []
          while (i < lines.length) {
            const lm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (!lm || /\d/.test(lm[2]) !== ordered) break
            items.push(lm[3]); i++
            /* 续行：有缩进但不是新条目，且不是别的块开头 → 并入上一条 */
            while (i < lines.length && lines[i].trim() &&
                   !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && !mdIsBlockStart(lines, i)) {
              items[items.length - 1] += '\n' + lines[i].trim(); i++
            }
          }
          out.push(h(ordered ? 'ol' : 'ul', { key: 'mb' + (k++), className: 'myh-mdList' },
            items.map(function (t, li) {
              return h('li', { key: 'li' + li, className: 'myh-mdLi' }, mdInline(t))
            })))
          continue
        }
        /* ---- 段落（连读多行，保留行内换行 —— pre-wrap 会把 \n 照实画出来） ---- */
        const para = []
        while (i < lines.length && lines[i].trim() && !mdIsBlockStart(lines, i) &&
               !(lines[i].indexOf('|') >= 0 && mdIsTableSep(lines[i + 1]))) {
          para.push(lines[i]); i++
        }
        if (para.length) {
          out.push(h('div', { key: 'mb' + (k++), className: 'myh-mdP' }, mdInline(para.join('\n'))))
        } else { i++ }        /* 保险：任何分支都必须推进，防止空转死循环 */
      }
      return out
    }

    /**
     * 把打字机光标塞进**最后一个文字块内部**（而不是另起一行）。
     *
     * 为什么需要：块级化之后，光标若作为 `.myh-say` 的兄弟节点，就会掉到
     * 下一个块级盒子里 —— 屏幕上是"文字、换行、然后一个孤零零的光标"。
     *
     * ⚠ 重建元素时必须**显式带上 `key`**：React 的 `key` 不在 `props` 上，
     *   只 `Object.assign({}, el.props)` 会把它丢掉 → 数组子节点报警告。
     * @param {Array} blocks mdBlocks 的结果
     * @param {*} caret 光标元素（可为 null）
     */
    function mdAttachCaret(blocks, caret) {
      if (!caret) return blocks
      if (!blocks.length) return [caret]
      const last = blocks[blocks.length - 1]
      const cls = last && last.props ? String(last.props.className || '') : ''
      /* ⚠ children 的位置**两种表示都要读**：
           · 真 React 元素 —— 挂在 `props.children`（元素上没有 `.children`）
           · 离线自检的假 React —— 挂在元素自己的 `.children` 上
         只读前者的话，自检环境里取到空数组 → 重建后**整个正文被丢掉**，
         屏幕上只剩一个光标（实测踩过，症状是端到端断言报 `"「…」▍"`）。 */
      const kidsOf = function (el) {
        if (!el) return []
        const c = el.children != null ? el.children
          : (el.props ? el.props.children : null)
        return c == null ? [] : (Array.isArray(c) ? c : [c])
      }
      /* ⚠ 重建元素时 **children 必须走第 3 个参数**，不能塞进 `props.children`。
         两个理由，第二个是实测踩出来的：
           ① 全文件的写法惯例就是 `h(tag, props, ...children)`；
           ② 离线自检（`check-client.mjs` 的端到端回归）用的假 React
              **只从第 3 个参数起收 children** —— 塞进 props 的话那些节点
              在断言里"看不见"。症状很具体：**只有半句态**（会走这里）的两条
              断言失败，而全句态正常 —— 正是"只有 stillTyping 才经过本函数"。
         `key` 则相反：它必须留在第 2 个参数里（`createElement` 正是从那里取 key）。 */
      const rebuild = function (el, nextKids) {
        const p = Object.assign({}, el.props)
        delete p.children
        if (el.key != null && p.key == null) p.key = el.key
        return h(el.type, p, nextKids)
      }
      /* 文字块：直接把光标接在句尾 */
      if (cls === 'myh-mdP' || cls === 'myh-mdH' || cls === 'myh-mdQuote') {
        return blocks.slice(0, -1).concat([rebuild(last, kidsOf(last).concat([caret]))])
      }
      /* 列表：接进最后一个 li */
      if (cls === 'myh-mdList') {
        const lis = kidsOf(last).slice()
        const lastLi = lis[lis.length - 1]
        if (lastLi && lastLi.props) {
          lis[lis.length - 1] = rebuild(lastLi, kidsOf(lastLi).concat([caret]))
          return blocks.slice(0, -1).concat([rebuild(last, lis)])
        }
      }
      /* 代码块 / 表格 / 分隔线：光标另起一行更可读 */
      return blocks.concat([caret])
    }

    /** 一条消息。 */
    function MessageRow(props) {
      const m = props.m
      if (m.role === 'user') {
        /* ★★★ 2026-09-21（用户定案）：用户消息**不再用消息框 / 付箋**，
           改成与助手正文**同一种排版**、同一条暗带上顺排，只是用「」把它框起来。

           为什么这样更像原作：魔夜的文字有四种形态，靠**起手标点**区分
           （旁述＝全角空格 / 人声＝「」/ 无机＝『』/ 心声＝“”），**没有名字牌**，
           更没有"我的气泡 / 他的气泡"这种 chat 语言。
           用户是画面里在场的一个说话人，所以他/她的话就该和旁白并排成行，
           用「」标出"这是有人在说话"即可 —— 这与 `docs/27` §4 的结论同源。

           注意：`「」` 是**渲染时加的**，不写进 store、不写进会话记录，
           所以复制正文或回传给模型的内容不受影响。 */
        return h('div', { className: 'myh-msg', 'data-role': 'user', 'data-id': m.id },
          h('div', { className: 'myh-say myh-sayUser' },
            h('span', { className: 'myh-quote' }, '「'),
            m.text,
            h('span', { className: 'myh-quote' }, '」')))
      }
      if (m.role === 'tool') {
        return h('div', { className: 'myh-msg', 'data-role': 'tool', 'data-id': m.id },
          h(ToolRow, { tool: m }))
      }
      if (m.role === 'error') {
        return h('div', { className: 'myh-msg', 'data-role': 'error', 'data-id': m.id },
          h('div', { className: 'myh-notice myh-noticeErr' }, m.text))
      }
      if (m.role === 'notice' || m.role === 'command') {
        return h('div', { className: 'myh-msg', 'data-role': 'notice', 'data-id': m.id },
          h('div', { className: 'myh-notice' }, m.text))
      }
      // assistant
      /* ★ 2026-09-21：`props.typing` 非空时只画到那个长度，并在末尾跟一个光标。
         这是打字机的**唯一落点**（底部那层 `.myh-cur` 已删）。
         `typing` 由 Transcript 只传给"最后一条助手消息"，所以历史行不受影响。 */
      const full = String(m.text || '')
      const partial = String(props.typing || '')
      const shown = partial ? partial.slice(0, full.length || partial.length) : full
      const stillTyping = !!partial && shown.length < full.length
      /* ★★★ 2026-09-23：助手正文走 Markdown 渲染（此前是纯文本 → 标记乱码）。
         ⚠ `shown` 是流式前缀，可能是半截标记，`mdBlocks` 已按"未闭合就原样输出"
           （围栏除外 —— 那里未闭合本来就该显示成代码块）。
         ⚠ 光标必须**塞进最后一个文字块内部**，否则块级化之后它会掉到下一个
           块级盒子里，屏幕上变成"文字、换行、孤零零一个光标"。
         ⚠ 用 `useMemo` 缓存：打字机每帧都会重渲这条消息，而解析是纯字符串运算，
           不缓存的话长回复会每帧重解析一遍整段文本。 */
      const body = useMemo(function () {
        return stillTyping
          ? mdAttachCaret(mdBlocks(shown), h('span', { className: 'myh-caret' }, '▍'))
          : mdBlocks(shown)
      }, [shown, stillTyping])
      return h('div', { className: 'myh-msg', 'data-role': 'assistant', 'data-id': m.id },
        m.tools && m.tools.length
          ? h('div', { className: 'myh-tools' }, m.tools.map(function (t, i) {
            return h(ToolRow, { key: 't' + i, tool: t })
          }))
          : null,
        m.reasoning ? h(ReasoningRow, { text: m.reasoning }) : null,
        shown ? h('div', { className: 'myh-say', 'data-stopped': m.interrupted ? 'true' : undefined },
          body) : null,
        m.interrupted ? h('div', { className: 'myh-stopped' }, '（已停止）') : null)
    }

    /**
     * 整条会话流。自己滚动。
     *
     * ★★★ 2026-09-21（用户定案）：**删掉了底部那层独立台词 `.myh-cur`**。
     *
     * 用户原话：「下面这个弹文字的部分删掉」。指的就是输入框上方那条
     * 大字台词带 —— 它与正文流里的内容**重复显示**同一句话，是上一版
     * "对话框"思路的残留（原作没有这个部件，见 `docs/27` §4）。
     *
     * 现在打字机与光标**移进正文流本身**：`typing` 非空时，正文流的
     * **最后一条助手消息**只画到 `typing.length` 个字符，并在末尾跟一个光标；
     * 打完就交还给完整正文。这样屏幕上只有**一条**文字载体，
     * 与魔夜"文字落在整屏暗带上"一致。
     *
     * ⚠ 打字机仍然按**句**推进（`splitSentences` → `sentIdx`），
     *   所以"一句一句出现"的节奏感保留，只是不再另起一层。
     */
    function Transcript(props) {
      const boxRef = useRef(null)
      /* `stick` 由调用方传入（`SkinRoot` 的 `stickToBottom`），因为
         "用户是否还在底部"要在**真正的滚动容器** `.myh-column` 上判定，
         而那个容器归 SkinRoot 渲染。不传时退化成组件自己的内部 ref（自洽）。 */
      const ownStick = useRef(true)
      const stickRef = props.stick || ownStick
      const msgs = props.messages || []
      const typing = String(props.typing || '')
      // 正在打字的那一条 = 最后一条助手消息（工具条/错误行不参与）
      let typingIdx = -1
      if (typing.length > 0 && msgs.length > 0) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i] && msgs[i].role === 'assistant' && msgs[i].text) { typingIdx = i; break }
        }
      }
      /* ★ 身份校验：只有"最后一条助手消息"**就是**当前这句台词的来源时才打。
         `st.line` 来自 `extractAssistantText`（同一套多路兜底），正常情况与它同源；
         但形状不符时可能取到别的节点 —— 那时切片会错位，宁可整段直显，
         也不要"显示一句不属于这条消息的话"。

         ⚠⚠ 方向必须搞对（第一版写反了，被端到端断言当场抓住）：
           打字机中的 `line` 是**前缀**（"アンタ、"），后面还没写出来，
           所以**没有**"正文的末尾"可找。
           正确判据是反过来：**`typing` 必须能被这条正文以相同前缀容纳**
           ——即 `full.startsWith(typing)`。反过来查（在 typing 里找 full 的尾巴）
           永远不成立，会把正常的打字机整个判掉。 */
      if (typingIdx >= 0) {
        const full = String(msgs[typingIdx].text || '')
        if (typing && full.indexOf(typing) !== 0) typingIdx = -1
      }

      /* 贴底跟随：只有用户本来就在底部时才自动滚（别抢用户的滚动位置）。
         ★★★ 2026-09-21 修：**真正滚动的是 `.myh-column`，不是 `.myh-transcript`**。
         2026-09-21 起列铺满视口、由列自己滚动（见 CSS 里那三条规则），
         于是 `boxRef`（transcript）的 `scrollHeight === clientHeight`，
         在它身上赋 `scrollTop` **一点效果都没有** → 内容停在顶部，
         用户看到的是会话开头的旧记录，而不是最新那一句。

         所以往上找到真正的滚动祖先（closest 带 overflow-y 的那个）再滚。
         用 `closest('.myh-column')` 而不是 `parentElement`：
         中间将来多包一层也不会失效。 */
      const scrollHost = function () {
        const el = boxRef.current
        if (!el) return null
        try { return el.closest('.myh-column') || el } catch { return el }
      }
      useEffect(function () {
        const el = scrollHost()
        if (!el || !stickRef.current) return
        try { el.scrollTop = el.scrollHeight } catch { /* ignore */ }
      }, [msgs.length, props.agent, typing])

      return h('div', { className: 'myh-transcript', ref: boxRef },
        h('div', { className: 'myh-flow' },
          msgs.length === 0
            ? h('div', { className: 'myh-flowEmpty' },
              props.agent === 'generating' ? '……' : '（这段会话还没有内容）')
            : msgs.map(function (m, i) {
              return h(MessageRow, {
                key: m.id, m: m,
                // ★ 打字机只作用于"最后一条助手消息"，见 Transcript 头注释
                typing: i === typingIdx ? typing : '',
              })
            }),
          props.agent === 'generating'
            ? h('div', { className: 'myh-typing' }, '正在书写…')
            : null))
    }

    /** 菜单项：左键只移焦点，Enter / 右键才确认（docs/08 §1.2 / 09 A13）。 */
    function MenuItem(props) {
      const item = props.item
      return h('button', {
        type: 'button',
        className: item.cls || 'myh-item',
        'data-focus': item.focused ? 'true' : undefined,
        'data-current': item.current ? 'true' : undefined,
        'aria-disabled': item.disabled ? 'true' : undefined,
        onMouseEnter: function () { props.onFocus(item.id) },
        onFocus: function () { props.onFocus(item.id) },
        /* ★★★ 2026-09-21 用户定案（输入语义）：
           · 悬停 = 移焦点
           · **左键点菜单项 = 逐层退回**（子菜单→主列表；主列表→关闭菜单）
           · **右键 / Enter = 确认进入**
           所以左键**不再**只是"移焦点"，而是走 onBack。 */
        onClick: function (e) {
          e.preventDefault()
          props.onFocus(item.id)
          if (props.onBack) props.onBack(item.id)
        },
        onContextMenu: function (e) {
          e.preventDefault()
          if (!item.disabled) props.onActivate(item.id)
        },
        onKeyDown: function (e) {
          if (e.key === 'Enter' && !item.disabled) { e.preventDefault(); props.onActivate(item.id) }
        },
      },
        h('span', { className: 'myh-itemCn' }, item.cn),
        item.en ? h('span', { className: 'myh-itemEn' }, item.en) : null,
        item.cls === 'myh-srow' ? null : h('span', { className: 'myh-itemRule' }))
    }

    /**
     * L2 菜单板：原作 menu_window 形态。
     *
     * 结构（2026-09-21 重做）：
     *   ┌──────────────────────────────┐
     *   │ 标题图（mu_title）            │  ← 固定
     *   │ 会话区（**只有它滚**）        │  ← flex:1 + overflow:auto
     *   │ ──────────────────────────── │
     *   │ 新建对话 / 更多 / 返回起始页   │  ← 固定，**永不跟着滚**
     *   └──────────────────────────────┘
     *
     * 为什么动作区必须固定在滚动区之外：上一版把「新建/返回」塞进会话列表末尾，
     * 实测 198 条会话 → 滚动高度 20681px、「返回起始页」在 y=20652，
     * **永远点不到**，L1 因此一次都没进去过。原作菜单从不滚动（8 项 ×110 = 880 装进 1080），
     * 所以"固定区 + 局部滚动"才是它的形态。
     *
     * 「更多」子菜单：原作**没有**这一层（它只有 8 项固定）。
     * 这是本项目为解决"会话太多"加的延伸，形态照原作按钮条做。
     */
    function Menu(props) {
      const mode = props.menuMode === 'list' ? 'list' : 'main'
      const all = props.sessions || []

      function row(s) {
        return h(MenuItem, {
          key: 'sess:' + s.id,
          item: {
            id: 'sess:' + s.id, cls: 'myh-srow myh-mrow',
            cn: s.title || s.id, en: s.meta || undefined,
            current: s.id === props.currentId,
            focused: props.focus === 'sess:' + s.id,
          },
          onFocus: props.onFocus, onActivate: props.onActivate, onBack: props.onBack,
        })
      }
      function act(id, cn, focused) {
        return h(MenuItem, {
          key: id,
          /* ★ 2026-09-22（第 10 条补漏）：**列表态的「返回」也要是行条**。
             实测漏了：会话行挂了 `myh-mrow`，而「返回」只有 `myh-srow myh-act` ——
             于是它渲染成 338×67 / 圆角 0 / 无边 / 透明底，与上面三行 324×64 的
             行条**明显不是一套**。列表态（mode === 'list'）补上 `myh-mrow`。 */
          item: {
            id: id,
            cls: 'myh-srow myh-act' + (mode === 'list' ? ' myh-mrow' : ''),
            cn: cn, focused: focused,
          },
          onFocus: props.onFocus, onActivate: props.onActivate, onBack: props.onBack,
        })
      }

      /* ★★★ 2026-09-21 用户定案：**L2 主列表不列会话**，只放固定三项；
         会话列表挪进「会话列表」子菜单（menuMode === 'list'）。
         主列表：新建对话 / 会话列表 / 返回起始页（皮肤设置留在 L1）。 */
      const crumb = h('div', { className: 'myh-menuCrumb' }, '会话列表')
      const list = mode === 'list'
        ? (all.length ? all.map(row) : h('div', { className: 'myh-menuEmpty' }, '这个工作区还没有对话'))
        : null
      const acts = mode === 'list'
        ? [act('listback', '返回', props.focus === 'listback')]
        : [
            act('new', '新建对话', props.focus === 'new'),
            act('list', '会话列表' + (all.length ? '（' + all.length + '）' : ''), props.focus === 'list'),
            act('back', '返回起始页', props.focus === 'back'),
          ]

      return h('div', {
        className: 'myh-menu',
        'data-open': props.open ? 'true' : 'false',
        'data-mode': mode,
        'aria-hidden': props.open ? undefined : 'true',
        /* ★★★ 2026-09-22（用户第 2 条）：**面板的空白处也要接左键**。
           实测死区：点在面板里没有控件的地方，命中 `.myh-menuBody`，而它没有 onClick
           ⇒ 毫无反应。这里挂到面板根上，语义与别处一致（左键 = 逐层退回/收回菜单）。
           ⚠ 必须排除 `button` —— 菜单项自己的左键已经会 `onBack`（逐层退回），
             不排除的话一次点击会被处理两次，表现为"点一下退两层"。 */
        onClick: function (e) {
          const t = e.target
          if (t && t.closest && t.closest('button,input,a,[role="button"],[role="menuitem"]')) return
          if (props.onBackdrop) props.onBackdrop()
        },
      },
        h('div', { className: 'myh-menuBg', style: props.bg ? { backgroundImage: 'url(' + props.bg + ')' } : undefined }),
        h('div', { className: 'myh-menuBody' },
          mode === 'list' ? crumb : null,
          list ? h('div', { className: 'myh-menuList' }, list) : null,
          h('div', { className: 'myh-menuActs' }, acts),
          h('div', { className: 'myh-menuInfo' }, props.info)))
    }

    function Button(props) {
      return h('button', {
        type: 'button', className: 'myh-btn', onClick: props.onClick,
        'aria-disabled': props.disabled ? 'true' : undefined,
      },
        props.mask ? h('span', {
          className: 'myh-btnMask',
          style: { WebkitMaskImage: 'url(' + props.mask + ')', maskImage: 'url(' + props.mask + ')' },
        }) : null,
        h('span', { className: 'myh-btnLabel' }, props.label))
    }

    /** 木框：九宫格拉伸（装饰件永不拉伸变形，docs/08 §2.4）。 */
    function Wood(props) {
      if (!props.src) return null
      return h('div', { className: 'myh-wood', style: { borderImageSource: 'url(' + props.src + ')' } })
    }

    /** 表紙（home）：title_bg + title_menu 形态。 */
    /** L1 起始页：背景用壳景（浅 B3 / 深 B4）。菜单按 title_menu 实测规格重画。 */
    function TitlePage(props) {
      return h('div', {
         className: 'myh-page',
         /* ★★★ 2026-09-22（用户第 1 / 3 条）：**空白处点击 = 逐层退回**，与 L2 一致。
            病根：`.myh-page` 是 pointer-events:auto 的整屏层，但**自身没有 onClick** ——
            于是 L1 上只有"正正点在菜单项上"才有反应，点别处一律无响应。 */
         onClick: function (e) {
           const t = e.target
           /* 控件自己处理左键，这里必须让开，否则会退回两次 */
           if (t && t.closest && t.closest('.myh-item,.myh-srow,.myh-btn')) return
           if (props.onBack) props.onBack()
         },
      },
        props.bg ? h('img', { className: 'myh-pageBg', src: props.bg, alt: '' }) : null,
        h('div', { className: 'myh-pageInner' },
          h('div', { className: 'myh-titleWrap' },
            h('div', {
              className: 'myh-titleList',
              'data-mode': props.mode === 'workspaces' ? 'workspaces' : 'menu',
            },
              props.items.map(function (it) {
                return h(MenuItem, {
                  key: it.id, item: it,
                  onFocus: props.onFocus, onActivate: props.onActivate, onBack: props.onBack,
                })
              })))),
        )
    }

    /** 書庫：会话列表（木书架 + 书脊横放 + 新建位）。 */
    /** 付箋：轨迹（原始事件流贴成手绘便签，docs/09 A4）。 */
    /* ==================================================================
     * 環境設定 —— 按原著五页签布局重做（2026-09-22）
     * ==================================================================
     * 用户原话：「皮肤设置界面完全不合格。相比于之前不是根本就没有改过吗？」
     *          「你啥没有原著设置参考页？原著就在项目中啥是没有？是你自己没有看」
     *
     * 他说得对 —— 此前这里是竖排四组自造清单。真正的原著環境設定是
     * **横排五个分类页签**（声音设置 / 语音设置 / 文本设置 / 操作设置 / 操作说明），
     * 页内是「标签 + 选项按钮组 / 滑条」，底部一枚「恢复初始设置」。
     * 全部素材已从图集裁成独立文件放在 `skin/assets/ui/conf/`。
     *
     * ★ 交互口径（与外层**完全一致**，这正是用户第 1/6 条要的"别再自成一派"）：
     *   · 光标移到控件上 = 移焦点（沿用全文件的 setMenuFocus，会发选中音）
     *   · **左键 / Esc = 逐层退回**（页面上任何位置，含控件）
     *   · **右键 / Enter = 操作当前项**
     * ⚠ 所以页内的按钮**一律不接 onClick** —— 左键统一由页面根的 onClose 收走，
     *   这样"点哪儿都退一层"，不会出现"点控件没反应"的死区（用户第 1 条的病根）。
     */
    const CONF_TABS = ['sound', 'voice', 'text', 'ops', 'help']
    const CONF_TAB_CN = { sound: '声音设置', voice: '语音设置', text: '文本设置', ops: '操作设置', help: '操作说明' }
    /** 每个页签里的项 —— 同时是上下键焦点表的第二段（见 navIdsOf）。 */
    const CONF_ROWS = {
      sound: ['c:bgm', 'c:vol', 'c:sfx'],
      voice: ['c:persona'],
      text: ['c:sprite', 'c:dialogue', 'c:tabs', 'c:collapse'],
      ops: ['c:enabled', 'c:character', 'c:egg'],
      help: [],
    }
    /**
     * 行内的**可选项** —— 只回答「这一行内部能选什么」。
     * 2026-09-22（用户第 2 条）：原话「选到内部有选项的框框中，无法选中内部的内容，
     * 所以根本无法调整这些设置」。根因是焦点**只到行**、到不了行内的按钮。
     * 这张表让焦点表能把行**展开成选项**，id 形如 `c:bgm#on`。
     * ⚠ 不在这张表里的行（滑条 `c:vol`、页脚 `c:dflt`）仍是**行级** —— 没有离散可选值。
     */
    const CONF_OPTS = {
      'c:bgm': ['off', 'on'],
      'c:persona': ['off', 'on'],
      'c:enabled': ['off', 'on'],
      'c:sprite': ['off', 'on'],
      'c:dialogue': ['off', 'on'],
      'c:tabs': ['off', 'on'],
      'c:collapse': ['off', 'on'],
      'c:sfx': ['off', 'on'],
      'c:egg': ['off', 'on'],
      'c:character': CHARACTERS.slice(),
    }
    /** `c:bgm#on` -> { base: 'c:bgm', val: 'on' }；无 `#` 时 val 为 null。 */
    function splitOpt(id) {
      const i = String(id).indexOf('#')
      return i < 0 ? { base: id, val: null } : { base: id.slice(0, i), val: id.slice(i + 1) }
    }
    /** 某一行当前**选中**的选项 id（用于「hover 行标签时聚焦到已选项」）。 */
    function selOptOf(base, st) {
      const set = st.settings || {}
      if (base === 'c:character') return base + '#' + (set.character || 'aoko')
      if (!CONF_OPTS[base]) return base
      const KEY = {
        'c:bgm': 'bgm', 'c:persona': 'persona', 'c:enabled': 'enabled', 'c:sprite': 'showSprite',
        'c:dialogue': 'showDialogue', 'c:tabs': 'hideTabs', 'c:collapse': 'autoCollapse',
        'c:sfx': 'sfx', 'c:egg': 'easterEgg',
      }[base]
      const cur = base === 'c:collapse' ? (set.autoCollapse !== false) : !!set[KEY]
      return base + '#' + (cur ? 'on' : 'off')
    }
    /** 「恢复初始设置」写回去的值 —— 与 `skin/lib/index.js` 的 DEFAULTS 对齐。 */
    const CONF_DFLT = {
      character: 'aoko', persona: true, enabled: true, showSprite: true, showDialogue: true,
      hideTabs: true, autoCollapse: true, bgm: true, bgmVolume: 0.35, sfx: true, easterEgg: true,
    }

    /**
     * 分类页签：真图 `btn_base0_zc` 的一格（322×79）。
     * 三态各取一格 —— 常态 s0 / 悬停 s1 / 选中 s2（实测 s2 与 s3 同图）。
     */
    function ConfTab(props) {
      return h('button', {
        type: 'button', className: 'myh-tab',
        'data-sel': props.sel ? 'true' : undefined,
        'data-focus': props.focused ? 'true' : undefined,
        'aria-label': props.cn,
        onMouseEnter: function () { if (props.onFocus) props.onFocus(props.id) },
        /* ⚠ 没有 onClick：左键归页面根（逐层退回），见本段顶部注释。 */
        onContextMenu: function (e) {
          e.preventDefault()
          if (props.onActivate) props.onActivate(props.id)
        },
        style: { backgroundImage: 'url("' + props.art + '")' },
        title: props.cn,
      })
    }

    /**
     * 布尔项：原作自己的 **OFF / ON** 两枚按钮（`btn_base2_zc`，216×72 一格）。
     * s0 = 被选中（亮青 rgb(10,98,95)）/ s1 = 未选中（暗青 rgb(6,53,52)）
     * —— 这就是原作的"单选按钮组"观感，比自己画开关忠实得多。
     */
    function ConfBool(props) {
      const mk = function (flag, cn, val) {
        const on = props.on === flag
        /* s0 = 被选中（亮青 rgb(10,98,95) + 青描边）/ s1 = 未选中（暗青 rgb(6,53,52)） */
        const url = assetURL('ui/conf/opt2_c' + (cn === 'ON' ? 1 : 0) + '_s' + (on ? 0 : 1) + '.png')
        return h('button', {
          key: cn, type: 'button', className: 'myh-opt', role: 'radio',
          'aria-checked': on ? 'true' : 'false',
          'data-focus': props.focused === val ? 'true' : undefined,
          'aria-label': props.label + ' ' + cn,
          /* 2026-09-22（用户第 2 条）：**焦点落在这一枚按钮上**。
             原来这里交回整行（`props.id`），于是 OFF/ON 永远拿不到焦点，
             用户看到的就是「选中了框、却选不中框里的内容」。
             现在用 `c:bgm#on` 这种复合 id —— 与 navIdsOf 展开出来的 id 一致。 */
          onMouseEnter: function () {
            if (props.onFocus) props.onFocus(props.id + '#' + val)
          },
          onContextMenu: function (e) {
            e.preventDefault()
            if (props.onActivate) props.onActivate(props.id + '#' + val, val)
          },
          style: { backgroundImage: 'url("' + url + '")' },
          title: cn,
        })
      }
      /* ⚠ 第三参是**焦点/取值用的字符串**（'off' / 'on'），与第二个参数（显示用的
         'OFF' / 'ON'）分开 —— 复合 id 里要的是前者。 */
      return h('div', { className: 'myh-opts' }, mk(false, 'OFF', 'off'), mk(true, 'ON', 'on'))
    }

    /**
     * 滑条：旋钮 `conf_sbtn`（上态亮白青光晕 / 下态灰）+ 两端标签 `conf_stxt01_zc`。
     * 值与步进仍由外层 `handleMenu('c:vol')` 管（右键 / Enter 加 10%，到顶回卷）。
     */
    function ConfSlider(props) {
      const pct = Math.round((props.value == null ? 0.35 : props.value) * 100)
      const glow = props.focused
      const F = props.focus
      const onF = props.onFocus
      /* ★★★ 2026-09-23（用户第 2 版：「你现在这个逻辑只能调整一次性变得最大，按小就会一次性变得最小。
         你要不改成与其他的一样的小方块，然后多给几个档位的选项得了」）：
         上一版是滑条 + 两端 小/大。滑条本身能用了，但两端是**硬跳**（一点就 0 或 1），
         所以手感是「一下最大 / 一下最小」。现在改成**五个档位方块**，
         与布尔行的 OFF / ON 同一套观感（青描边 + 选中填充 + 焦点环），
         只是从两枚变成五枚，每个方块里写百分比数字。

         ⚠ 只改**显示**做就近归档：`0.35` 点亮 25% —— 但 `bgmVolume` 的值仍是 0.35，
           不写回。这样「恢复初始设置」的 0.35 与 BGM 播放时的 clamp 都不受影响。
         ⚠ 写值走档位**真值**（点 75% 就写 0.75），不是归档后的值 —— 否则连点同一个
           方块会来回改数。
         ⚠ 左键必须 `stopPropagation()`：页根 onClick 是「逐层退回」，
           不拦的话同一次左键会**又设值又退回**。
         ⚠ 容器类名保留 `.myh-sl` —— 页根的排除表用的是它（见 ConfigPage 的 onClick）。 */
      const STEPS = [0, 0.25, 0.5, 0.75, 1]
      const nearest = function (v) {
        const x = (v == null ? 0.35 : v)
        /* ⚠ 两个名字**分两行声明**：`lint-identifiers.mjs` 的声明名正则
           `/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g` 只吃逗号前的第一个名字，
           写成 `let best = 0, bd = 9` 时 `bd` 会被当成裸标识符报出来。
           （2026-09-23 实测：这么写它确实报 `? bd ×3`，红灯。） */
        let best = 0
        let bd = 9
        for (let i = 0; i < STEPS.length; i++) {
          const d = Math.abs(STEPS[i] - x)
          if (d < bd) { bd = d; best = i }
        }
        return best
      }
      const cur = nearest(props.value)
      const pick = function (i) {
        return function (e) {
          /* 只认左键：右键留给「步进」（见 handleMenu 的 c:vol），别抢。 */
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          if (props.onSet) props.onSet(STEPS[i])
        }
      }
      return h('div', { className: 'myh-sl' },
        STEPS.map(function (v, i) {
          return h('span', {
            key: 'v' + i,
            className: 'myh-step',
            role: 'radio',
            'aria-checked': i === cur ? 'true' : 'false',
            'data-on': i === cur ? 'true' : undefined,
            'data-focus': F === 'c:vol#' + i ? 'true' : undefined,
            'aria-label': '音量 ' + Math.round(v * 100) + '%',
            title: Math.round(v * 100) + '%',
            onMouseEnter: function () { if (onF) onF('c:vol#' + i) },
            onClick: pick(i),
          }, Math.round(v * 100) + '%')
        }))
    }

    /** 環境設定：铺满全屏的独立界面（不是弹窗 —— 用户第 3 条）。 */
    function ConfigPage(props) {
      const s = props.settings || {}
      const tab = CONF_TABS.indexOf(props.tab) >= 0 ? props.tab : 'sound'
      const F = props.focus
      /* ⚠ 两个名字**分两行声明**：`lint-identifiers.mjs` 的声明名正则
         `/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g` 只吃逗号前的第一个名字，
         写成 `const onF = …, onA = …` 时 `onA` 会被误报成未定义。
         （不改检查脚本 —— 放宽它会把真未定义也一起放过去。） */
      const onF = props.onFocus
      const onA = props.onActivate
      /* ★ 2026-09-23：滑条的写值入口（接到 `applySettings({ bgmVolume })`）。
         单独取名，以免与 `onA`（激活当前项）混淆 —— 见 ConfSlider 顶部注释。 */
      const onSetVol = props.onSetVolume
      /* 素材路径在这里拼 —— `assetURL()` 会自动带上 `?v=<BUILD_ID>`（红线 9）。 */
      const A = assetURL
      /* ⚠ 2026-09-23（五档版）：原来这里还有一个 `art` 对象，装着滑条的旋钮
         （`knob_s0/s1`）与两端标签（`stxt01_{s,l}_s{0,1}`）共 6 个切片路径。
         音量改成**五档方块**（纯 CSS 画）之后，这 6 个字段**零引用**，已删。
         那 6 个切片文件仍留在 `skin/assets/ui/conf/`（不删 —— `crop_conf.py --check`
         要求 80/80，删了会破坏那条断言），只是**暂时没有代码引用**。
         ⚠ `A` 本身**不能删**：下面给页签拼 `ui/conf/tab{0-4}_s{0-3}.png` 还在用它。 */

      const tabs = h('div', { className: 'myh-confTabs' }, CONF_TABS.map(function (id, i) {
        return h(ConfTab, {
          key: id, id: 't:' + id, cn: CONF_TAB_CN[id], sel: id === tab,
          focused: F === 't:' + id,
          /* 三态各取真图一格：选中 s2 / 悬停 s1 / 常态 s0（实测 s2 与 s3 同图）*/
          art: A('ui/conf/tab' + i + '_s' + (id === tab ? 2 : (F === 't:' + id ? 1 : 0)) + '.png'),
          onFocus: onF, onActivate: onA,
        })
      }))

      const crow = function (id, label, hint, control) {
        /* 2026-09-22（用户第 2 条）：**焦点落到「行内的某一项」**。
           有 CONF_OPTS 的行（布尔 / 角色）不再把焦点给行，而是给**当前已选中**的那一项
           —— 这样从标签区移过去不会跳到空处，方向键也不会多按一次。
           ⚠ 行自身的焦点环 `data-focus` 对这类行**不再点亮**（焦点在选项上）。 */
        const hasOpts = !!CONF_OPTS[id]
        const inner = hasOpts ? ((F && F.indexOf(id + '#') === 0) ? F : selOptOf(id, s)) : id
        return h('div', {
          className: 'myh-crow',
          'data-focus': (!hasOpts && F === id) ? 'true' : undefined,
          onMouseEnter: function () { if (onF) onF(inner) },
          /* ★★★ 2026-09-22 修：**行级右键**。
             `ConfBool` 的按钮自己挂了 onContextMenu，所以布尔行右键本来就有反应；
             而「音量」「当前角色」两行用的是自绘控件（滑条 / 角色名 span），
             **没有**任何右键入口 —— 这两行右键点下去毫无反应，与布尔行不一致
             （用户第 1 条"操作逻辑一搭没一搭"的同型复发）。
             ⚠ 为什么用**白名单**而不是"行上统一挂一个"：
               布尔行在按钮上已经处理过右键，事件会继续冒泡到行，
               行上再挂一个就会**同一动作跑两次**（切一次再切回来）。
               所以只在"控件自己不管右键"的那两行上由行接管。
             ⚠ 这张白名单必须与 `CONF_ROWS` 里的自绘控件项**同步**：
               目前只有 `c:vol`（滑条）与 `c:character`（角色名 span）。 */
          /* 2026-09-22：白名单收窄成**只有 `c:vol`** —— 角色行现在与布尔行一样，
             由行内的按钮自己处理右键（带具体值），行上再挂一个会跑两次。 */
          onContextMenu: id === 'c:vol'
            ? function (e) { e.preventDefault(); if (onA) onA(id) }
            : undefined,
        },
          h('span', { className: 'myh-clab' }, label, hint ? h('small', null, hint) : null),
          control)
      }

      const boolRow = function (id, label, hint, on) {
        /* 当前聚焦的是本行的**哪一个选项**（'on' / 'off' / null）。 */
        const fix = (F && F.indexOf(id + '#') === 0) ? F.slice(id.length + 1) : null
        return crow(id, label, hint,
          h(ConfBool, { id: id, label: label, on: !!on, focused: fix, onFocus: onF, onActivate: onA }))
      }

      const body = (function () {
        if (tab === 'sound') {
          return [
            boolRow('c:bgm', '背景音乐', '表紙浅/深各一首；日常按明暗各一组循环', s.bgm),
            crow('c:vol', '音量', '左键直接点某个档位；右键 / Enter 在五档之间前后移动',
              h(ConfSlider, {
                value: s.bgmVolume, focused: F === 'c:vol',
                /* 五个档位方块各自是焦点目标（`c:vol#0` … `c:vol#4`）。 */
                focus: F, onFocus: onF,
                /* 写值统一交给 applySettings —— 见 ConfSlider 顶部注释。 */
                onSet: function (v) { if (onSetVol) onSetVol(v) },
              })),
            boolRow('c:sfx', '界面音效', '原作 UI 音效（移动 / 确定 / 取消）；素材缺失时静默降级', s.sfx),
          ]
        }
        if (tab === 'voice') {
          return [
            boolRow('c:persona', '人格注入', '把该角色的 soul/injection.md 注入系统提示词（每轮生效）', s.persona),
          ]
        }
        if (tab === 'text') {
          return [
            boolRow('c:sprite', '立绘', '只用特写差分（_b 全身版原作从未使用）', s.showSprite),
            boolRow('c:dialogue', '底部对话框', 'H = 86 + 44 × (行数−1)，三档色阶随 agent 状态', s.showDialogue),
            boolRow('c:tabs', '隐藏页签条', '隐藏失败时自动降级为 mu_bar 细条', s.hideTabs),
            boolRow('c:collapse', '进入时收起侧栏', '只在实测侧栏展开时才调官方 toggleSidebar()；之后你手动展开，皮肤不再干预', s.autoCollapse !== false),
          ]
        }
        if (tab === 'ops') {
          return [
            boolRow('c:enabled', '启用皮肤', '关掉即回到 DSH 原始外观。⚠ 关掉后这个页面就进不去了 —— 恢复用右下角横幅、Ctrl+Shift+U，或地址栏 ?mahoyo=on', s.enabled),
            crow('c:character', '当前角色', '决定立绘、表情表与人格注入切片（昼夜共用同一套人格）。右键 / Enter 切下一个',
              h('div', { className: 'myh-opts', role: 'radiogroup' }, CHARACTERS.map(function (id) {
                /* 2026-09-22（用户第 2 条）：**每个角色名自己可聚焦、自己可选中**。
                   原来它只是个 span —— 没有焦点、也没有右键入口，
                   「想直接选有珠」这件事做不到（只能一路右键切过去）。 */
                return h('span', {
                  key: id, className: 'myh-optTxt', role: 'radio',
                  'aria-checked': s.character === id ? 'true' : 'false',
                  'data-focus': F === 'c:character#' + id ? 'true' : undefined,
                  onMouseEnter: function () { if (onF) onF('c:character#' + id) },
                  onContextMenu: function (e) {
                    e.preventDefault()
                    if (onA) onA('c:character#' + id, id)
                  },
                }, CHARACTER_CN[id])
              }))),
            boolRow('c:egg', 'ED 彩蛋', '上下文到达阈值 → ED 背景 + m53，放完自动回（阈值钉死 0.78，不可改）', s.easterEgg),
          ]
        }
        return [
          h('p', { className: 'myh-confNote' },
            '光标移到项上 = 选中，左键 / Esc = 退回上一层，右键 / Enter = 操作当前项。',
            '\n',
            h('b', null, '声音设置'), '　背景音乐 · 音量 · 界面音效',
            '\n',
            h('b', null, '语音设置'), '　人格注入',
            '\n',
            h('b', null, '文本设置'), '　立绘 · 底部对话框 · 页签条 · 侧栏',
            '\n',
            h('b', null, '操作设置'), '　启用皮肤 · 当前角色',
            '\n',
            h('b', null, '↑ / ↓'), '　在页签与本页各项之间移动',
            '\n',
            h('b', null, '恢复初始设置'), '　把上面全部写回出厂值（右键 / Enter 触发）'),
          h('div', { className: 'myh-confStat' }, props.info || ''),
        ]
      })()

      return h('div', {
        className: 'myh-page',
        /* ★★★ 左键 / 空白处 = 逐层退回（回 L1）。**页内控件一律不接 onClick**，
           所以这里只排除原生输入控件，不用排除自绘控件 ——
           这正是"点哪儿都退一层"的实现方式，没有死区。 */
        onClick: function (e) {
          const t = e.target
          if (t && t.closest && t.closest('input,textarea,select')) return
          /* ★ 2026-09-23：**只排除滑条** —— 它的左键现在有真实语义（点哪设哪）。
             不排除的话同一次左键会**又设值又退回**：实测左键点滑轨 25% 处
             直接回 L1（层 config → L1-main），用户看到的就是「点了没反应」。
             ⚠ **不排除** .myh-tab / .myh-opt / .myh-optTxt / .myh-dflt ——
               用户早前定过「左键到哪儿都退一层、没有死区」（他第 1 条抱怨的修法）。
               把那些也排除，左键落在页签 / 按钮上会什么都不发生 = 把死区又装回去。 */
          if (t && t.closest && t.closest('.myh-sl')) return
          if (props.onClose) props.onClose()
        },
      },
        /* 2026-09-22（用户第 1 条）：**背景换成 L1 界面的那张 + 一层暗底**。
           原来这里是透明的，于是底下的**阅读态立绘与正文**透上来 ——
           用户截图里那几行「有事就说…」就是它们。
           `bg` 由调用点从 `SHELL_OF[角色][昼夜]` → `m.scenes[景].bg` 推出来
           （与 L1 表紙同一真源，切角色 / 切昼夜都跟着变）。 */
        props.bg ? h('img', { className: 'myh-pageBg', src: props.bg, alt: '', draggable: false }) : null,
        h('div', { className: 'myh-confScrim' }),
        h('div', { className: 'myh-pageInner' },
          h('div', {
            className: 'myh-conf',
            style: {
              '--myh-confFrame': props.frame ? 'url("' + props.frame + '")' : 'none',
            },
          },
            props.title ? h('div', { className: 'myh-confTitle', style: { backgroundImage: 'url("' + props.title + '")' } }) : null,
            tabs,
            h('div', { className: 'myh-confBody' }, body),
            h('div', { className: 'myh-confFoot' },
              h('button', {
                type: 'button', className: 'myh-dflt',
                'data-focus': F === 'c:dflt' ? 'true' : undefined,
                'aria-label': '恢复初始设置', title: '恢复初始设置',
                onMouseEnter: function () { if (onF) onF('c:dflt') },
                onContextMenu: function (e) { e.preventDefault(); if (onA) onA('c:dflt') },
                style: { backgroundImage: 'url("' + assetURL('ui/conf/dflt_s0.png') + '")' },
              })))))
    }

    /** ED 彩蛋层：ED 背景 img2073 + credit 滚动 + m53。 */
    function EdLayer(props) {
      return h('div', { className: 'myh-ed' },
        props.bg ? h('img', { className: 'myh-edBg', src: props.bg, alt: '' }) : null,
        h('div', { className: 'myh-edScrim' }),
        h('div', { className: 'myh-edRoll' },
          h('div', { className: 'myh-edTitle' }, '魔法使之夜'),
          h('div', { className: 'myh-edSub' }, 'WITCH ON THE HOLY NIGHT'),
          props.lines.map(function (t, i) { return h('div', { key: i, className: 'myh-edLine' }, t) })),
        h('div', { className: 'myh-edHint' }, 'ED 结束后自动返回'),
        h('div', { style: { position: 'absolute', left: '3%', bottom: '3%', width: 'auto' } },
          h(Button, { label: '跳过', onClick: props.onStop })))
    }

    // ==================================================================
    // §8 SkinRoot —— 注册进 shell.overlay 的整屏皮肤
    // ==================================================================

    /** 皮肤上下文盒子（apply 时填入；根组件读服务用）。 */
    const svc = { ctx: null }

    // ==================================================================
    // §8.5 版面测量 —— 让皮肤"知道"DSH 的正文与输入框在哪、多高
    // ==================================================================
    //
    // 这是"全新 UI"与"贴一层覆盖层"的分界线：
    //   · 贴一层：皮肤自己铺满，DSH 埋在下面，什么都看不见
    //   · 全新 UI：皮肤把 DSH 的正文当成自己的正文区 ——
    //     于是必须实测出正文区矩形，才能
    //       ① 把点击热区挖空，让正文能选中/滚动
    //       ② 把对话框落在输入框之上，而不是压住它
    //       ③ 暗带/立绘按正文区避让
    //
    // 全部用结构钩子 + 实测几何，不写死像素、不碰 hash 类名。

    /** 找一个元素的可视矩形（不可见则返回 null）。 */
    function rectOf(el) {
      if (!el) return null
      try {
        const r = el.getBoundingClientRect()
        if (!r || r.width < 4 || r.height < 4) return null
        return r
      } catch { return null }
    }

    /** 第一次匹配到的元素。 */
    /**
     * ★★★ 2026-09-20：**焦点取证**（只读观察，不改任何行为）。
     *
     * 为什么需要：输入框的几何、可编辑性、命中测试**全部正常**
     * （`editable:true`、rect 有效、`elementFromPoint` 三点都命中它），
     * 但用户反馈"点不动、打不了字"。那么最后可能出问题的一环就是**焦点**：
     * `contentEditable` 只有在真的拿到焦点之后才会接受键入。
     *
     * 之前的探针全是"某一时刻的快照"，而焦点是**事件**——快照拍不到。
     * 所以这里挂一次性的 `focusin` 监听，把**每一次焦点变化的落点**记进环形缓冲，
     * 由探针把最近几条带出来。这样"点了但焦点没进去"和"根本没触发点击"
     * 就能分开 —— 之前所有轮次的盲区都在这里。
     *
     * ⚠ 纯观察：不 preventDefault、不 retarget、不动焦点，只记录。
     */
    const focusLog = []
    function installFocusWatch() {
      if (installFocusWatch._done) return
      installFocusWatch._done = true
      try {
        const rec = function (kind, e) {
          try {
            const t = e.target
            focusLog.push({
              k: kind,
              tag: t && t.tagName ? t.tagName.toLowerCase() : '?',
              cls: t ? String(t.getAttribute('class') || '').slice(0, 34) : '',
              inComposer: t && t.closest ? !!t.closest('[data-composer-card]') : false,
              editable: t ? String(t.contentEditable) : '',
            })
            if (focusLog.length > 12) focusLog.shift()
          } catch (_e) { /* 记录失败不影响任何东西 */ }
        }
        document.addEventListener('focusin', function (e) { rec('in', e) }, true)
        document.addEventListener('focusout', function (e) { rec('out', e) }, true)
      } catch (_e) { /* ignore */ }
    }

    function pick(selectors) {
      for (const s of selectors) {
        try {
          const el = document.querySelector(s)
          if (el) return el
        } catch { /* 选择器不被支持就跳过 */ }
      }
      return null
    }

    /**
     * 第一次匹配到、且**矩形有效**的元素。
     *
     * ★★ 2026-09-19：必须逐个试到"矩形有效"为止。
     *    `[data-composer-seat]` 这种容器可能存在但矩形是 0（未布局/被折叠），
     *    老写法取到它就等于 composerH = 0 → `--myh-composer-top` 被写成视口高 →
     *    **正文层高度被压成 0，整个正文一个字都不显示**，屏幕上只剩一条无字的暗带，
     *    看着就像个莫名其妙的方框（用户实测反馈"不咋好看"）。
     */
    function pickVisible(selectors) {
      for (const s of selectors) {
        try {
          const el = document.querySelector(s)
          if (el && rectOf(el)) return el
        } catch { /* 选择器不被支持就跳过 */ }
      }
      return null
    }

    /**
     * ★★ DSH 自己的"要用户点"的面板在场吗？（审批卡 / 对话框 / 模态）
     *
     * 皮肤是**整屏覆盖层**（z-index 2147482000），热区只要还 armed，
     * 就能把 DSH 的按钮全吞掉。审批卡是 "composer takeover"，
     * 它的 DOM 钩子 `[data-approval-key]` 是 `dsh-client-ui-approval` 自己写的属性，
     * 属于稳定钩子（研究报告 §1 的口径）。
     *
     * 2026-09-19 实测故障：审批卡弹出 → 用户点不动「批准/拒绝」。
     * 定案：**只要有审批/对话框在场，热区一律让位。**
     */
    function uiNeedsPointer() {
      try {
        return !!document.querySelector(
          '[data-approval-key],[role="dialog"],[aria-modal="true"],[data-modal-open]')
      } catch { return false }
    }

    /**
     * ★ 2026-09-20：输入框现在是"真实的输入界面"，所以它自己也要有**三档状态**。
     *
     * `docs/04` §2.3 的三档本来是对话框的：深=空闲 / 中=生成中 / 浅=等待你。
     * 输入框天生就是"等你"，所以基线取**中档**（不是深档 —— 深档会让人看不见它），
     * 只在"确实轮到你了"时升到浅档。判据（都不依赖 DSH 内部状态，只看 DOM）：
     *   · 审批卡 / 模态在场 → 等你（`uiNeedsPointer` 的那套钩子）
     *   · 输入框为空 → 等你（空输入框就在等一个字）
     * 两档高度：textarea 空 48 / 有内容 72，长到 96 由 DSH 自己长（我们只给 min-height）。
     */
    function composerState() {
      const out = { waiting: false, empty: true, h: 88 }
      try {
        if (uiNeedsPointer()) out.waiting = true
        const input = document.querySelector('[data-composer-input]')
        const txt = input
          ? String(input.value != null ? input.value : input.textContent || '').trim()
          : ''
        out.empty = txt.length === 0
        /* ★★★ 2026-09-21（用户反馈修复）：**"空"不再驱动色阶**。
           用户："开始键入内容之后会变一下，把这个问题改了"。

           原来这里还有一行 `if (out.empty) out.waiting = true`，
           于是空 ↔ 非空会切换色阶：空 → `pale` 浅青(59,147,168)，
           敲第一个字 → `mid` 深青(26,100,131)，而卡片带
           `transition: background .25s` ⇒ **一次看得见的 0.25 秒变色**。
           实测（1600×900）确认了这次变色。

           为什么删掉而不是改色值：`pale` 档的语义是"**确实轮到你了**"
           （审批卡/模态在场）。"输入框是空的"不等于"轮到你了" ——
           用户只是还没开始打字而已，那时把一个"等你"的强调态点亮，
           既没有额外信息，又制造了这次闪烁。
           ⇒ 现在色阶只由**真实的等待态**驱动（`uiNeedsPointer()`），
             空与非空**外观完全一致**。 */
        /* ★★★ 2026-09-21：**高度公式原来差一行**。
           旧式：`88 + 42 × ceil(len / 46)`
             空 → 88 ；敲**第一个字** → ceil(1/46)=1 → **130**
           ⇒ 0→1 字硬跳 **42px**，这就是"开始键入之后会变一下"的第二半。

           按注释里自己写的规律（"88 = 细条实测高；步进 42 = 130 − 88"），
           一行的基准应当是 **88**、第二行才是 130。所以 `ceil` 之后要**减一**：
             0 字 → 88　1~46 字 → 88　47~92 字 → 130　…　上限 172
           `Math.max(0, …)` 保证空文本时不会变成 88−42。
           实测修正前后：0→1 字的高度跳变 **42px → 0px**。 */
        const lines = Math.max(0, Math.ceil(txt.length / 46) - 1)
        out.h = Math.min(172, 88 + 42 * lines)
      } catch { /* ignore */ }
      return out
    }

    /** 实测 DSH 的"正文块"与"输入框"，写进 CSS 变量 + store。 */
    /**
     * ★★ composer 候选选择器的**逐个**现场取证（Q14 用；**纯只读，不参与任何判定**）。
     *
     * 为什么需要它：`measureShell()` 用的是 `pickVisible()`，而 pickVisible 会
     * **丢掉矩形无效的候选**（这正是它的设计目的）—— 于是探针里只剩一个最终数字
     * `composerH`，**分不清**下面三种情况：
     *   ① 元素根本不在 DOM 里        → 没渲染
     *   ② 在 DOM 里但矩形是 0        → 渲染了但没布局（或被折叠）
     *   ③ 矩形有效但被皮肤/别的规则藏了 → display/visibility/opacity 变了
     * 台账 Q14 三步走的第一步要的就是这个区分，所以在这里把三个候选**各自**量一遍。
     *
     * ⚠ 本函数**只读**：不写 style、不设属性、不改任何状态。
     * ⚠ 返回值必须能过 `JSON.stringify`（红线 7）：全部是 number/boolean/string/null。
     */
    function composerCandidates() {
      const out = {}
      const sels = ['[data-composer-seat]', '[data-composer-card]', '[data-composer-input]']
      for (const s of sels) {
        const key = s.replace(/[\[\]]/g, '')
        try {
          const el = document.querySelector(s)
          const n = document.querySelectorAll(s).length
          if (!el) { out[key] = { found: false, count: n }; continue }
          const r = el.getBoundingClientRect()
          let st = null
          try { st = getComputedStyle(el) } catch { st = null }
          out[key] = {
            found: true,
            count: n,
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            display: st ? st.display : null,
            visibility: st ? st.visibility : null,
            opacity: st ? st.opacity : null,
            // offsetParent 为 null 是"被 display:none 的祖先藏了"的经典信号
            hasOffsetParent: !!el.offsetParent,
            childCount: el.children ? el.children.length : -1,
          }
        } catch (e) {
          out[key] = { error: String((e && e.message) || e) }
        }
      }
      // 皮肤自己那条"连坐隐藏"规则：div:has(> [data-rightbar-col]) ~ *{display:none!important}
      // 台账 Q14 第 2 步点名要盯的就是它 —— 直接看有没有匹配到、匹配到几个。
      try {
        out.siblingHideRuleMatches = document.querySelectorAll(
          'div:has(> [data-rightbar-col]) ~ *').length
      } catch { out.siblingHideRuleMatches = 'selector-unsupported' }
      try {
        const seat = document.querySelector('[data-composer-seat]')
        out.seatPath = seat ? String(seat.className || '') + ' | parent=' +
          (seat.parentElement ? seat.parentElement.tagName.toLowerCase() +
            '.' + String(seat.parentElement.getAttribute('class') || '') : '(无)') : null
      } catch { out.seatPath = null }
      return out
    }

    /**
     * ★★ 输入框 / 正文的**渲染实况**（2026-09-20，用户报"改了跟没改一样"之后加的）。
     *
     * 病根教训：皮肤改完 CSS 之后，"看起来没变"有三种完全不同的原因，
     * 光看截图分不出来 ——
     *   ① CSS 压根没生效（选择器没命中 / 被 DSH 更高优先级压掉）
     *   ② 生效了但**被别的东西盖住**（z-index / 覆盖层）
     *   ③ 生效了也画出来了，但**内容是空的**（数据链没接上）
     * 所以这里把三件事一次量完：命中情况、计算样式、内容。
     *
     * ⚠ 纯只读：不写 style、不设属性。返回值必须能过 `JSON.stringify`（红线 7）。
     */
    function composerProbe() {
      const out = { tone: null, hit: null, card: null, seat: null, input: null, texts: null }
      /* ★★ 2026-09-20：**先数清楚有几个**。
         实测症状：样式全部算对了（border-radius:0、我们的渐变、--dsh-composer-card-max-width:none），
         但每个 rect 都是 `[0,0,0,0]` —— 元素在 DOM 里、样式对，**却没有布局尺寸**。
         DSH 源码给了线索：`[data-conversation-composer-overlay]` 在场时，
         原生 seat 会被改成 `position:absolute; bottom:0`（`scrollBody:has(...)>.composerSeat`），
         也就是**可能有不止一个 composer 在 DOM 里**，而我们查询的是没有尺寸的那一个。
         所以这里把所有候选**逐个**列出来（tag/class/rect/display/offsetParent），
         一次看清"我们改的是哪一个、它为什么没尺寸"。 */
      try {
        const sels = ['[data-composer-seat]', '[data-composer-card]', '[data-composer-input]',
          '[data-conversation-composer-overlay]', '[data-conversation-scroll]', '[data-chat-flow]']
        const all = {}
        for (const s of sels) {
          const list = document.querySelectorAll(s)
          const rows = []
          for (let i = 0; i < list.length; i++) {
            const el = list[i]
            const r = el.getBoundingClientRect()
            const cs = getComputedStyle(el)
            rows.push({
              i: i,
              cls: String(el.getAttribute('class') || '').slice(0, 40),
              rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
              display: cs.display, vis: cs.visibility, op: cs.opacity,
              pos: cs.position, z: cs.zIndex,
              offsetParent: el.offsetParent ? el.offsetParent.tagName.toLowerCase() : null,
              kids: el.children.length,
            })
          }
          all[s] = { count: list.length, rows: rows }
        }
        /* ★★ 关键：**祖先链上是谁把它藏起来的**。
           元素在 DOM、样式算得对、rect 却是 0 —— 最可能就是某个祖先 `display:none`
           （皮肤自己的"原生外壳让位"规则就是靠 display:none 做的，一条连坐规则
           可能把输入框一起带走）。逐层报 display/visibility/尺寸，一次定位。 */
        const first = document.querySelector('[data-composer-card]') ||
          document.querySelector('[data-composer-seat]')
        const chain = []
        let el = first
        let d = 0
        while (el && d < 16) {
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          chain.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.getAttribute('class') || '').slice(0, 34),
            id: el.id || '',
            display: cs.display,
            vis: cs.visibility,
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
          el = el.parentElement
          d++
        }
        out.ancestors = chain
        /* ★★ 还差最后一块拼图：**皮肤自己那条 `div:has(> [data-shell-overlay])` 到底命中了谁**。
           实测 ancestor 链里 `centerCol w=0` 而 `frame w=1912` ——
           中间一定有个被压成 0 的层，但只看 width 看不出来是哪一条规则干的。
           这里把命中"皮肤会让位"的那个祖先的**全部相关计算样式**打出来：
           grid-template-columns / flex / min-width / overflow / 内联 style 全要。
           有了这个就不用再猜"是哪条规则把中列压成 0"。 */
        try {
          const frame = document.querySelector('div:has(> [data-shell-overlay])')
          if (frame) {
            const cs = getComputedStyle(frame)
            out.frame = {
              cls: String(frame.getAttribute('class') || '').slice(0, 40),
              inline: String(frame.getAttribute('style') || '').slice(0, 240),
              gridCols: cs.gridTemplateColumns,
              display: cs.display,
              w: Math.round(frame.getBoundingClientRect().width),
              kids: frame.children.length,
              kidRects: (function () {
                const a = []
                for (let i = 0; i < frame.children.length; i++) {
                  const c = frame.children[i]
                  const r = c.getBoundingClientRect()
                  a.push({
                    i: i,
                    cls: String(c.getAttribute('class') || '').slice(0, 30),
                    w: Math.round(r.width),
                    display: getComputedStyle(c).display,
                  })
                }
                return a
              })(),
            }
            const center = document.querySelector('[class*="centerCol"]')
            if (center) {
              const c2 = getComputedStyle(center)
              out.centerCol = {
                w: Math.round(center.getBoundingClientRect().width),
                inline: String(center.getAttribute('style') || '').slice(0, 160),
                flex: c2.flex, minWidth: c2.minWidth, overflow: c2.overflow,
                gridArea: c2.gridArea, colStart: c2.gridColumnStart, colEnd: c2.gridColumnEnd,
              }
            }
          }
        } catch (e) { out.frame = { error: String((e && e.message) || e) } }
        out.dom = all
      } catch (e) { out.dom = { error: String((e && e.message) || e) } }
      try {
        const rootEl = document.getElementById('myh-skin-root')
        out.tone = rootEl ? rootEl.getAttribute('data-myh-input-tone') : null
        out.h = rootEl ? getComputedStyle(rootEl).getPropertyValue('--myh-input-h').trim() : null
        out.grad = rootEl ? getComputedStyle(rootEl).getPropertyValue('--myh-composer-grad').trim().slice(0, 70) : null
      } catch (e) { out.tone = 'ERR ' + e.message }
      try {
        const card = document.querySelector('[data-composer-card]')
        const seat = document.querySelector('[data-composer-seat]')
        const inp = document.querySelector('[data-composer-input]')
        const R = function (el) {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
        }
        const S = function (el, props) {
          if (!el) return null
          const cs = getComputedStyle(el)
          const o = {}
          for (const p of props) o[p] = String(cs[p]).slice(0, 90)
          return o
        }
        out.hit = {
          seat: !!seat, card: !!card, input: !!inp,
          // 有没有**我们的**样式落到它身上：这几个值是我们唯一会改的
          seatMaxW: seat ? String(getComputedStyle(seat).getPropertyValue('--dsh-composer-card-max-width')).trim() : null,
        }
        out.seat = { rect: R(seat), css: S(seat, ['position', 'paddingLeft', 'paddingRight']) }
        out.card = {
          rect: R(card),
          css: S(card, ['borderRadius', 'backgroundImage', 'boxShadow', 'minHeight', 'width', 'maxWidth']),
        }
        out.input = {
          rect: R(inp),
          css: S(inp, ['fontSize', 'color', 'fontFamily']),
          /* ★★★ 2026-09-20：**输入框"看不见"只能靠这几个数区分**。
             用户报"没有输入框"。它的 rect 是有效的、editable 也是 true，
             所以不是"没渲染"，而是**看不见**或**被盖住**。可能的成因：
               ① 自身或祖先 opacity:0 / visibility:hidden / display:none
               ② 背景与文字都是透明的（DSH 的 textarea 字形本来就透明，
                  真正可见的是它上面的投影层）
               ③ 被同 z 层的兄弟盖住
             光看 rect 全部落在"分不出来"的那一类，所以把可见性三件套 +
             遮挡层一起量出来。 */
          vis: S(inp, ['opacity', 'visibility', 'display', 'backgroundColor', 'zIndex', 'position']),
          hiddenBySelf: (function () {
            try {
              let el = inp, d = 0
              while (el && d < 20) {
                const cs = getComputedStyle(el)
                if (cs.display === 'none') return 'display:none @ .' + String(el.getAttribute('class') || el.tagName).slice(0, 30)
                if (cs.visibility === 'hidden') return 'visibility:hidden @ .' + String(el.getAttribute('class') || el.tagName).slice(0, 30)
                if (parseFloat(cs.opacity) === 0) return 'opacity:0 @ .' + String(el.getAttribute('class') || el.tagName).slice(0, 30)
                el = el.parentElement; d++
              }
              return '无'
            } catch (e) { return 'ERR ' + e.message }
          })(),
          // 内容：contentEditable 的编辑器要读 textContent，textarea 读 value
          len: inp ? String(inp.value != null ? inp.value : inp.textContent || '').length : -1,
          tag: inp ? inp.tagName.toLowerCase() : null,
          editable: inp ? String(inp.contentEditable) : null,
        }
        /* ★★ 2026-09-20：**composer 为什么那么高**。
           实测：`composerH = 640`（视口才 1115）→ 对话框被顶到画面中间。
           而卡片自己只有 114px 高。所以那 158px 的差额**不在卡片里**，
           在这个子树里别的地方 —— 但只看卡片的 rect 看不出来。
           这里把 seat 之下的每一层都量一遍（tag/class/rect/display/padding/margin），
           一次定位"是哪个兄弟节点把高度撑起来的"。 */
        try {
          const seat = document.querySelector('[data-composer-seat]')
          const rows = []
          if (seat) {
            const walk = function (el, depth) {
              if (!el || depth > 5 || rows.length > 24) return
              const r = el.getBoundingClientRect()
              const cs = getComputedStyle(el)
              rows.push({
                d: depth,
                tag: el.tagName.toLowerCase(),
                cls: String(el.getAttribute('class') || '').slice(0, 34),
                rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
                display: cs.display,
                pos: cs.position,
                // 这几个是"把父级撑高"的常见嫌疑
                pad: cs.paddingTop + '/' + cs.paddingBottom,
                mar: cs.marginTop + '/' + cs.marginBottom,
                minH: cs.minHeight,
                flex: cs.flex,
              })
              for (let i = 0; i < el.children.length; i++) walk(el.children[i], depth + 1)
            }
            walk(seat, 0)
            // seat 自己也要看
            const sr = seat.getBoundingClientRect()
            const scs = getComputedStyle(seat)
            out.seatBox = {
              rect: [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)],
              padding: scs.paddingTop + '/' + scs.paddingBottom,
              margin: scs.marginTop + '/' + scs.marginBottom,
              position: scs.position, bottom: scs.bottom, flex: scs.flex,
            }
          /* ★ 2026-09-20：**seat 为什么没贴在底边**。
             实测：视口 1115，seat 停在 y=501（高 114）→ 下面空了 500px。
             seat 是 `position:sticky; bottom:0`，本该贴底。它没贴，
             要么是滚动体/父链的高度不对，要么是"被藏掉的消息槽位"还占着位置。
             把 seat **所有祖先**的高度列出来，一眼看得出是谁把它顶上去的。 */
          const up = []
          let pel = seat.parentElement
          let pd = 0
          while (pel && pd < 8) {
            const pr = pel.getBoundingClientRect()
            const pcs = getComputedStyle(pel)
            up.push({
              d: pd,
              tag: pel.tagName.toLowerCase(),
              cls: String(pel.getAttribute('class') || '').slice(0, 32),
              h: Math.round(pr.height),
              top: Math.round(pr.top),
              display: pcs.display,
              pos: pcs.position,
              flex: pcs.flex,
              justify: pcs.justifyContent,
              align: pcs.alignItems,
              overflow: pcs.overflow,
              // 关键：这个祖先下面还有没有"有高度的兄弟"
              sibs: (function () {
                const out2 = []
                const kids = pel.children
                for (let i = 0; i < kids.length; i++) {
                  if (kids[i] === seat) continue
                  const kr = kids[i].getBoundingClientRect()
                  if (kr.height > 0) out2.push(String(kids[i].getAttribute('class') || kids[i].tagName).slice(0, 24) + ':' + Math.round(kr.height))
                }
                return out2
              })(),
            })
            pel = pel.parentElement
            pd++
          }
          out.seatAncestors = up
          }
          out.subtree = rows
        } catch (e) { out.subtree = { error: String((e && e.message) || e) } }
        /* ★★★ 2026-09-20：**输入框点不动，到底是"谁"在吃这个点击**。
           用户报"无法输入、发消息的功能全用不了"。
           猜是没用的 —— 直接问浏览器这个坐标上最顶层的是哪个元素（`elementFromPoint`）。
           它返回的就是**真正会收到那一下点击**的节点。
           再顺带把皮肤可能挡路的三层（热区 / 正文层 / 覆盖层）各自的
           pointer-events 与 clip-path 打出来，一次看清是"没挖洞"还是"挖错了"。 */
        try {
          const inp = document.querySelector('[data-composer-input]')
          const r = inp ? inp.getBoundingClientRect() : null
          const probePt = function (x, y) {
            try {
              const el = document.elementFromPoint(x, y)
              if (!el) return null
              return {
                tag: el.tagName.toLowerCase(),
                cls: String(el.getAttribute('class') || '').slice(0, 40),
                id: el.id || '',
                composer: el.closest ? !!el.closest('[data-composer-card]') : false,
              }
            } catch (e) { return { error: String(e.message) } }
          }
          if (r && r.width > 0) {
            out.hitTest = {
              center: probePt(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)),
              left: probePt(Math.round(r.left + 30), Math.round(r.top + r.height / 2)),
              top: probePt(Math.round(r.left + r.width / 2), Math.round(r.top + 4)),
            }
          } else {
            out.hitTest = { error: '输入框 rect 无效' }
          }
          const layers = {}
          for (const sel of ['.myh-hotzone', '.myh-column', '.myh-over', '.myh-root', '#myh-skin-root']) {
            const el = document.querySelector(sel)
            if (!el) { layers[sel] = null; continue }
            const cs = getComputedStyle(el)
            const rr = el.getBoundingClientRect()
            layers[sel] = {
              pe: cs.pointerEvents, z: cs.zIndex, disp: cs.display,
              rect: [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)],
              clip: cs.clipPath === 'none' ? '-' : String(cs.clipPath).slice(0, 120),
              armed: el.getAttribute('data-armed'), guard: el.getAttribute('data-guard'),
              /* ★ 2026-09-20：**算出来的 inset 值**。
                 实测 `.myh-column` 高 122（= composerH+8）而它本该停在 993 ——
                 说明 `bottom:var(--myh-column-bottom,0px)` 落到了兜底 0px，
                 即那个变量**没写进去**（或写了但值为空）。
                 光看 rect 分不出"变量没写"和"写了但值是 0"，
                 所以把 top/bottom 的**计算值**和变量本身一起打出来。 */
              inset: (sel === '.myh-column')
                ? { top: cs.top, bottom: cs.bottom, v: String(cs.getPropertyValue('--myh-column-bottom')).trim() }
                : undefined,
            }
          }
          out.layers = layers
        } catch (e) { out.hitTest = { error: String((e && e.message) || e) } }
        /* ★★★ 2026-09-20：**占位文字与"可见文字"的真实颜色**。
           用户报"没有输入框"。前面已经证明：rect 有效、opacity/visibility 正常、
           没有 display:none 祖先 —— 所以它是**看得见形状但看不见字**。
           唯一能解释的就是颜色（深底深字 / 透明字）。
           DSH 的编辑器把原生字形设成透明、另开一层投影来画可见文字，
           所以这里两个都要量：占位层 与 投影层。 */
        /* ★★★ 2026-09-20：**CSS 变量到底有没有送达 composer**。
           病根：我们把 `--myh-composer-grad` 之类写在**皮肤根**（`#myh-skin-root`）上，
           但 composer 在 DSH 自己的 DOM 里、**不在皮肤根子树内** ——
           CSS 变量只沿 DOM 树继承，跨不到那儿。于是 `var(--myh-composer-grad)`
           解析成空 → `background` 无效 → 卡片没有底 → "看不见输入框"。
           这里在**卡片自己身上**读这些变量，直接看送达了没有。 */
        /* ★★★ 2026-09-20：**按真实像素取样**（最后一个盲区）。
           真机数据里卡片每一项都对：rect `56,1001,1820×114`、渐变正确、
           占位文字亮色。但用户截图里那一条是**空的**。
           "数据对但看不见"只剩两种可能：被盖住，或画到了别处。
           所以在卡片自己的**四个点**（上沿/中线/下沿/中点）问浏览器
           `elementFromPoint` —— 返回的就是那一点上真正被画出来、真正吃到点击的节点。
           再顺带回读它自己的若干计算样式，确认不是"点到了别的层"。 */
        /* ★★★ 2026-09-20：**"DOM 说对、像素说没有"的唯一解释**。
           真机探针报卡片 `56,1001,1820×114`、渐变 `rgb(89,164,181)`、
           `elementFromPoint` 四点全在卡片内；但用户截图里那段是**褐色地板色**，
           一点青蓝都没有。两个事实不可能同时为真 —— 除非
           **我量的 DOM 和用户看到的不是同一棵渲染树**。

           最可能的成因：皮肤根是 `position:fixed` 挂在 `document.body` 上，
           而 `position:fixed` 的**包含块**会被祖先的 `transform` / `filter` /
           `will-change` / `contain` 改掉（`docs/18` §3 就记过这个坑）。
           一旦 body 或 html 上有这类属性，皮肤会被"钉"在某个祖先盒子上、
           整体偏移或裁掉 —— 而 DOM 查询完全看不出来。

           所以这里把**可能改变包含块的那些属性**在 html/body/皮肤根上逐个量出来。 */
        /* ★★★ 2026-09-20：**把"卡片最终画成什么样"一次问全**。
           起因：用户截图逐像素量过，卡片该在的那一段是**地板色**（无青蓝）。
           而 DOM 侧一切正常。两边矛盾，只能说明"DOM 的样式"和"合成后的像素"之间
           还有一层我没量到。这里把 CSSOM 给出的**最终解析值**全列出来
           （不是作者写法，是浏览器算完的），包括 background 的完整身份。 */
        out.final = (function () {
          const c = document.querySelector('[data-composer-card]')
          if (!c) return { error: '无卡片' }
          const s = getComputedStyle(c)
          const r = c.getBoundingClientRect()
          const p = c.parentElement
          return {
            bg: String(s.backgroundImage).slice(0, 70),
            bgColor: s.backgroundColor,
            bgClip: s.backgroundClip,
            bgSize: s.backgroundSize,
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            z: s.zIndex, op: s.opacity, vis: s.visibility, disp: s.display,
            pos: s.position, overflow: s.overflow,
            // 父与祖父的层级：卡片是否被父的层叠上下文困住
            parentZ: p ? getComputedStyle(p).zIndex : null,
            parentPos: p ? getComputedStyle(p).position : null,
            grandZ: p && p.parentElement ? getComputedStyle(p.parentElement).zIndex : null,
            // 卡片自己是否形成层叠上下文 + 是否被祖先裁切
            selfStack: s.transform !== 'none' || s.filter !== 'none' || s.isolation === 'isolate'
              || (s.zIndex !== 'auto' && s.position !== 'static') ? 'YES' : '-',
            // ★ 决定性的一个数：**视口坐标**。若 > innerHeight 则整个在屏幕外
            belowViewport: Math.round(r.top) >= window.innerHeight,
            innerH: window.innerHeight, innerW: window.innerWidth,
          }
        })()
        out.containingBlock = (function () {
          const probe = function (label, el) {
            if (!el) return { label: label, missing: true }
            const cs = getComputedStyle(el)
            return {
              label: label,
              transform: cs.transform === 'none' ? '-' : String(cs.transform).slice(0, 40),
              filter: cs.filter === 'none' ? '-' : String(cs.filter).slice(0, 30),
              willChange: cs.willChange === 'auto' ? '-' : cs.willChange,
              contain: cs.contain === 'none' ? '-' : cs.contain,
              perspective: cs.perspective === 'none' ? '-' : cs.perspective,
              backdropFilter: cs.backdropFilter === 'none' ? '-' : String(cs.backdropFilter).slice(0, 24),
              position: cs.position,
              overflow: cs.overflow,
              // 这些是"改了包含块"的嫌疑属性
              risky: (cs.transform !== 'none' || cs.filter !== 'none' ||
                      (cs.willChange !== 'auto' && cs.willChange !== '') ||
                      cs.contain !== 'none' || cs.perspective !== 'none') ? 'YES' : '-',
            }
          }
          return [
            probe('html', document.documentElement),
            probe('body', document.body),
            probe('#myh-skin-root', document.getElementById('myh-skin-root')),
            probe('.myh-root', document.querySelector('.myh-root')),
            probe('.pI_x6G_frame', document.querySelector('[class*="frame"]')),
          ]
        })()
        out.pix = (function () {
          const card = document.querySelector('[data-composer-card]')
          if (!card) return { error: '无卡片' }
          const r = card.getBoundingClientRect()
          if (!r.width || !r.height) return { error: '卡片 rect 无效', rect: [r.left, r.top, r.width, r.height] }
          const at = function (x, y) {
            try {
              const el = document.elementFromPoint(Math.round(x), Math.round(y))
              if (!el) return null
              const cs = getComputedStyle(el)
              return {
                tag: el.tagName.toLowerCase(),
                cls: String(el.getAttribute('class') || '').slice(0, 34),
                inCard: el.closest ? !!el.closest('[data-composer-card]') : false,
                bg: cs.backgroundColor,
                bgImg: cs.backgroundImage === 'none' ? '-' : String(cs.backgroundImage).slice(0, 44),
                op: cs.opacity, vis: cs.visibility, z: cs.zIndex,
              }
            } catch (e) { return { error: String(e.message) } }
          }
          return {
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            mid: at(r.left + r.width / 2, r.top + r.height / 2),
            top: at(r.left + r.width / 2, r.top + 3),
            bottom: at(r.left + r.width / 2, r.top + r.height - 3),
            left: at(r.left + 3, r.top + r.height / 2),
          }
        })()
        out.vars = (function () {
          const card = document.querySelector('[data-composer-card]')
          if (!card) return { found: false }
          const cs = getComputedStyle(card)
          const names = ['--myh-composer-grad', '--myh-composer-glow',
            '--myh-cap-top', '--myh-cap-bot',
            '--myh-input-h', '--myh-mincho', '--myh-focus-text']
          const o = {}
          for (const n of names) {
            const v = String(cs.getPropertyValue(n)).trim()
            o[n] = v ? v.slice(0, 50) : '(空)'
          }
          o._bodyHasSkin = document.body.getAttribute('data-myh-skin') !== null
          return o
        })()
        out.plate = (function () {
          const pick = function (sel) {
            const e = document.querySelector(sel)
            if (!e) return { found: false }
            const cs = getComputedStyle(e)
            return {
              found: true,
              text: String(e.textContent || '').slice(0, 40),
              color: cs.color,
              fill: cs.webkitTextFillColor || '-',
              opacity: cs.opacity,
              fontSize: cs.fontSize,
              textShadow: cs.textShadow === 'none' ? '-' : String(cs.textShadow).slice(0, 60),
              rect: (function () { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })(),
            }
          }
          return {
            placeholder: pick('[data-composer-placeholder]'),
            // Shikitor 投影层（若在用）；没有就是 DSH 原生编辑器
            shikitor: pick('[data-composer-card] .shikitor-output-line'),
            anyShikitor: !!document.querySelector('[class*="shikitor"]'),
          }
        })()
        out.texts = {
          /* ★ 2026-09-21：`.myh-cur` 已删，改报正文流最后一条的文字（打字机的落点）。 */
          lastSay: (function () { const es = document.querySelectorAll('.myh-say'); const e = es.length ? es[es.length - 1] : null; return e ? String(e.textContent || '').slice(-60) : null })(),
          flowEmpty: (function () { const e = document.querySelector('.myh-flowEmpty'); return e ? e.textContent.slice(0, 40) : null })(),
          sayCount: document.querySelectorAll('.myh-say').length,
          msgCount: document.querySelectorAll('.myh-msg').length,
          /* ★★★ 2026-09-20：**皮肤到底收到了什么数据**。
             实测 `flowEmpty:"（这段会话还没有内容）"`、`sayCount:0` ——
             界面上一个气泡都没有。但"没有"有三种完全不同的原因：
               ① 传感器根本没跑到（槽位没注册/没被渲染）
               ② 传感器跑了但 ChatSnapshot 是空的（会话真的没消息）
               ③ 传感器拿到了消息，但 normalizeNode 全判成 null
             只看界面分不出来，所以把传感器内部的计数直接吐出来。
             `live` 是模块级的：传感器每轮都会写它，即使 store 没更新也能看到。 */
        }
        out.feed = {
          // 传感器最近一次读到的原始条数 / 归一化后的条数
          liveMessages: (function () { try { return (live.messages || []).length } catch (e) { return 'ERR' } })(),
          liveText: (function () { try { return String(live.text || '').slice(0, 80) } catch (e) { return 'ERR' } })(),
          liveSessionId: (function () { try { return live.sessionId || null } catch (e) { return 'ERR' } })(),
          // store 里现在是什么
          storeLine: (function () { try { return String(store.get().line || '').slice(0, 80) } catch (e) { return 'ERR' } })(),
          storeMsgs: (function () { try { return (store.get().messages || []).length } catch (e) { return 'ERR' } })(),
          storeAgent: (function () { try { return store.get().agent } catch (e) { return 'ERR' } })(),
          // 传感器槽位到底有没有被渲染出来（渲染了会打这个标记）
          sensorMounted: (function () {
            try { return !!document.querySelector('[data-myh-sensor]') } catch (e) { return 'ERR' }
          })(),
          /* 槽位到底给了哪些 hook、传感器读到了几条 —— 这两串是"数据链断在哪"的直接凭据 */
          sensorProps: (function () {
            try {
              const el = document.querySelector('[data-myh-sensor]')
              return el ? (el.getAttribute('data-sensor-props') || '(空)') : '(无标记)'
            } catch (e) { return 'ERR' }
          })(),
          sensorCounts: (function () {
            try {
              const el = document.querySelector('[data-myh-sensor]')
              return el ? (el.getAttribute('data-sensor-counts') || '(空)') : '(无标记)'
            } catch (e) { return 'ERR' }
          })(),
        }
      } catch (e) { out.card = { error: String((e && e.message) || e) } }
      return out
    }

    function measureShell() {
      const root = document.getElementById('myh-skin-root')
      if (!root) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      /* ★ docEl 在函数**最前面**声明 —— 它在下面被两处用到：
         ① 靠前的那段（把输入框左右缘写进 `--myh-cur-*`，必须在量热区之前）
         ② 靠后的那段（composer 要读的那批变量）
         写在中间会让 ① 落进"暂时性死区"（`Cannot access before initialization`）。 */
      const docEl = document.documentElement

      // 输入框：composer 外壳（研究报告 §1 的稳定钩子）
      // ★ 用 pickVisible：必须试到"矩形有效"为止，否则 composerH 会假性为 0
      const composerEl = pickVisible(
        ['[data-composer-seat]', '[data-composer-card]', '[data-composer-input]'])
      const cRect = rectOf(composerEl)
      const composerH = cRect ? Math.max(0, Math.round(vh - cRect.top)) : 0
      // 量没量到的判据：小到不像输入框就当没量到
      const composerOk = composerH > 24

      /* ★★★ 2026-09-20（用户定案）：**文本显示框与输入框对齐**。
         用户："让文本显示框与输入框对齐（也就是移动到同样靠边的位置）"，
         并确认要**同宽同位置**（当前文本框宽 1434px，输入框只有 782px）。

         ⚠ 难点：两者**在不同的坐标系里**。
           · 文本显示框 `.myh-cur` 在皮肤根（`position:fixed; inset:0`）里 → 百分比按**视口**算
           · 输入框卡片在「座」里 → `margin` 的 2.5% 按**座宽**算
           而**座本身在视口里是不对称的**（实测 1629 视口下：左留 56、右留 10，
           左边那 56px 是 DSH 侧栏留下的）—— 所以**不能照抄 2.5%**，
           照抄会得到"左 2.5% 但右 46%"这种两头都错的结果。

         ⇒ 正确做法（与"输入框方位"同一条思路）：**实测卡片的真实左右缘**，
           换算成视口百分比写进变量，读变量的元素跟着走。
           这样侧栏开合、窗口缩放、方位翻转都会自动跟上，不会漂。
         ⚠ 变量有**三个**读者，都是同一组左右缘的真源：
             · `.myh-cur`       —— 输入框上方那句当前台词
             · `.myh-columnInner` —— 会话正文（原来居中，用户要求与输入框对齐）
             · 热区洞（`hole`）—— 它量的是 `.myh-columnInner` 的**真实矩形**，
               所以必须**先写变量、再量矩形**，否则首次测量量到的是兜底（居中）位置。 */
      const cardEl = document.querySelector('[data-composer-card]')
      const kRect = cardEl ? cardEl.getBoundingClientRect() : null
      if (kRect && kRect.width > 0 && vw > 0) {
        /* ★★★ 2026-09-21（用户定案）：**百分比必须相对"列的内容区"算，不是视口**。
           用户："文字显示区的左右两侧要对齐输入框的左右两侧"。

           实测（1600 视口，列有 10px 滚动条）：左缘对得上（差 0），**右缘差 5px**。
           根因是**两套坐标系**：
             · 输入框卡片按**视口**定位（l=94.34 r=861.34）
             · 而 `.myh-columnInner` 的百分比是相对**列的内容区**解析的，
               列有滚动条 ⇒ 内容区 = 1590 而非视口 1600
           ⇒ 拿"视口宽"算出的百分比，套在"内容区宽"上，右边自然少 5px。

           正确做法：**按列内容区算**。这样无论滚动条在与不在、宽窄如何，
           内层盒子都会精确落在输入框卡片的左右缘上（实测对齐到 0.01px）。
           ⚠ 兜底仍用 vw：列还没量到时（首帧）宁可差半条滚动条，也不要算式报错。 */
        const colEl = document.querySelector('.myh-column')
        const colW = colEl && colEl.clientWidth > 0 ? colEl.clientWidth : vw
        const colL = colEl ? colEl.getBoundingClientRect().left : 0
        const kLeftPct = clamp(Math.max(0, kRect.left - colL) / colW * 100, 0, 100)
        const kRightInsetPct = clamp((colW - (kRect.right - colL)) / colW * 100, 0, 100)
        docEl.style.setProperty('--myh-cur-left', kLeftPct.toFixed(3) + '%')
        docEl.style.setProperty('--myh-cur-right', kRightInsetPct.toFixed(3) + '%')
        /* ★★★ 2026-09-23：变量写完才允许正文列显示（修"从中线漂移"）。
           在这句之前，`.myh-columnInner` 是 `visibility:hidden`（见 CSS 那段的
           `#myh-skin-root:not([data-myh-measured])` 规则），所以首帧那个**居中**
           的兜底位置不会被看见。挂上属性后列在**已对齐的最终位置**淡入 0.2s。
           ⚠ 这句必须在上面两句 setProperty **之后** —— 反了就会在错误位置上淡入，
             正是要修的那个 bug。 */
        root.setAttribute('data-myh-measured', '1')
        /* ★★★ 2026-09-20（用户定案）：**暗带加宽 —— 中心不动，两条边各往外扩**。
           用户："太窄了，宽一点" / "肯定是暗带" / "**别的我一点都不想改**" /
                 "保持同样的位置往两边扩" / "先按 5% 慢慢改，改一次我看一次"。

           ⇒ 只改暗带；文本层/台词层/输入框的量**一点都不碰**。
           ⇒ 锚点 = **当前盒子的中心**（= 输入框实测中心，因为暗带原本就与它同左缘同宽）。
             宽度加大后，左缘与右缘各自外移相同的量，中心保持不变。

           ★ 调宽度只改 `BAND_W_PCT` 一个数。
             历史：48% → 53% → 63% → 73% → **本次 78%**（用户逐步："再扩10%"×2、"再扩5%"）。
           ⚠ 不是"居中于视口"：中心取自**输入框实测中心**。
             文本靠右时（金鹿白天，输入框在右侧 49%~97%），
             中心也随之在右边 —— 暗带始终裹着文本，不会跑到屏幕正中。 */
        const BAND_W_PCT = 78
        const bandWPct = Math.max(10, Math.min(100, BAND_W_PCT))
        /* ★★★ 2026-09-21：**暗带要用它自己的包含块基准**，不能复用上面那组百分比。
           实测两层的 `offsetParent` 不同：
             · `.myh-columnInner` 的包含块 = `.myh-column`（**clientWidth 1590**，有滚动条）
             · `.myh-band`        的包含块 = `.myh-under`  （**clientWidth 1600**，无滚动条）
           所以同一组百分比套到暗带上会整体右移约半个滚动条（实测中心差 3px）。
           这里按"视口宽"重算一组，专供暗带使用 —— 它的包含块恰是整幅画面。
           ⚠ 两个基准都要留注释，否则下一个人会把它们合并成一组（会漂 3px）。 */
        const bandCenterPct = ((kRect.left + kRect.right) / 2) / vw * 100
        const bandLeftPct = bandCenterPct - bandWPct / 2
        docEl.style.setProperty('--myh-band-w', bandWPct.toFixed(3) + '%')
        docEl.style.setProperty('--myh-band-l', bandLeftPct.toFixed(3) + '%')
      }

      /* ★★★ 2026-09-20：正文矩形的口径换了 —— **量皮肤自己的正文，不量 DSH 的**。
         老写法量 `[data-conversation-scroll]`，但那层已经被皮肤接管，
         实测量出 `l=56, r=1910`（几乎满宽）→ 左右热区被压成 2px → 菜单没地方点。

         现在直接量皮肤自己的 `.myh-columnInner`**的真实矩形**。
         ★ 这一点很重要：正文层后来从"居中 1100px"改成了"与输入框对齐"，
           但**这段逻辑一行都不用改** —— 它量的是元素的实际位置，
           正文移到哪，洞就跟到哪，永远不会漂。这就是"量真实几何"胜过"复算 CSS 式子"。
         量不到时才退回一件式子在 JS 里重算（保持与 CSS 一致的居中式）。 */
      const innerEl = document.querySelector('.myh-columnInner')
      const iRect = rectOf(innerEl)
      let hole
      if (iRect && iRect.width > 120) {
        hole = {
          l: Math.max(0, Math.round(iRect.left)),
          t: 0,
          r: Math.min(vw, Math.round(iRect.right)),
          b: Math.max(120, vh - composerH),
        }
      } else {
        // 兜底：与 `.myh-columnInner` 的居中式子同口径（文本层对齐后一般轮不到这里）
        const cw = Math.min(1100, Math.round(vw * 0.76))
        const cl = Math.round((vw - cw) / 2)
        hole = { l: cl, t: 0, r: cl + cw, b: Math.max(120, vh - composerH) }
      }

      /* 保底（红线 13：退化方向必须是"热区更小"）：
         左右空白条至少要各留 60px，否则菜单就没地方点了。
         留不出来时**收窄正文矩形**（而不是放大热区）——
         宁可"正文两侧也点得出菜单"，也不要"整屏都是热区"。
         ⚠ 老代码这里是 `hole = {0,0,0,0}`，即"洞变成零面积"——
           在挖洞模型下那等于**整屏实心热区**，正是吃掉输入框的那个故障。
           新模型下洞和热区是两块独立的矩形，所以这个兜底也要跟着改语义。 */
      const MIN_STRIP = 60
      if (hole.l < MIN_STRIP || (vw - hole.r) < MIN_STRIP) {
        const cw = Math.max(120, vw - MIN_STRIP * 2)
        const cl = Math.round((vw - cw) / 2)
        hole = { l: cl, t: 0, r: cl + cw, b: Math.max(120, vh - composerH) }
      }
      /* 输入框上沿。
         ★ 2026-09-20 修：量不到输入框时**不能把正文层压成 0 高**。
         老代码：`composerOk ? composerTop : 0` —— 一旦没量到，
         `.myh-column{bottom:0}` 就让正文层铺到屏幕底、被输入框盖住；
         而上一轮实测里 `.myh-column` 只有 114px 高，就是这么来的。
         现在量不到时给一个**保守的兜底高度**（按 DSH composer 的典型值 152px），
         让正文层停在输入框上方，而不是铺到底。 */
      const FALLBACK_COMPOSER_H = 152
      const composerTop = composerOk
        ? Math.max(0, Math.min(vh, Math.round(vh - composerH)))
        : Math.max(0, vh - FALLBACK_COMPOSER_H)
      const columnBottom = composerTop

      root.style.setProperty('--myh-composer-h', composerH + 'px')
      root.style.setProperty('--myh-composer-top', composerTop + 'px')
      root.style.setProperty('--myh-column-bottom', columnBottom + 'px')
      root.style.setProperty('--myh-hole-l', hole.l + 'px')
      root.style.setProperty('--myh-hole-t', hole.t + 'px')
      root.style.setProperty('--myh-hole-r', hole.r + 'px')
      root.style.setProperty('--myh-hole-b', hole.b + 'px')

      /* ★ 2026-09-20：输入框的三档色阶 + 高度 + 端帽（`docs/04` §2.2 / §2.3）。
         色值直接取 `sel_win` 实测的那三档，**不自创色**（`docs/04` §5 待定项 5：
         要第四档得另找原作色值，不许自己配）。
         写在这台皮肤根上、由 CSS 变量带进 DSH 的 composer —— 因为那段 DOM 不归皮肤管。 */
      const cs = composerState()
      const tone = cs.waiting ? 'pale' : 'mid'
      /* ★★★ 2026-09-20：三档色值**逐像素实测**自 `sel_win.cbg.png`（见 1h 段长注释）。
         每一项都是量出来的，不是配的：
             深档 填充 rgb(18,29,36)   顶 rgb(43,111,115)   底 rgb(32,83,99)
             中档 填充 rgb(26,100,131) 顶 rgb(61,250,252)   底 rgb(42,165,244)
             浅档 填充 rgb(59,147,168) 顶 rgb(176,247,248)  底 rgb(74,223,253)
         主体 alpha 216/255 ≈ 85% —— **原作本来就是半透明**，这条是照搬的。 */
      const A = .85
      const TONE = {
        deep: { fill: '18,29,36', top: 'rgba(43,111,115,.95)', bot: 'rgba(32,83,99,.95)', cap: null },
        mid: { fill: '26,100,131', top: 'rgba(61,250,252,.95)', bot: 'rgba(42,165,244,.95)', cap: 'rgba(55,215,250,.95)' },
        pale: { fill: '59,147,168', top: 'rgba(176,247,248,.95)', bot: 'rgba(74,223,253,.95)', cap: 'rgba(86,242,251,.95)' },
      }
      const t = TONE[tone] || TONE.mid
      /* ★★★ 2026-09-20：这几条**必须写在 `document.documentElement` 上**，不能写皮肤根。
         理由见 CSS 顶部 `:root` 那段长注释：CSS 变量只沿 DOM 树继承，
         composer 不在皮肤根的子树里，写在皮肤根上它读不到 →
         `background:var(--myh-composer-grad)` 整条作废 → 卡片没有底 →
         **用户看到的就是"没有输入框"**。
         以下是 composer 要读的全部变量，所以走 docEl
         （`docEl` 已在函数开头声明，这里直接用）。 */
      docEl.style.setProperty('--myh-input-h', cs.h + 'px')
      docEl.style.setProperty('--myh-composer-grad',
        'linear-gradient(180deg,rgba(' + t.fill + ',' + A + ') 0%,rgba(' + t.fill + ',' + A + ') 100%)')
      docEl.style.setProperty('--myh-cap-top', t.top)
      docEl.style.setProperty('--myh-cap-bot', t.bot)
      docEl.style.setProperty('--myh-composer-glow', t.bot)
      /* ★ 2026-09-20（用户定案）：三处端帽花纹已全部删除，这里不再写
         `--myh-composer-cap` / `--myh-composer-cap-r` 两个变量。
         素材文件 `assets/ui/cap_scroll.png`（原方向）与 `cap_scroll_r.png`（镜像）
         **留在盘上不删** —— 用户可能反悔要加回来，重挂只需恢复上面两段 CSS。
         但它们已不被任何 CSS 引用，因此不会再有网络请求。 */
      root.setAttribute('data-myh-input-tone', tone)
      /* 输入框的**方位**（靠左/靠右）不在这里写 —— 它跟的是"当前景"，
         而本函数只在挂载时跑一次。方位由 `scene` 的 effect 负责
         （见 `store.set({scene…})` 下面那个 effect）。 */

      const prev = svc.layout || {}
      // ★ composerOk / columnBottom 一定要进诊断：正文层是"没显示"还是"显示了"
      //    完全由这两个值决定 —— 上一轮就是 composerH=0 把正文压成 0 高，
      //    而探针里看不到这个数，只能靠猜。
      const next = { composerH: composerH, composerOk: composerOk,
                     composerTop: composerTop, columnBottom: columnBottom,
                     holeL: hole.l, holeT: hole.t, holeR: hole.r, holeB: hole.b }
      /* ★★★ 2026-09-23：这里原本是「if (变了) { svc.layout = next }」**紧接着**
         「svc.layout = next」—— 分支体和后面那句做的是同一件事，所以那个 if
         连同 4 个 `!==` 比较是**零效果**的，每次调用都白分配一个对象
         （启动时 measureShell 会跑 4 次）。
         现在让缓存真正生效：几何没变就**复用旧对象**并提前返回。
         安全前提（已核实）：`svc.layout` 只被诊断读取（见 6405-6415 的 health
         上报），没有任何订阅者依赖"对象引用变化"来触发重渲染 —— 它是普通对象，
         不是 store。 */
      const same = prev.composerH === composerH && prev.composerOk === composerOk &&
                   prev.composerTop === composerTop && prev.columnBottom === columnBottom &&
                   prev.holeL === hole.l && prev.holeT === hole.t &&
                   prev.holeR === hole.r && prev.holeB === hole.b
      if (same) return prev
      svc.layout = next
      return next
    }

    /** 菜单当前焦点项（模块级，供 Enter 与鼠标共享）。 */
    let menuFocus = 'new'
    const menuFocusListeners = new Set()
    function setMenuFocus(id) {
      if (menuFocus === id) return
      /* ★★★ 2026-09-22（用户第 2 条）：**移动到新项就发声**。
         原来只有方向键分支调 playSfx(move)，鼠标悬停移焦点**一点声音都没有**。
         挂在这里而不是 onMouseEnter 上，是因为键盘 Tab / 方向键也走这条 ——
         上一行 `if (menuFocus === id) return` 天然去重，**只在真的换项时响一次**，
         不会出现"悬停响一次、方向键又响一次"的双声。 */
      playSfx('move')
      menuFocus = id
      menuFocusListeners.forEach(function (l) { try { l(id) } catch (_e) { /* 隔离 */ } })
    }
    function useMenuFocus() {
      const [v, setV] = useState(menuFocus)
      useEffect(function () {
        menuFocusListeners.add(setV)
        return function () { menuFocusListeners.delete(setV) }
      }, [])
      return [v, setMenuFocus]
    }

    /**
     * 左键 / Esc 的"逐层退回"（用户 2026-09-21 定案）：
     *   会话列表子菜单 -> 回主列表；主列表 -> 关闭菜单回阅读态。
     * 与"确认进入"（右键 / Enter）严格分开 —— 左键永远不确认任何东西。
     */
    function handleMenuBack() {
      playSfx('cancel')
      const s = store.get()
      /* L1（起始页）：工作区列表是 L1 的子层，逐层退回同样适用。
         ⚠ 这段一开始漏了 —— TitlePage 的菜单项根本没传 onBack，
         于是 L1 上左键只移焦点、什么都不发生，与 L2 的规则不一致。 */
      /* ★★★ 2026-09-22（用户第 1 条）：**设置页也在这条链上**。
         原来这里只判 `page === 'title'`，于是左键在设置页会掉进下面的
         `if (s.menuMode === 'list')` 分支 —— 什么都不发生（用户：「设置界面自成一派」）。
         现在：设置页 → L1；L1 工作区列表 → L1 主列表；L1 主列表 → 关掉回阅读态。 */
      if (s.page === 'config') {
        store.set({ page: 'title', titleMode: 'menu', menu: false })
        return
      }
      if (s.page === 'title') {
        if (s.titleMode === 'workspaces') { store.set({ titleMode: 'menu' }); return }
        store.set({ page: null, menu: false, titleMode: 'menu' })
        return
      }
      if (s.menuMode === 'list') { store.set({ menuMode: 'main' }); return }
      store.set({ menu: false, menuMode: 'main' })
    }

    /**
     * 菜单项动作（模块级，供菜单点击与键盘 Enter 共用）。
     * 左键点菜单项**不确认**，只移焦点；Enter / 右键才走这里（docs/08 §1.2 / 09 A13）。
     */
    function handleMenu(id, val) {
      unlockAudio()
      const s = store.get()
      // L2：会话行 —— 打开那一段对话
      if (id.indexOf('sess:') === 0) {
        playSfx('book')
        doOpenSession(id.slice(5))
        store.set({ page: null, menu: false })
        return
      }
      // L1：进入某个工作区
      if (id.indexOf('ws:') === 0) {
        playSfx('book')
        doOpenWorkspace(id.slice(3))
        return
      }
      /* ★★★ 2026-09-22（用户第 6 条）：**设置页的项**（右键 / Enter 触发的"操作"）。
         与 L1/L2 同一套语义：左键逐层退回由 handleMenuBack 管，这里只管"确认操作"。
         ⚠ 退回**不在**这张表里：原著这一屏靠左键 / Esc 退，页面上没有「返回」按钮
           （`c:back` 已随五页签重做删除，末位换成 `c:dflt`）。
         ★★★ 2026-09-22 第二个参数 `val`：设置页的 OFF/ON 是一对**单选按钮**，
           所以布尔项必须**按传入的值设**，不能一律翻转 —— 否则右键点「OFF」
           会把本来就 OFF 的值翻成 ON（视觉是单选、行为是开关）。
           `val === undefined` 时（方向键 Enter 走的是 `handleMenu(menuFocus)`）
           退回"翻转"语义，这样键盘与鼠标两种入口都成立。 */
      /* ★ 2026-09-22：分类页签（t:sound / t:voice / …）—— 右键 / Enter 切页。 */
      if (id.indexOf('t:') === 0) {
        playSfx('menu')
        store.set({ confTab: id.slice(2) })
        return
      }
      if (id.indexOf('c:') === 0) {
        const st = store.get()
        const cur = (st.settings && st.settings.character) || 'aoko'
        const idx = CHARACTERS.indexOf(cur)
        /* 2026-09-22（用户第 2 条）：**复合 id 拆成「基 id + 选项值」**。
           焦点表现在给的是 `c:bgm#on` 这种；val 从 id 里取，与鼠标右键传进来的
           那个 val 合流 —— 于是「右键点 OFF」与「键盘在 OFF 上回车」走同一条路。 */
        const sp = splitOpt(id)
        const v = sp.val != null ? sp.val : val
        if (sp.val != null) id = sp.base
        switch (id) {
          case 'c:character': {
            playSfx('decide')
            /* 2026-09-22：给了具体角色就直接选中；没给（键盘停在行上回车）才切下一个。 */
            const nxt = (v != null && CHARACTERS.indexOf(v) >= 0)
              ? v : CHARACTERS[(idx + 1) % CHARACTERS.length]
            applySettings({ character: nxt })
            return
          }
          case 'c:persona': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.persona)
            applySettings({ persona: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:enabled': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.enabled)
            applySettings({ enabled: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:sprite': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.showSprite)
            applySettings({ showSprite: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:dialogue': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.showDialogue)
            applySettings({ showDialogue: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:tabs': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.hideTabs)
            applySettings({ hideTabs: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:collapse': {
            playSfx('decide')
            const c0 = !(st.settings && st.settings.autoCollapse === false)
            applySettings({ autoCollapse: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:bgm': {
            playSfx('decide')
            /* 2026-09-22：**这处漏改过** —— 其它布尔项早就改成按值设，只有它还翻转。
               于是右键点 OFF 会把它翻成 ON。 */
            const c0 = !!(st.settings && st.settings.bgm)
            applySettings({ bgm: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:vol': {
            playSfx('move')
            /* ★ 2026-09-23（五档版）：`v` 是复合 id 里的**档位序号**（'c:vol#2' → '2'）——
               直接写那一档的真值。不带值时（右键点行 / 键盘停在行上回车）
               先在五档里**就近取当前档**，再往后走一档、到顶回卷。 */
            const STEP5 = [0, 0.25, 0.5, 0.75, 1]
            const idx = v != null ? parseInt(v, 10) : -1
            if (idx >= 0 && idx < STEP5.length) { applySettings({ bgmVolume: STEP5[idx] }); return }
            const curV = (st.settings && st.settings.bgmVolume == null) ? 0.35 : (st.settings.bgmVolume || 0)
            /* ⚠ 分两行声明 —— 同 `nearest()` 里那条注释：逗号多声明会被
               `lint-identifiers.mjs` 误报成裸标识符（实测 `? nd ×3`）。 */
            let ni = 0
            let nd = 9
            for (let i = 0; i < STEP5.length; i++) {
              const d = Math.abs(STEP5[i] - curV)
              if (d < nd) { nd = d; ni = i }
            }
            applySettings({ bgmVolume: STEP5[(ni + 1) % STEP5.length] })
            return
          }
          case 'c:sfx': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.sfx)
            applySettings({ sfx: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:egg': {
            playSfx('decide')
            const c0 = !!(st.settings && st.settings.easterEgg)
            applySettings({ easterEgg: (v == null ? !c0 : (v === 'on' || v === true)) })
            return
          }
          case 'c:dflt': {
            playSfx('decide')
            /* 「恢复初始设置」= 写回与 skin/lib/index.js 的 DEFAULTS 对齐的那一套值。
               ⚠ `applySettings` 在 patch.character 存在时会**同时**写 store.character，
                 所以角色也会跟着回出厂值（青子）—— 这是预期行为，不是副作用。 */
            applySettings(Object.assign({}, CONF_DFLT))
            return
          }
          default: playSfx('cancel'); return
        }
      }
      switch (id) {
        // --- L2 ---
        case 'new': playSfx('decide'); doNewSession(); store.set({ page: null, menu: false }); return
        // 会话列表子菜单（本项目延伸，原作无此层）
        case 'list': playSfx('book'); store.set({ menuMode: 'list' }); return
        case 'listback': playSfx('cancel'); store.set({ menuMode: 'main' }); return
        // 返回 = 回 L1（用户定案）
        case 'back':
          if (s.page === 'title') {
            if (s.titleMode === 'workspaces') { playSfx('cancel'); store.set({ titleMode: 'menu' }); return }
            playSfx('cancel'); store.set({ page: null, menu: false }); return
          }
          playSfx('decide'); store.set({ page: 'title', menu: false, titleMode: 'menu' }); return
        // --- L1 ---
        case 'setskin': playSfx('decide'); store.set({ page: 'config', menu: false }); return
        case 'newws': playSfx('decide'); doNewWorkspace(); return
        case 'openws': playSfx('decide'); store.set({ titleMode: 'workspaces' }); return
        default: playSfx('cancel'); store.set({ menu: false, page: null }); return
      }
    }

    /**
     * ⚠ `KillSwitch` 组件**已废弃**（保留此说明，不要再复活它）。
     *
     * 原设计：把 Ctrl+Shift+M 做成一个渲染 null 的组件注册进 `shell.overlay`，
     * 以便"皮肤根崩了它还在"。
     *
     * 实测失败原因：整个 `shell.overlay` 槽被 DSH 的 `SlotErrorBoundary` 接管后
     * 永久变成崩溃占位 —— **逃生门和被救的对象一起死了**，这正好是它最不该失效的场合。
     *
     * 现在由 {@link installKillHotkey} 在 apply() 里直接挂 window 监听，
     * 与 React、与插槽系统完全解耦。
     */

    function useSkin() {
      return useSyncExternalStore(store.subscribe, store.get, store.get)
    }

    // ===========================================================================
    // 诊断设施 ①：模块实例号
    // ---------------------------------------------------------------------------
    // 为什么需要：所有"皮肤只画了半截 / 完全不画"的现象里，最难排除的一种是
    // **同一个页面里跑着两份皮肤代码**（旧的 bundle 实例没被清掉，新的又挂了一个）。
    // 那种情况下 DOM 上会出现两个 #myh-skin-root，一个转一个不转，
    // 而"我自己"永远只能看到其中一份 —— 靠猜是猜不出来的。
    // 每个模块实例拿到一个短随机号，写进 DOM 属性、写进每次上报。
    // ===========================================================================
    const INSTANCE_ID = (function () {
      try {
        return Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4)
      } catch { return 'x' + (Date.now() % 100000) }
    })()

    // ===========================================================================
    // 诊断设施 ②：hooks 次数三脚架（React error #310 的现场取证）
    // ---------------------------------------------------------------------------
    // React 在**已经开始渲染**之后发现 hook 数比上次多时，会抛 error #310：
    //   "Rendered more hooks than during the previous render."
    // 这个错误在浏览器里只有一个 error code，componentStack 也只指到某个 useState。
    // 但 React 内部把"这次渲染数到第几个 hook"记在 dispatcher 的 H 计数器上，
    // 而这个计数器**在抛错之前是能读到的**。
    // 于是：把每个 hook 包一层，每次调用后采一次 H；H 变小 → 新一轮渲染开始，
    // 把上一轮的最终值记档。这样即使皮肤崩了，宿主里也留着
    // "第 N 帧数到 X 个 hook，第 N+1 帧数到 Y 个"的原始证据。
    // ===========================================================================
    const hookFrames = []
    let lastHookSnapshot = null
    let hookPrevH = -1
    let hookFrameCount = 0

    function readHookCount() {
      try {
        const g = typeof globalThis !== 'undefined' ? globalThis : null
        if (!g) return null
        const I = g.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        if (!I || !I.H) return null
        const n = I.H
        return (typeof n === 'number' && n >= 0 && n < 10000) ? n : null
      } catch { return null }
    }

    /**
     * 自描述：把"为什么读不到 hook 计数"讲清楚。
     *
     * ★ 教训：我第一版直接假设 React 内部字段叫 `H`。采不到值时，
     *   `hookFrames` 就是空数组，而空数组**无法区分**这几种情况：
     *   ① 字段名不对 ② 内部对象整体不存在（不是 dev 构建）③ 真的没跑渲染。
     *   靠"空数组"去推断，等于又回到猜。所以这里把每一个环节都摊开上报：
     *   内部对象在不在、顶层键有哪些、候选字段各是什么类型、它的子键有哪些。
     */
    function internalsShape() {
      const out = { key: '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE', present: false }
      try {
        const g = typeof globalThis !== 'undefined' ? globalThis : null
        if (!g) { out.why = 'no globalThis'; return out }
        const I = g.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        out.present = !!I
        if (!I) {
          // 换几个历史上出现过的名字再找一遍（React 改过这个全局的名字）
          const alt = ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED']
          out.alt = {}
          for (let i = 0; i < alt.length; i++) {
            try { out.alt[alt[i]] = !!g[alt[i]] } catch { out.alt[alt[i]] = 'err' }
          }
          return out
        }
        out.topKeys = Object.keys(I).slice(0, 24)
        out.Htype = typeof I.H
        out.Hvalue = (typeof I.H === 'number') ? I.H : null
        out.wrapped = !!I.__myhWrapped
        // H 如果是对象（dispatcher），列出它的方法名 —— 字段名可能整体变了
        try {
          if (I.H && typeof I.H === 'object') out.Hkeys = Object.keys(I.H).slice(0, 30)
        } catch { /* ignore */ }
        for (let i = 0; i < out.topKeys.length; i++) {
          const k = out.topKeys[i]
          if (out.Hkeys) break
          out['t_' + k] = typeof I[k]
        }
      } catch (e) { out.err = String((e && e.message) || e) }
      return out
    }

    /** 采样一次 hook 计数；H 回落说明进了新一轮渲染，把上一帧记档。 */
    function sampleHookTripwire() {
      const n = readHookCount()
      if (n === null) return
      if (n < hookPrevH) {
        hookFrameCount++
        hookFrames.push({ f: hookFrameCount, hooks: hookPrevH })
        if (hookFrames.length > 40) hookFrames.shift()
      }
      hookPrevH = n
      lastHookSnapshot = n
    }

    /** 把 hooks 次数不一致这件事变成一条可读的宿主机诊断。 */
    function installHookTripwire() {
      try {
        const g = typeof globalThis !== 'undefined' ? globalThis : null
        if (!g) return false
        const I = g.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        if (!I || !I.H || I.__myhWrapped) return false
        const names = Object.keys(I.H)
        for (let i = 0; i < names.length; i++) {
          const name = names[i]
          const fn = I.H[name]
          if (typeof fn !== 'function') continue
          I.H[name] = (function (orig, nm) {
            return function () {
              let out
              try { out = orig.apply(this, arguments) } finally { sampleHookTripwire(); void nm }
              return out
            }
          })(fn, name)
        }
        I.__myhWrapped = true
        return names.length > 0
      } catch { return false }
    }

    /** 从帧记录里判断"是否存在两帧 hook 数不同" —— 这就是 #310 的充分条件。 */
    function hookMismatch() {
      const seen = {}
      for (let i = 0; i < hookFrames.length; i++) seen[hookFrames[i].hooks] = (seen[hookFrames[i].hooks] || 0) + 1
      const keys = Object.keys(seen)
      if (keys.length < 2) return null
      return { counts: keys.map(Number).sort(function (a, b) { return a - b }), detail: seen }
    }

    /**
     * 错误边界：皮肤根渲染抛错时**只让这一块变空**，DSH 其余界面照常。
     *
     * ★ 现在这个边界是**唯一**的兜底 —— 因为皮肤根已经不走 DSH 的插槽了，
     *   没有第二个边界会来接管。所以这里的 `componentDidCatch` 必须
     *   ①把错误报到宿主 ②在界面上留下看得见的痕迹 ③顺手停用皮肤。
     */
    class SkinErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false, message: '' }
      }
      static getDerivedStateFromError(error) {
        return { failed: true, message: String((error && error.message) || error).slice(0, 300) }
      }
      componentDidCatch(error, info) {
        const detail = String((error && error.stack) || (error && error.message) || error)
          + '\n--- componentStack ---\n'
          + String((info && info.componentStack) || '')
        try { console.error('[moye-skin] 皮肤渲染异常：', error, info) } catch { /* ignore */ }
        // 采一次现场：hooks 帧记录 + 实例号 —— 有这两样，"是代码错还是热更残留"一眼可判
        try { sampleHookTripwire() } catch { /* ignore */ }
        let frames = null
        let mismatch = null
        try { frames = hookFrames.slice(-10); mismatch = hookMismatch() } catch { /* ignore */ }
        try {
          reportToHost({
            stage: 'render-failed',
            errors: [detail.slice(0, 1200)],
            autoProbe: {
              instance: (function () { try { return INSTANCE_ID } catch { return null } })(),
              hookFrames: frames,
              hookMismatch: mismatch,
              message: this.state.message,
              rootCount: (function () {
                try { return document.querySelectorAll('[id="myh-skin-root"]').length } catch { return -1 }
              })(),
              fnBytes: (function () { try { return String(SkinRoot).length } catch { return -1 } })(),
            },
          })
        } catch { /* 报不到也要继续 */ }
        // 界面上留一个看得见的失败提示（而不是静默什么都不发生）
        try {
          const el = document.createElement('div')
          el.setAttribute('style', [
            'position:fixed', 'left:14px', 'bottom:14px', 'z-index:1200',
            'max-width:520px', 'padding:10px 12px', 'border-radius:6px',
            'background:rgba(26,13,13,.97)', 'border:1px solid #7a2b2b', 'color:#FFD9D9',
            'font:12px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif', 'white-space:pre-wrap',
          ].join(';'))
          el.id = 'myh-crash-banner'
          el.textContent = '「魔法使之夜」皮肤渲染失败，正在尝试自动重挂...\n（若 3 秒后仍是这样，按 Ctrl+Shift+M 可关掉皮肤）\n' + this.state.message
          document.body.appendChild(el)
        } catch { /* ignore */ }
        // ★★ 自愈：整套扔掉、重新 createRoot 再挂一次。
        //   为什么值得做：React #310 这类错误一旦发生，**这一棵 React 树就废了**
        //   （后续每次渲染都会继续报）。而它最常见的成因是"热更/重载残留了旧 hook 表"——
        //   那种情况下**换一棵全新的树就能恢复**，用户不用刷新页面。
        //   重挂只做一次，失败就维持横幅（不再无限循环刷屏）。
        try {
          if (!svc.remounted) {
            svc.remounted = true
            setTimeout(function () {
              try {
                const oldRoot = skinReactRoot
                skinReactRoot = null
                if (oldRoot) { try { oldRoot.unmount() } catch { /* ignore */ } }
                const oldEl = document.getElementById('myh-skin-root')
                if (oldEl) oldEl.remove()
                const banner = document.getElementById('myh-crash-banner')
                if (banner) banner.remove()
                mountSkinRoot()
              } catch (e2) {
                try { reportToHost({ stage: 'remount-failed', errors: [String(e2 && e2.message || e2)] }) } catch { /* ignore */ }
              }
            }, 400)
          }
        } catch { /* ignore */ }
      }
      render() {
        if (this.state.failed || killed || KILLED_AT_LOAD) return null
        return this.props.children
      }
    }

    /** 内置默认设置 —— 设置还没从宿主回来时的兜底，保证界面能先画出来。 */
    function ui_defaultSettings() {
      return {
        character: 'aoko', enabled: true, showSprite: true, showDialogue: true,
        hideTabs: true, autoCollapse: true, bgm: false, bgmVolume: 0.35,
        sfx: false, sfxVolume: 0.5, persona: true, easterEgg: true,
        edThreshold: 0.78, assetRoot: '',
      }
    }

    function SkinRoot() {
      const st = useSkin()
      const m = manifestBox.m

      // ★★ 2026-09-17 修正：守卫原来是硬拒绝（`!st.settings` 就直接不渲染），
      //    结果"设置还没回来"这一个瞬时状态会把整个皮肤永久按死。
      //    正确做法：**设置缺失时用内置默认值兜底** —— 皮肤照画，
      //    等设置回来再按真实值走。于是这里只保留一条真正的开关（enabled=false）。
      const stSafe = (function () {
        if (st.settings) return st
        const fallback = settingsBox.s || ui_defaultSettings()
        return Object.assign({}, st, { settings: fallback })
      })()

      // 渲染守卫：只列**真正该阻止渲染**的情况，并把原因变成可读字符串
      const blocked = (function () {
        if (killed) return 'killed=true（紧急开关已就地关闭皮肤）'
        if (KILLED_AT_LOAD) return 'KILLED_AT_LOAD=true（localStorage 有关闭标记）'
        if (stSafe.settings && stSafe.settings.enabled === false) return 'settings.enabled=false（设置里皮肤被关）'
        return null
      })()
      if (blocked) {
        if (svc.blockReason !== blocked) {
          svc.blockReason = blocked
          // ★ 立刻上报（不等 2.8s 的自检）。这就是"界面没反应"的直接原因。
          try {
            reportToHost({
              stage: 'render-blocked',
              build: BUILD_ID,
              blocked: blocked,
              autoProbe: {
                blocked: blocked,
                killed: killed,
                killedAtLoad: KILLED_AT_LOAD,
                hasManifest: !!manifestBox.m,
                hasSettings: !!store.get().settings,
                settingsEnabled: !!(store.get().settings && store.get().settings.enabled),
                settingsKeys: store.get().settings ? Object.keys(store.get().settings).join(',') : null,
                storeReady: store.get().ready,
              },
            })
          } catch { /* ignore */ }
        }
      } else if (svc.blockReason) { svc.blockReason = null }

      // ---- 深浅色跟随（组织轴 = DSH 主题，docs/09 B1） ----
      useEffect(function () {
        const on = function () { store.set({ dark: isDarkBody() }) }
        on()
        const mo = new MutationObserver(on)
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        mq.addEventListener('change', on)
        return function () { mo.disconnect(); mq.removeEventListener('change', on) }
      }, [])

      // ---- 景（角色 × 明暗；整屏页用壳景） ----
      /* ★★★ 2026-09-23：**整屏页是否打开**。声明必须排在下面 `scene` 之前 ——
         那个 useMemo 的依赖数组 `[... , pageOpen]` 是**当场求值**的，
         而 `const` 有暂时性死区（TDZ）。放在原处（约 5911 行）会直接
         `ReferenceError: Cannot access 'pageOpen' before initialization` ——
         实测被 `render-selftest.mjs` 抓住过。 */
      const pageOpen = !!(st.page && !st.ed)
      const scene = useMemo(function () {
        /* ★ 2026-09-22（用户第 5 条）：表紙也要**按角色**取壳景 ——
           原来这里走的是写死的 `SHELL_SCENE`，所以换角色时 L1 背景不动。

           ★★★ 2026-09-23：判据从 `isTitlePage` 放宽到 **`pageOpen`（任何整屏页）**。
           修的是用户报的「从起始页切到皮肤设置时闪一下」。

           病根：整屏页（L1 / 设置页）是 `.myh-over`(z8) 里的 `inset:0` 全覆盖层，
           它**自带一张背景图**（`myh-pageBg`，就是 L1 那张壳景）。而根层 `.myh-bg`
           在 L1 时取**壳景** B3/B4、一进设置页 `isTitlePage` 变 false 就切到
           **阅读景** A3/A4 —— 于是那次点击同时触发两个动画：
             · 根层背景 B→A，跑 0.6s 淡入
             · 设置页自身 opacity 0→1，跑 0.2s（`.myh-page` 的 `myh-bgIn`）
           两层都在动、方向还相反，中间那段露出来的就是"在换的图"，用户看到的是闪。

           现在改成：**只要整屏页开着，根层就用壳景**。于是 L1 → 设置页时根层背景
           **根本不变**，没有过渡可闪；而子页自己那张壳景与根层是同一张、同一位置，
           两层像素一致，淡入淡出都看不出来。
           退回阅读态（page = null）时才切回 `SCENE_OF` 的阅读景，BGM 与立绘仍按阅读景走。 */
        const pair = pageOpen
          ? (SHELL_OF[st.character] || SHELL_OF.aoko)
          : (SCENE_OF[st.character] || SCENE_OF.aoko)
        return pair[st.dark ? 'dark' : 'light']
      }, [st.character, st.dark, pageOpen])

      useEffect(function () {
        if (!m) return
        const sc = m.scenes[scene]
        store.set({ scene: scene, bg: sc ? assetURL(sc.bg) : '' })
      }, [m, scene])

      /* ★★★ 2026-09-20：**切景时同步输入框方位**。
         用户定案："所有的方位调整金鹿白天都要反着来。所以金鹿的输入框也应该反过来。"
         方位取自 `spriteSideOf(景)`（与立绘同一真源），写 `documentElement` 的属性，
         CSS 按属性把输入框翻到另一侧。
         ⚠ 必须**单独一个 effect**：`measureShell` 只在挂载时跑（几何测量用的），
           切景不会重跑它，属性会停在旧景的值 —— 那正是"换了角色方位却没变"的 bug。 */
      useEffect(function () {
        try {
          const inputSide = spriteSideOf(scene) === 'left' ? 'right' : 'left'
          document.documentElement.setAttribute('data-myh-side', inputSide)
        } catch { /* 尽力而为 */ }
      }, [scene, m])

      /* ---- 正文列的滚动宿主（★ 2026-09-21 新增）----
         `.myh-column` 现在是**真正的滚动容器**（铺满视口、内容超长就滚），
         所以"用户还在不在底部"这件事必须在**它**身上监听。
         ⚠ 为什么不用 `onScroll` 写在 `<div>` 的 props 上：
           React 的 `onScroll` **不冒泡**，而我们要的是列自己的滚动事件 ——
           写在内层 `.myh-transcript` 上永远不触发（它根本不滚）。
           用 ref 回调直接 `addEventListener` 最直白，也便于在卸载时摘掉。 */
      const stickToBottom = useRef(true)
      const columnRef = useCallback(function (el) {
        if (columnRef._el && columnRef._fn) {
          try { columnRef._el.removeEventListener('scroll', columnRef._fn) } catch { /* ignore */ }
          columnRef._el = null; columnRef._fn = null
        }
        if (!el) return
        const fn = function () {
          try {
            const gap = el.scrollHeight - el.scrollTop - el.clientHeight
            stickToBottom.current = gap < 80
          } catch { /* ignore */ }
        }
        el.addEventListener('scroll', fn, { passive: true })
        columnRef._el = el; columnRef._fn = fn
      }, [])

      // ---- 分句与打字机 ----
      const sentences = useMemo(function () { return splitSentences(st.line) }, [st.line])
      const safeSentences = sentences.length ? sentences : ['']
      const [sentIdx, setSentIdx] = useState(0)
      /* ★★★ 2026-09-23 修（用户：「发个『你好』她变了两次表情（一个很凶，然后变成微凶），有点怪了吧」）：
         **复位键原来是 `[st.line]`，而 `st.line` 是流式正文 —— 每来一个字它就变一次。**
         于是 `setSentIdx(0)` 每字触发：句子游标被反复打回第 0 句，
         而第 0 句在整轮里被**重新分类十几次**，每次它都比上次更长
         → 判出来的槽一路跳。实测四轮各跳 3 次；「很凶 → 微凶」正是 `angry → glare`。

         改成按**轮**复位：**用户消息条数**在一轮内不变、每轮 +1，是天然稳定的轮次键。
         ⚠ **不能**用 `data-id` 当键 —— 实测它整轮里会漂（`m91 → m95`），
           因为 `normalizeNode` 在节点无 `seq` 时退回**数组下标**，而数组在长。 */
      const turnKey = (function () {
        const list = (stSafe && stSafe.messages) || []
        let n = 0
        for (let i = 0; i < list.length; i++) if (list[i] && list[i].role === 'user') n++
        return n
      })()
      useEffect(function () { setSentIdx(0) }, [turnKey])
      const sentence = safeSentences[Math.min(sentIdx, safeSentences.length - 1)] || ''

      const [typed, setTyped] = useState(0)
      /* 已判过的句子键（`轮|序号|文本`）。同一句在流式增长中会被 effect 反复看到，
         这里保证**一句只判一次** —— 否则同一句每长几个字就重判一次，槽位来回跳。
         ⚠ 换景时必须一起清（见下面那个复位 effect），否则新角色永远不换表情。 */
      const judgedRef = useRef('')
      /* ★★★ 2026-09-23（用户定案）：**一次回复最多换一次表情**。
         原话：「能不能改成一次回复只换一次表情？（一个人一次性说话的时候不会
         说话的过程中多次改变情绪吧）？……不是说要换成一次说话一定换一次表情，
         只是如果换的话，一次回复只换一次。」
         记的是**已经换过表情的那一轮**（`turnKey` = 用户消息条数，一轮内恒定）。
         ⚠ 只锁**槽位变化**（真换情绪）—— 同一槽位内的**换帧**（`emo.roll`）不锁，
           那是"同一情绪换张图"的防呆板机制，不算换表情。
         ⚠ 换景时必须一起清（见下面那个复位 effect），否则新角色一整轮都换不了。 */
      const turnChangedRef = useRef(null)
      useEffect(function () {
        setTyped(0)
        if (!sentence) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce) { setTyped(sentence.length); return }
        let i = 0
        const step = Math.max(1, Math.round(sentence.length / 34))
        const timer = setInterval(function () {
          i = Math.min(sentence.length, i + step)
          setTyped(i)
          if (i >= sentence.length) clearInterval(timer)
        }, 34)
        return function () { clearInterval(timer) }
      }, [sentence])

      // ---- 表情判定 + 句子推进 ----
      useEffect(function () {
        if (!sentence || typed < sentence.length) return
        const jkey = turnKey + '|' + sentIdx + '|' + sentence
        /* ⚠ 只把**判定**放进守卫里，**推进的 setTimeout 必须每次都排**
           —— 若连它一起 return 掉，effect 重跑时会先清掉上一次的定时器再提前返回，
             游标就永远停在第 0 句（这是我自己差点写出来的第二个 bug）。 */
        if (judgedRef.current !== jkey) {
          judgedRef.current = jkey
          /* ★ 窗口 = **当前句 + 上一句**（`persona_work/stage/spec-switching.md` §2 的滑动窗口）。
             原来写的是 `emo.sentence || sentence` —— 那是**二选一**：
             `emo.sentence` 非空时**当前句根本没进分类器**，判的永远是上一句（整整慢一句）。
             规格的理由是"单独一句常常没有情绪线索（「……」「是吗。」），带上一句才判得准"，
             所以是**两句一起给**，不是二选一。
             ⚠ 保持 `stepEmotion` 的**三参数签名不变** —— `lab-selftest.mjs` 用它抽取并
               以 `(text, now, index)` 调用（5 条迟滞/节流/轮换断言都靠它），改签名会整片红。 */
          const prev = sentIdx > 0 ? (safeSentences[sentIdx - 1] || '') : ''
          const res = stepEmotion(prev + sentence, Date.now())
          emo.sentence = sentence
          if (res && m) {
            /* ★★★ 2026-09-23（用户定案）：**一次回复最多换一次表情**。
               「一个人一次性说话的时候不会说话的过程中多次改变情绪吧」
               —— 所以本轮只要**换过一次槽位**，后面判出什么都不再换，
               把当前这个表情演完这一轮。
               ⚠ 只锁槽位变化：同一槽位内的换帧（`res.roll` 变大）照旧生效，
                 那是防呆板机制，不是"换表情"。
               ⚠ 比对基准是 `cur.slot`（屏幕上真正显示的那个），不是 `emo.slot`
                 （内部状态）—— 两者在锁住之后可能短暂不一致，以屏幕上为准。 */
            const cur = store.get()
            const slotChanged = (res.slot !== cur.slot)
            if (slotChanged && turnChangedRef.current === turnKey) {
              /* 本轮已换过一次 —— 保持不动。 */
            } else {
              const url = pickSprite(scene, res.slot, res.roll)
              if (url && url !== cur.sprite) store.set({ sprite: url, slot: res.slot })
              else if (res.slot !== cur.slot) store.set({ slot: res.slot })
              if (slotChanged) turnChangedRef.current = turnKey
            }
          }
        }
        const t = setTimeout(function () {
          setSentIdx(function (i) { return Math.min(i + 1, safeSentences.length - 1) })
        }, 1100)
        return function () { clearTimeout(t) }
      }, [typed, sentence, safeSentences.length, scene, m])

      /* ---- 进景即保证有立绘（换人也必须重取） ----
       *
       * ★★★ 2026-09-22（用户第 9 条：**换角色要刷新才反应**）：
       *   原来这里第一句是 `if (store.get().sprite) return` —— **它就是病根**。
       *   切角色 → `scene` 变了 → 本 effect 重跑 → 但 `sprite` 已有值 → 直接 return。
       *   于是立绘还停在上一个人身上，一直要刷新（刷新会清空 store）才换过来。
       *
       *   现在改成：**每次换景都重取**，并把表情状态一并复位 ——
       *   否则会沿用上一个角色的槽位与轮换计数（`emo.slot` / `emo.roll`），
       *   表现为"换了人，但表情还留在上一个人的情绪上"。 */
      useEffect(function () {
         if (!m || !scene) return
         emo.slot = 'neutral'
         emo.since = 0
         emo.weakStreak = 0
         emo.lastSwitch = 0
         emo.roll = 0
         emo.sentence = ''
         /* ★ 2026-09-23：**换景也要清「已判过的句子」** ——
            否则新角色进来后，同一句会被判成"已经判过"而跳过，表情永远停在 neutral。 */
         judgedRef.current = ''
         /* ★ 2026-09-23：同上，**换景也要清「本轮已换过表情」的标记** ——
            否则新角色进来的第一轮会被当成"已经换过"，整轮不换表情。 */
         turnChangedRef.current = null
         const url = pickSprite(scene, 'neutral', 0)
         const cur = store.get()
         if (url && url !== cur.sprite) store.set({ sprite: url, slot: 'neutral' })
         else if (cur.slot !== 'neutral') store.set({ slot: 'neutral' })
      }, [m, scene])

      // ---- 版面测量：知道 DSH 的正文/输入框在哪，才能"占位"而不是"遮挡" ----
      //
      // ★★ 这个 effect 原来放在**函数最末尾**（紧挨着 return 之前），也就是排在
      //    `if (blocked) return null` 那几条守卫**后面**。那是一条真实可复现的
      //    React #310：首渲染时设置还没回来 → 用内置默认值 → 不拦；
      //    设置到达、而里面是 enabled:false → 拦 → 这次少算 2 个 hook；
      //    之后 enabled 再被打开 → 又多算 2 个 → 立刻抛
      //    "Rendered more hooks than during the previous render"。
      //    hook 一律集中在守卫之前，是这个组件唯一安全的排法。
      useEffect(function () {
        const run = function () { try { measureShell() } catch { /* ignore */ } }

        // ★ 审批/对话框在场时给热区打 data-guard="off"（让位），离场再摘掉。
        //    皮肤是整屏覆盖层，热区只要还接点击，用户就点不动「批准/拒绝」。
        //    用 MutationObserver 而不是 setInterval：
        //      · 审批卡是"插进来的节点"，childList 一定触发，够快
        //      · **定时器会让 Node 进程不肯退出** —— render-selftest.mjs 会挂死
        //        （实测踩过：7 个脚本里就它超时）
        let lastGuard = null
        const guard = function () {
          try {
            const need = uiNeedsPointer()
            if (need === lastGuard) return
            lastGuard = need
            const v = need ? 'off' : 'on'
            const hz = document.querySelector('.myh-hotzone')
            if (hz) hz.setAttribute('data-guard', v)
            const rootEl = document.getElementById('myh-skin-root')
            if (rootEl) rootEl.setAttribute('data-guard', v)
          } catch { /* ignore */ }
        }
        /* ★ 2026-09-20：输入框三档要**跟手**。
           MutationObserver 抓不到"用户在打字"（值变化不是 DOM 变更），
           所以给输入框补 input/focus/blur 监听：
           空 ↔ 非空 的切换决定 48 ↔ 72 与 中档 ↔ 浅档。 */
        const onInput = function () { run() }
        const bindInput = function () {
          try {
            const el = document.querySelector('[data-composer-input]')
            if (!el || el === bindInput._el) return
            if (bindInput._el) {
              bindInput._el.removeEventListener('input', onInput)
              bindInput._el.removeEventListener('focus', onInput)
              bindInput._el.removeEventListener('blur', onInput)
            }
            bindInput._el = el
            el.addEventListener('input', onInput)
            el.addEventListener('focus', onInput)
            el.addEventListener('blur', onInput)
          } catch { /* ignore */ }
        }

        const runAll = function () { run(); guard(); bindInput(); installFocusWatch() }

        runAll()
        const t1 = setTimeout(runAll, 120)
        const t2 = setTimeout(runAll, 600)
        const t3 = setTimeout(runAll, 1800)
        window.addEventListener('resize', run)
        const ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(run) : null
        try { if (ro) ro.observe(document.body) } catch { /* ignore */ }
        const mo = (typeof MutationObserver === 'function')
          ? new MutationObserver(function () { guard(); bindInput() }) : null
        try { if (mo) mo.observe(document.body, { childList: true, subtree: true }) } catch { /* ignore */ }

        /**
         * ★★★ 2026-09-20：**视口变了就上报**（原来只有挂载后 200ms/1400ms 两拍）。
         *
         * 为什么必须补：用户全屏/调窗口之后，皮肤既不改自己的尺寸、也不上报，
         * 于是 `/moye-skin/health` 里永远是**挂载那一刻**的旧值。
         * 我拿着旧值反复测量，结论永远是"铺满"——而用户明明看到黑边。
         * 更糟的是：让用户开 F12 去读 `innerWidth` 也**不准**，因为**控制台一开浏览器就缩小内容区**，
         * 读到的 1357 是"缩小后"的值，不是真实窗口宽。
         *
         * 所以：只信**页面自己上报的、带时间戳的、随 resize 更新的**数。
         * 字段放在 `autoProbe` 内部（红线 7），只吐数字/字符串，能过 `JSON.stringify`。
         */
        let lastReported = ''
        const reportViewport = function (why) {
          try {
            const vw = window.innerWidth, vh = window.innerHeight
            const key = vw + 'x' + vh
            if (key === lastReported) return
            lastReported = key
            const rootEl = document.querySelector('.myh-root')
            const bgEl = document.querySelector('.myh-bg')
            const r = rootEl ? rootEl.getBoundingClientRect() : null
            const b = bgEl ? bgEl.getBoundingClientRect() : null
            reportToHost({
              stage: 'probe-viewport',
              build: BUILD_ID,
              autoProbe: {
                why: why || 'resize',
                viewport: {
                  innerW: vw, innerH: vh,
                  dpr: window.devicePixelRatio,
                  screenW: screen.width, screenH: screen.height,
                  availW: screen.availWidth, availH: screen.availHeight,
                  outerW: window.outerWidth, outerH: window.outerHeight,
                  docW: document.documentElement.clientWidth,
                  docH: document.documentElement.clientHeight,
                  bodyW: document.body ? document.body.clientWidth : -1,
                  visual: (window.visualViewport
                    ? Math.round(window.visualViewport.width) + 'x' + Math.round(window.visualViewport.height)
                    : '-'),
                },
                measured: {
                  rootW: r ? Math.round(r.width) : -1,
                  rootH: r ? Math.round(r.height) : -1,
                  bgW: b ? Math.round(b.width) : -1,
                  bgH: b ? Math.round(b.height) : -1,
                },
                verdict: (r && Math.round(r.width) === vw && Math.round(r.height) === vh)
                  ? '皮肤根 == 视口（铺满）'
                  : ('皮肤根 ' + (r ? Math.round(r.width) + 'x' + Math.round(r.height) : '无') +
                     ' != 视口 ' + vw + 'x' + vh),
              },
            })
          } catch { /* 上报失败不影响界面 */ }
        }
        reportViewport('effect')
        window.addEventListener('resize', function () { reportViewport('resize') })
        if (window.visualViewport) {
          try { window.visualViewport.addEventListener('resize', function () { reportViewport('visualViewport') }) } catch { /* ignore */ }
        }
        const t4 = setTimeout(function () { reportViewport('t+3s') }, 3000)

        return function () {
          clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
          window.removeEventListener('resize', run)
          if (ro) ro.disconnect()
          if (mo) mo.disconnect()
        }
        // ★ 依赖里必须有 `st.sessionId`：
        //   换会话的时候布局会变（页签条/右栏/输入框位置都可能不同），
        //   只盯 `settings` 和 `messages.length` 的话，换过去之后
        //   `--myh-composer-h` / `--myh-hole-*` 还是上一个会话量的值 ——
        //   对话框会压在输入框上或留一个空洞。
      }, [st.settings, st.sessionId, st.messages.length])

      // ---- 空白区点击 = 唤出/收回菜单（docs/08 §1.1） ----
      const onHotzone = useCallback(function (e) {
        unlockAudio()
        e.preventDefault()
        playSfx('menu')
        const open = !store.get().menu
        store.set({ menu: open, page: null, menuMode: 'main' })
      }, [])

      /**
       * ★★★ 2026-09-22（用户第 2 条）：**"有些地方点击左键依然没有反应"**。
       *
       * 实测那些死区（`elementFromPoint` 逐个验过）：
       *   · 正文中间 —— 命中 `.myh-column`。它 `pointer-events:auto` 且铺满 `100vw×100vh`，
       *     但**自身没有 onClick** ⇒ 整个中段点了毫无反应。热区只覆盖左右各 15%，
       *     中段 15%~85% 根本没有任何东西接点击。
       *   · 顶部条 —— `.myh-hotT` 实测 **767×0**：高度为 0，等于不存在。
       *   · L2 面板的空白处 —— 命中 `.myh-menuBody`，也没有 onClick。
       *
       * 定案口径（与既有语义一致）：**空白处的左键 = 唤出/收回菜单**。
       * 三层保护，缺一不可：
       *   ① 有整屏页（L1/设置）时不接 —— 那些页面自己处理左键（逐层退回）；
       *   ② 有文字被选中时不接 —— 否则"拖选一句话"会被当成一次点击，菜单跳出来；
       *   ③ 点在真控件上时不接 —— 交给控件自己。
       */
      const onBackdrop = useCallback(function (e) {
        const s = store.get()
        if (s.page || s.ed) return
        /* ② 正在选文字 —— 让给选择 */
        try {
          const sel = window.getSelection && window.getSelection()
          if (sel && sel.type === 'Range' && String(sel).length) return
        } catch (_e) { /* 取不到就按没选处理 */ }
        /* ③ 真控件自己处理 */
        const t = e.target
        if (t && t.closest && t.closest('button,input,a,[role="button"],[role="menuitem"]')) return
        unlockAudio()
        playSfx('menu')
        const open = !s.menu
        store.set({ menu: open, page: null, menuMode: 'main' })
      }, [])

      // ---- 键盘：Esc 关闭 / 方向键移动焦点 / Enter 确认 ----
      const focusPair = useMenuFocus()
      const focus = focusPair[0]
      useEffect(function () {
        const onKey = function (e) {
          const s = store.get()
          if (s.ed) return
          if (e.key === 'Escape') {
             /* ★★★ 2026-09-22（用户第 1 条）：**Esc 与左键完全同义**，一律交给 handleMenuBack()。
                原来这里是另一套：`page` 有值 → `store.set({page:null})`（直接退出到阅读态），
                而同一个界面上的「返回」按钮走的是 `page: 'title'`（回 L1）——
                同一界面两套语义，正是用户说的"操作逻辑有一搭没一搭 / 自成一派"。
                现在一律逐层退回，到顶就关。 */
             if (s.page || s.menu) { handleMenuBack(); return }
             return
          }
          /* 焦点表是动态的：L2 = 本工作区会话 + 新建 + 返回；L1 = 四项（或工作区表） */
          const ids = navIdsOf(s)
          if (!ids.length) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const i = ids.indexOf(menuFocus)
            const n = e.key === 'ArrowDown'
              ? (i + 1) % ids.length
              : (i - 1 + ids.length) % ids.length
            /* 声音改由 setMenuFocus() 统一发（第 2 条），这里不再单独响，免得双声。 */
            setMenuFocus(ids[n])
          } else if (e.key === 'Enter') {
            e.preventDefault()
            handleMenu(menuFocus)
          }
        }
        const onCtx = function (e) {
          const s = store.get()
          if (s.menu || s.page || s.ed) return
          const t = e.target
          if (t && t.closest && t.closest('.myh-menu,.myh-page')) return
          e.preventDefault()
          playSfx('menu')
          store.set({ menu: true, page: null, menuMode: 'main' })
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('contextmenu', onCtx)
        return function () {
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('contextmenu', onCtx)
        }
      }, [focus])

      // ---- ED 彩蛋：上下文到阈值 → ED 背景 + m53，放完自动回 ----
      const edFired = useRef(false)
      useEffect(function () {
        const s = st.settings
        if (!m || !s || !s.easterEgg || st.ed) return
        if (st.pressure == null) return
        if (edFired.current) return
        /* ★★★ 2026-09-21 用户定案（Q13）：ED 阈值**钉死 0.78**、且面板那一行已整行删除
           （原话"这是不可修改项"）。所以这里**故意不看存储值** ——
           `settings.yaml` 里残留的 `edThreshold: 0.8` 仍然会赢过代码默认，
           而 UI 已经没有入口能让用户改它了，留着就是个不能改又生效的僵尸值。
           动机（HANDOFF §8.1）：DSH 自动压缩阈值是 0.8，0.9 永远到不了、
           0.8 等于和压缩赛跑 → 定 0.78。 */
        const th = 0.78
        if (st.pressure >= th) {
          edFired.current = true
          enterEd()
        }
      }, [st.pressure, st.settings, st.ed, m])

      // ---- BGM ----
      useEffect(function () {
        const s = st.settings
        if (!m || !s) return
        if (!audio.el) {
          const el = new Audio()
          el.loop = false
          el.volume = clamp(s.bgmVolume == null ? 0.35 : s.bgmVolume, 0, 1)
          el.addEventListener('ended', function () {
            if (store.get().ed) { exitEd(); return }
            if (!audio.playlist.length) return
            audio.index = (audio.index + 1) % audio.playlist.length
            playIndex(audio.index, audio.kind)
          })
          /* ★ 断点续播的落点：元数据就绪才能 seek。
             在这里写 `currentTime` 才是**有效**的；写在 `src` 之后立刻写
             会被浏览器静默忽略（见 playIndex 里的长注释）。 */
          el.addEventListener('loadedmetadata', function () {
            const want = audio.pendingSeek
            audio.pendingSeek = 0
            if (!(want > 0)) return
            try {
              /* 再核一次时长：`duration` 在 loadedmetadata 这一刻才是准的，
                 而位置可能是在"时长未知"时算出来的。 */
              const at = bgmResumeAt(want, el.duration)
              if (at > 0) el.currentTime = at
            } catch (_e) { /* seek 失败就当从头播，不影响播放 */ }
          })
          /* 每秒记一次位置（`bgmRemember` 内部只在跨整秒时才落盘）。 */
          el.addEventListener('timeupdate', function () { bgmRemember(false) })
          audio.el = el
        }
        audio.el.volume = clamp(s.bgmVolume == null ? 0.35 : s.bgmVolume, 0, 1)
        if (st.ed) {
          const ed = m.bgm && m.bgm.ending
          if (ed) {
            const url = assetURL(ed)
            if (audio.current !== url) {
              bgmRemember(true)          /* ★ 进 ED 前先存下当前曲的位置 */
              audio.playlist = [url]; audio.index = 0; audio.current = url
              /* ED 曲**不续播**：它是彩蛋，每次都要从开头放（用户没要求记住它）。 */
              audio.pendingSeek = 0
              audio.el.src = url
              audio.el.play().catch(function () {})
            }
          }
          return
        }
        if (!s.bgm) {
          /* ★ 关掉 BGM 之前先存位置 —— 否则重新打开会从头播。 */
          bgmRemember(true)
          audio.el.pause()
          return
        }
        setBgm(m, st.dark, st.page === 'title')
        if (audio.el.paused && audio.el.src) audio.el.play().catch(function () {})
      }, [m, st.settings, st.dark, st.page, st.ed])

      /* ---- 离开页面时把播放位置落盘 ----
         用 `pagehide` 而不是 `beforeunload`：移动端 Safari 上后者常常不触发，
         而 `pagehide` 在前进/后退缓存（bfcache）进出时都会响。
         `visibilitychange` 顺带覆盖"切到别的标签页待很久"的情形 ——
         那时 `timeupdate` 会因节流变慢，位置可能落后好几秒。 */
      useEffect(function () {
        const save = function () { bgmRemember(true) }
        const onVis = function () { if (document.visibilityState === 'hidden') bgmRemember(true) }
        window.addEventListener('pagehide', save)
        document.addEventListener('visibilitychange', onVis)
        return function () {
          window.removeEventListener('pagehide', save)
          document.removeEventListener('visibilitychange', onVis)
          save()                       /* 皮肤被卸载（Ctrl+Shift+M 等）时也存一次 */
        }
      }, [])

      // ---- 首次用户手势解锁音频 ----
      useEffect(function () {
        const on = function () { unlockAudio() }
        window.addEventListener('pointerdown', on, { once: true })
        window.addEventListener('keydown', on, { once: true })
        return function () {
          window.removeEventListener('pointerdown', on)
          window.removeEventListener('keydown', on)
        }
      }, [])

      // ---- 页签条降级探测（docs/08 §3） ----
      useEffect(function () {
        if (!st.settings) return
        const t = setTimeout(function () {
          const tablist = document.querySelector('[role="tablist"]')
          document.body.setAttribute('data-myh-tabs', st.settings.hideTabs ? 'hide' : 'bar')
          store.set({ tabFallback: !tablist && !!st.settings.hideTabs })
        }, 1200)
        return function () { clearTimeout(t) }
      }, [st.settings, st.settings ? st.settings.hideTabs : false])

      // ---- body 标记 + 收起侧栏/右栏（红线 6：一律走官方 ctx.layout，不用 CSS 隐藏） ----
      //
      // ⚠ 这里**刻意不做自动收起侧栏**：
      //   `ctx.layout` 只暴露 `toggleSidebar()`（翻转），**没有读取态**，
      //   也没有 `collapseSidebar()`。而 `shell.overlay` 上的皮肤根会因为
      //   会话切换、主题切换等原因重挂载，每挂一次就 toggle 一次的话，
      //   侧栏会莫名其妙地自己开合 —— 这比"没自动收起"糟得多。
      //
      //   所以：**收起交给 DSH 自己的侧栏控件**（那个按钮调的就是同一个服务），
      //   皮肤只负责在收起的形态下把阅读态做干净。右栏则可以安全地幂等关闭
      //   （`closeRightbar()` 是设成关闭而不是翻转）。
      useEffect(function () {
        if (!st.settings || !st.settings.enabled) return
        document.body.setAttribute('data-myh-skin', 'on')
        const ctx = svc.ctx
        try {
          const layout = ctx && ctx.get ? ctx.get('layout') : null
          if (layout && typeof layout.closeRightbar === 'function') layout.closeRightbar()
        } catch (_e) { /* 服务未就绪不影响皮肤 */ }
        return function () {
          document.body.removeAttribute('data-myh-skin')
          document.body.removeAttribute('data-myh-tabs')
        }
      }, [st.settings])

      /**
       * 可选：进皮肤时把侧栏收起一次（默认开）。
       *
       * 之所以安全：`toggleSidebar()` 是翻转，所以只在**实测确认侧栏当前是展开的**
       * （左列可见宽度 > 220px）时才调一次。侧栏本来就收着 → 什么都不做。
       * 用户之后手动展开，皮肤不会跟它对着干（本 effect 只在挂载时跑一次）。
       */
      const collapsedOnce = useRef(false)
      useEffect(function () {
        if (killed || KILLED_AT_LOAD) return
        if (!st.settings || !st.settings.enabled) return
        if (st.settings.autoCollapse === false) return
        if (collapsedOnce.current) return
        collapsedOnce.current = true
        const timer = setTimeout(function () {
          try {
            const ctx = svc.ctx
            const layout = ctx && ctx.get ? ctx.get('layout') : null
            if (!layout || typeof layout.toggleSidebar !== 'function') return
            const frame = document.querySelector('[data-sidebar-collapsed]')
              || document.querySelector('[data-sidebar-collapsed="true"]')
            // 已经收着 → 不动
            if (frame && frame.hasAttribute('data-sidebar-collapsed')) return
            // 找左列：视口最左侧那一竖条中宽度最大且 > 220px 的元素
            let sidebarW = 0
            const all = document.body.querySelectorAll('div,aside,nav')
            for (let i = 0; i < all.length; i++) {
              const el = all[i]
              const r = el.getBoundingClientRect()
              if (r.left <= 1 && r.height > window.innerHeight * 0.5 && r.width > sidebarW && r.width < window.innerWidth * 0.6) {
                sidebarW = r.width
              }
            }
            if (sidebarW > 220) layout.toggleSidebar()
          } catch (_e) { /* 探测失败就不动，保持原状 */ }
        }, 900)
        return function () { clearTimeout(timer) }
      }, [st.settings])
      
      /* ★★★ 2026-09-22（用户第 7 条）：整屏页打开 → 给皮肤根打 `data-myh-page="on"`。
         只写属性、不直接改 z-index：抬多少由 §1 那条 CSS 决定，
         这样"什么时候该抬"与"抬到几"分开，改一个不会连带另一个。
         ⚠ 必须**排在这里**（所有 hook 集中区之内、下面那些 `return` 之前）——
         红线 5：hook 一律排在提前 return 之前，否则 React #310。
         ⚠ `pageOpen` 本身声明在**上面**（约 5340 行，`scene` 之前）——
           那个 useMemo 的依赖数组要用它，而 const 有 TDZ，放这里会 ReferenceError。 */
      useEffect(function () {
        const el = document.getElementById('myh-skin-root')
        if (!el) return
        if (pageOpen) el.setAttribute('data-myh-page', 'on')
        else el.removeAttribute('data-myh-page')
        return function () { try { el.removeAttribute('data-myh-page') } catch (_e) { /* 卸载时清掉 */ } }
      }, [pageOpen])

      // ★ 渲染守卫已在函数开头统一处理（见 `blocked`）。
      //   这里**不能再放 `return null`** —— 原先那两条用的是原始 `st`，
      //   而 `settings` 是个异步到达的瞬时状态，于是"设置还没回来"会把
      //   整个皮肤永久按死（这正是"界面没反应"的直接原因，2026-09-17 定位）。
      //
      // ★★ 另一条硬规矩：**所有 hook 必须排在下面这两行之前**。
      //    2026-09-17 抓到主因：版面测量那个 useEffect 原本就在这两行之后。
      //    首渲染设置未到 → 用内置默认 → 不拦（22 个 hook）；
      //    设置到达且 enabled:false → 拦住（0 个 hook，提前返回）→ React #310。
      //    只要 enabled 开关过界一次，皮肤就永久废掉。
      //    所以现在：hook 全在上半段，守卫只负责"返回什么"。
      if (blocked) {
        // 返回空 div 而不是 null：不让 React 在同一个位置上经历
        // 节点类型 null→div 的切换，少一类边界情况。
        return h('div', { className: 'myh-root myh-off', 'data-myh-blocked': blocked, style: { display: 'none' } })
      }
      if (!m) return h('div', { className: 'myh-root myh-off', 'data-myh-nomanifest': '1', style: { display: 'none' } })

      const ui = m.ui || {}
      const tone = st.agent === 'generating' ? 'mid' : (st.agent === 'waiting' ? 'pale' : 'deep')
      const page = st.page

      const edLines = [
        '―――　这个故事，不属于任何人。',
        '',
        '原作·剧本　　奈须蘑菇',
        '原画·美术　　小山广和',
        '音乐　　　　　KATE',
        '发行　　　　　TYPE-MOON',
        '',
        '皮肤实现　　　dsh-skin-mahoyo',
        '（DSH Web GUI 主题皮肤·非官方）',
        '',
        '―――　夜，还没有亮。',
      ]

      const info = '上下文 ' + (st.pressure == null ? '未知' : Math.round(st.pressure * 100) + '%')
        + '　景 ' + st.scene
        + '　角色 ' + CHARACTER_CN[st.character]
        + (st.error ? '　⚠ ' + st.error : '')

      return h('div', { className: 'myh-root' },
        // ============ 底层：背景 / 暗带 / 立绘 ============
        h('div', { className: 'myh-under', 'aria-hidden': 'true' },
          stSafe.bg ? h('img', { key: stSafe.bg, className: 'myh-bg myh-bgFade', src: stSafe.bg, alt: '', draggable: false }) : null,
          ui.txtwindow && ui.txtwindow[0]
            ? h('img', {
              className: 'myh-band',
              src: assetURL(ui.txtwindow[tone === 'deep' ? 0 : (tone === 'mid' ? 1 : 2)] || ui.txtwindow[0]),
              alt: '', draggable: false,
            }) : null,
          /* ★★★ 2026-09-23：**整屏页打开时不渲染立绘**（`!pageOpen`）。
             用户报告"从起始页切到皮肤设置时，右上角出现一个人物画像"。

             病根：立绘原来只受 `showSprite` 设置控制，**不看当前是不是整屏页**。
             而 `scene` 在整屏页时取的是**壳景**（B3/B4 …），那六个壳景在
             `manifest.expressions` 里是 `"slots":{}` —— 没有立绘配置，
             `pickSprite` 只能走 fallback 返回一张兜底图。于是：
               L1 → 设置页  ⇒  scene 变壳景 ⇒ 那个 `[m, scene]` effect 重取立绘
                            ⇒ 一张跟设置页无关的兜底立绘被渲染到 `.myh-under`
             而设置页的 `confScrim` 是**半透明**的（rgba .58→.70）、整屏页又正在
             淡入，那张立绘就从边角透出来了。

             加上 `!pageOpen` 之后：整屏页期间立绘不挂载，透不出来；退回阅读态
             （page = null）立即恢复。这也顺带省掉一次无谓的图片加载。 */
          (stSafe.settings.showSprite && !pageOpen)
            ? h(Sprite, { url: stSafe.sprite, side: spriteSideOf(stSafe.scene) }) : null),

        // ============ 正文层：★ 自己画的会话流 ============
        // 这一层取代了 DSH 的原生消息列表（原生那套由 §1 CSS 让位/隐藏）。
        // 位置刻意放在 under 与 over 之间：背景在下、对话框菜单在上，正文夹中间。
        h('div', { className: 'myh-column', ref: columnRef, onClick: onBackdrop },
          h('div', { className: 'myh-columnInner' },
            // 窄栏：会话标题条（不占满宽，视觉上像书页边栏）
            h('div', { className: 'myh-titlebar' },
              h('span', { className: 'myh-titlebarText' }, stSafe.sessionTitle || '本文'),
              h('span', { className: 'myh-titlebarMeta' },
                CHARACTER_CN[stSafe.character] + '　' + stSafe.scene)),
            // ★ 打字机的结果直接进正文流（`typing` 由 Transcript 用在最后一条助手消息上）
            h(Transcript, {
              messages: stSafe.messages,
              agent: stSafe.agent,
              typing: stSafe.settings.showDialogue === false ? '' : sentence.slice(0, typed),
              stick: stickToBottom,
            }))),

        // ============ 交互层：菜单 / 子页 / ED ============
        // ★★★ 2026-09-21：**底部那层独立台词 `.myh-cur` 已删**（用户："下面这个弹文字的部分删掉"）。
        //   打字机与光标移进了正文流（见 Transcript 头注释），
        //   所以这里不再渲染任何文字层 —— 屏幕上只有一条文字载体。
        /* 场景变暗（原作层 2：「画面变暗但仍可见」）。不吃点击。 */
        h('div', { className: 'myh-scrim', 'data-on': (stSafe.menu && !page && !stSafe.ed) ? 'true' : 'false' }),
        h('div', { className: 'myh-over' },
        /* ★★★ 2026-09-20：**点击热区重做** —— 从"全屏挖洞"改成"三条离散区"。

         为什么废弃挖洞：实测（`elementFromPoint`）输入框中心点命中的是
         `.myh-hotzone`，也就是**皮肤自己的热区把输入框吃了**。
         而热区当时的 clip-path 长这样：

             polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,
                     56px 0px, 56px 1115px, 1910px 1115px, 1910px 0px, 56px 0px,
                     0px 1001px, ...)

         洞①（正文矩形）**一直挖到 1115（画面底边）**，洞②（输入框那一条）
         又从 1001 起挖 —— 两块重叠、绕向相消，于是**输入框那一条重新变成实心**。
         这类"用多边形绕向表达多个洞"的写法极其难验：出错了界面上完全看不出来，
         只能靠数形状。**所以整个换掉，不再用 clip-path。**

         改成三条互不重叠的矩形区（各自独立、不依赖任何几何运算）：
           ① 左侧空白区  —— 唤出/收回菜单
           ② 右侧空白区  —— 同上
           ③ 顶部条      —— 同上（正文上方那一点）
         底部那一条（输入框所在）**根本没有热区覆盖** → 点击必然落到 composer 上。

         ⚠ 这三块**不能用 inset:0 再挖洞**（那又回到老路），必须是真正的三块小矩形。
         ✓ 顺带满足红线 13（退化方向）：三块都按最小尺寸给，
           量不到正文宽度时就退化成"只留最窄的左右边条"，绝不退化成整屏。 */
        h('div', {
          className: 'myh-hotzone myh-hotL',
          'data-armed': (page || stSafe.ed) ? 'false' : 'true',
          'data-guard': uiNeedsPointer() ? 'off' : 'on',
          onClick: onHotzone,
        }),
        h('div', {
          className: 'myh-hotzone myh-hotR',
          'data-armed': (page || stSafe.ed) ? 'false' : 'true',
          'data-guard': uiNeedsPointer() ? 'off' : 'on',
          onClick: onHotzone,
        }),
        h('div', {
          className: 'myh-hotzone myh-hotT',
          'data-armed': (page || stSafe.ed) ? 'false' : 'true',
          'data-guard': uiNeedsPointer() ? 'off' : 'on',
          onClick: onHotzone,
        }),
        h(Menu, {
          open: stSafe.menu && !page && !stSafe.ed,
          bg: ui.menuWindow ? assetURL(ui.menuWindow) : '',
          sessions: sessionRowsOf(stSafe),
          currentId: stSafe.sessionId,
          menuMode: stSafe.menuMode,
          focus: focus,
          info: info,
          onFocus: setMenuFocus,
          onActivate: handleMenu,
          onBack: handleMenuBack,
          /* ★ 2026-09-22（用户第 2 条）：面板空白处的左键 = 收回菜单（与别处同义） */
          onBackdrop: function () { playSfx('cancel'); store.set({ menu: false, menuMode: 'main' }) },
        }),
        page === 'title' ? h(TitlePage, {
          bg: stSafe.bg,
          mode: stSafe.titleMode === 'workspaces' ? 'workspaces' : 'menu',
          items: stSafe.titleMode === 'workspaces'
            ? [{ cls: 'myh-srow', id: 'newws', cn: '新建工作区', focused: focus === 'newws' }]
                .concat((stSafe.workspaces || []).map(function (w) {
                  return { cls: 'myh-srow', id: 'ws:' + w.id, cn: w.title, en: w.path, focused: focus === 'ws:' + w.id }
                }))
                .concat([{ cls: 'myh-srow', id: 'back', cn: '返回', focused: focus === 'back' }])
            : [
                { cls: 'myh-srow', id: 'setskin', cn: '皮肤设置', focused: focus === 'setskin' },
                { cls: 'myh-srow', id: 'newws', cn: '新建工作区', focused: focus === 'newws' },
                { cls: 'myh-srow', id: 'openws', cn: '打开工作区', focused: focus === 'openws' },
                { cls: 'myh-srow', id: 'back', cn: '返回对话', focused: focus === 'back' },
              ],
          onFocus: setMenuFocus,
          onActivate: handleMenu,
          onBack: handleMenuBack,
        }) : null,
        page === 'config' ? h(ConfigPage, {
          /* 2026-09-22（用户第 1 条）：设置页背景 = **L1 的那张壳景**。
             走 `SHELL_OF[角色][昼夜]` → `m.scenes[景].bg`，与表紙同一真源；
             缺角色 / 缺景一律退回空串（图不渲染，不影响可用性）。 */
          bg: (function () {
            const pair = SHELL_OF[stSafe.character] || SHELL_OF.aoko
            const sk = pair[stSafe.dark ? 'dark' : 'light']
            const sc = (m && m.scenes) ? m.scenes[sk] : null
            return (sc && sc.bg) ? assetURL(sc.bg) : ''
          })(),
          title: ui.confTitle ? assetURL(ui.confTitle) : '',
          frame: ui.confFrame ? assetURL(ui.confFrame) : '',
          /* ★★★ 2026-09-22（原著五页签重做）：当前页签来自 store。
             ⚠ 新素材（页签 / OFF·ON / 恢复按钮 / 旋钮 / 两端标签，共 80 个切片）
               全部走 `skin/assets/ui/conf/` 的**字面路径**，**不写进 manifest.json** ——
               那是 assemble-assets.mjs 的产物，重跑会毁数据（HANDOFF §5.1）。
               宿主素材路由是 `path.resolve(root, rel)` + 前缀守卫，子目录能取到（已实测）。 */
          tab: stSafe.confTab,
          menuMask: ui.menuBtn ? assetURL(ui.menuBtn) : '',
          settings: stSafe.settings,
          info: info,
          onChange: applySettings,
          /* ★ 2026-09-23：滑条的写值入口（点哪设哪 / 拖动 / 两端直选）。 */
          onSetVolume: function (v) { applySettings({ bgmVolume: v }) },
          /* ★ 2026-09-22（用户第 6 条）：设置页接入**与外层同一套**焦点与操作语义 ——
             悬停移焦点、左键逐层退回、右键 / Enter 操作当前项。 */
          focus: focus,
          onFocus: setMenuFocus,
          onBack: handleMenuBack,
          onActivate: handleMenu,
          /* 返回 = 回 L1（皮肤设置是 L1 的子页，不是 L2 的） */
          onClose: function () { playSfx('cancel'); store.set({ page: 'title', titleMode: 'menu', menu: false }) },
        }) : null,
        stSafe.ed ? h(EdLayer, {
          bg: m.edBackground ? assetURL(m.edBackground) : '',
          lines: edLines,
          onStop: exitEd,
        }) : null))
    }

    // ==================================================================
    // §9 会话动作 / ED / 设置
    // ==================================================================

    function doOpenSession(id) {
      const ctx = svc.ctx
      try {
        /* ⚠ 必须用 ctx.get(name)：读 `ctx.sessions` 这种**属性**会抛
       （实测字符串：cannot get property "sessions" without inject），
       因为本包只声明了 inject=['slots']。cordis 的 get() 没有 inject 要求，
       服务缺席时返回 undefined —— 正是这里要的降级语义。
       ⚠ 也**不能**把服务加进 inject 数组：那样服务一旦缺席，插件永不 apply，皮肤直接死。 */
    const sessionsSvc = (ctx && ctx.get) ? ctx.get('sessions') : null
    if (sessionsSvc && typeof sessionsSvc.open === 'function') { sessionsSvc.open(id); return }
      } catch (_e) { /* 落到 DOM 兜底 */ }
      // 兜底：点 DSH 自己的会话行（标题匹配）
      const row = live.sessions.find(function (r) { return r.id === id })
      if (!row) return
      const nodes = document.querySelectorAll('button,a,[role="option"],[role="menuitem"]')
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i]
        if ((el.textContent || '').indexOf(row.title) >= 0) { el.click(); return }
      }
    }

    function doNewSession() {
      const ctx = svc.ctx
      try {
        const sessionsSvc = (ctx && ctx.get) ? ctx.get('sessions') : null
        if (sessionsSvc && typeof sessionsSvc.create === 'function') {
          sessionsSvc.create(live.workspaceId ? { workspaceId: live.workspaceId } : undefined)
            .then(function (id) { if (id) doOpenSession(id) })
            .catch(function () { /* 创建失败保持原状 */ })
          return
        }
      } catch (_e) { /* 落到 DOM 兜底 */ }
      const nodes = document.querySelectorAll('button,a')
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i]
        const label = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')
        if (/新建|新しい|New session/i.test(label)) { el.click(); return }
      }
    }

    /**
     * remote 子命名空间的缓存盒。
     *
     * ⚠ 点号名（`remote.workspace` / `remote.directoryPicker`）**没有**被任何包
     *   `provide` 过 —— 它们是靠**子 fiber 注入**解析出来的（`dsh-api-workspace-controller`
     *   自己就写 `inject = ["remote", "remote.workspace"]`）。
     *   所以在父 ctx 上 `get('remote.directoryPicker')` 拿不到，直接读属性会抛
     *   `cannot get property "..." without inject`。
     *   正确路径：`ctx.inject(['remote.workspace'], sctx => …)`，把拿到的面存进这里。
     */
    const remotes = { directoryPicker: null, workspace: null }

    /** 在 apply() 里调一次：把两个远程面挂进子 fiber 并缓存。 */
    function installRemoteFaces(ctx) {
      try {
        ctx.inject(['remote.directoryPicker'], function (sctx) {
          try { remotes.directoryPicker = sctx.get('remote.directoryPicker') || null } catch (_e) {}
        })
        ctx.inject(['remote.workspace'], function (sctx) {
          try { remotes.workspace = sctx.get('remote.workspace') || null } catch (_e) {}
        })
      } catch (err) {
        /* 注入失败只影响 L1 那两个动作，不连坐 */
        try { console.warn('[moye-skin] remote 面注入失败：', err) } catch (_e) {}
      }
    }

    /**
     * L1：新建工作区。
     * IWorkspaces.create({path}) **只收一个已存在的绝对目录**（不能凭空建目录），
     * 所以必须先过目录选择器。选择器两种形态（native = 宿主 OS 弹窗；
     * browse = 应用内浏览，可建文件夹），这里统一用 remote.directoryPicker.pick()。
     */
    function doNewWorkspace() {
      const ctx = svc.ctx
      try {
        /* 面由 installRemoteFaces() 在 apply 时注入并缓存（见 remotes 的注释：
           点号名没被 provide，只能走子 fiber 注入）。 */
        const dp = remotes.directoryPicker
        const ws = remotes.workspace
        if (!dp || !ws || typeof dp.pick !== 'function' || typeof ws.create !== 'function') {
          store.set({ error: '这个 DSH 没提供目录选择器，无法新建工作区' })
          return
        }
        /* ⚠⚠ remote 的方法**返回 RemoteResult，不是裸值** ——
           官方样例（dsh-client-ui-workspace/lib/client.js）里是
             const result = await this.directoryPicker.pick();
             if (!result.ok) throw ...; return result.value;
           我第一版把整个返回值当 path 传给了 create({path})，
           严格 codec 于是拒收，报 `workspace/create rejected "request"`。
           两层都要解：pick -> r.value（可能为 null＝用户取消）；create -> r.value.workspace。 */
        dp.pick()
          .then(function (r) {
            if (!r || r.ok !== true) {
              throw new Error(r && r.error ? String(r.error.message || r.error.code || r.error) : '目录选择器失败')
            }
            const path = r.value
            if (!path) return null      // 用户取消（value 为 null）
            return ws.create({ path: path })
          })
          .then(function (r2) {
            if (!r2) return              // 用户取消，静默
            if (r2.ok !== true) {
              throw new Error(r2.error ? String(r2.error.message || r2.error.code || r2.error) : '创建被拒')
            }
            const w = r2.value && r2.value.workspace
            if (!w || !w.workspaceId) return
            store.set({ error: '' })
            doOpenWorkspace(w.workspaceId)
          })
          .catch(function (err) {
            store.set({ error: '新建工作区失败：' + String((err && err.message) || err) })
          })
      } catch (err) {
        store.set({ error: '新建工作区失败：' + String((err && err.message) || err) })
      }
    }

    /** L1：进入一个已有工作区（打开它最近的一段会话；没有就新建一段）。 */
    function doOpenWorkspace(wid) {
      try {
        const w = (live.workspaces || []).filter(function (x) { return x.id === wid })[0]
        store.set({ page: null, menu: false, workspaceId: wid })
        const ids = (w && w.sessionIds) || []
        if (ids.length) doOpenSession(ids[0])
        else doNewSession()
      } catch (err) {
        store.set({ error: '打开工作区失败：' + String((err && err.message) || err) })
      }
    }

    /* ★ 2026-09-22（用户第 1 条）：`doOpenDshSettings()` **已整体删除**。
       原话「界面设置还是没用，直接删了吧」。
       删掉的理由（原注释已记录、这里留一句以免有人再试）：
       DSH 的设置面板是 `sidebar.settings` 槽的**模态**，其开合被明确写为
       component-local viewing state —— **没有服务能程序化打开它**；
       唯一路径是"放出侧栏 + 点 aria-label 为「设置」的按钮"，实测不可靠。
       ⚠ 别再复活它：半坏的功能比没有更糟。 */

    /** 进入 ED（用户决议：放完自动回）。 */
    function enterEd() {
      store.set({ ed: true, menu: false, page: null })
      const m = manifestBox.m
      const ed = m && m.bgm && m.bgm.ending
      if (ed && audio.el) {
        try {
          const url = assetURL(ed)
          audio.playlist = [url]; audio.index = 0; audio.current = url
          audio.el.src = url
          audio.el.play().catch(function () {})
        } catch (_e) { /* 静默 */ }
      }
      // 兜底：万一音频被浏览器拦住，5 分钟后也自动回
      setTimeout(function () { if (store.get().ed) exitEd() }, 5 * 60 * 1000)
    }

    function exitEd() {
      if (!store.get().ed) return
      store.set({ ed: false })
      const m = manifestBox.m
      if (m && settingsBox.s && settingsBox.s.bgm) setBgm(m, isDarkBody(), false)
    }

    /** 写设置：本地先应用（即时反馈），再推给宿主持久化。 */
    function applySettings(patch) {
      const next = Object.assign({}, settingsBox.s || {}, patch)
      settingsBox.s = next
      /* ★★★ 2026-09-20：改角色时要**同时**写 store 的 `character`。
         原因同 §9 启动路径那条注释：`scene` 由 `st.character` 推出，
         只写 `settings` 不会让画面跟着换人（设置面板里点"金鹿"看起来没反应）。
         `patch.character` 存在时才写，其余设置项不动它。 */
      const upd = { settings: next }
      if (patch && patch.character) upd.character = patch.character
      store.set(upd)
      pushSettings(patch).catch(function (err) {
        store.set({ error: String((err && err.message) || err) })
      })
    }

    // ==================================================================
    // §9.5 自建挂载（★ 不再走插槽）
    // ==================================================================
    //
    // 为什么放弃 `shell.overlay`：
    //   实测 `slotErrors: ["shell.overlay"]` —— 三条注册全部成功
    //   （injected:true / registered:true / error:null），槽里也确实有两个条目，
    //   但**渲染 SkinRoot 时抛出异常**，被 DSH 自己的 `SlotErrorBoundary` 接管，
    //   永久显示成 `<div data-slot-error="shell.overlay">` 占位。
    //   而我们的 `SkinErrorBoundary` 没兜到（抛点在我的边界之外），
    //   所以连 `componentDidCatch` 都没触发，`clientErrors` 一直是空的 —— 查了三轮。
    //
    // 自建容器彻底绕开这条链路：
    //   · 不依赖槽的声明时机、优先级、错误边界
    //   · 抛错由**我们自己的**错误边界接住，能报到宿主、能自愈
    //   · 层级用 fixed + 极大 z-index，比 overlayLayer(z-index:20) 更可控
    //
    // 容器 `pointer-events: none`，`.myh-root` 自带 `pointer-events: auto`，
    // 所以默认不挡 DSH 的交互；只有皮肤自己的元素接收点击。

    let skinContainer = null
    let skinReactRoot = null

    /**
     * 逐个检查挂载链上用到的组件引用，把 `null`/`undefined` 的挑出来。
     *
     * 为什么要这个：`jsx()` 抛 `Cannot read properties of null (reading 'key')`
     * 意味着传进去的 **type 是 null**，但错误栈只指向 `h`，看不出是哪一个。
     * 所以挂载前先把所有引用体检一遍 —— 一次就能定位。
     */
    function auditComponentRefs() {
      const refs = {
        React: React, ReactDOMClient: ReactDOMClient,
        jsxRuntime: jsxRuntime, 'jsxRuntime.jsx': jsxRuntime && jsxRuntime.jsx,
        h: h,
        Fragment: Fragment,
        SkinErrorBoundary: SkinErrorBoundary, SkinRoot: SkinRoot,
        Sprite: Sprite, Menu: Menu, MenuItem: MenuItem,
        Button: Button, Wood: Wood, TitlePage: TitlePage,
        ConfigPage: ConfigPage, EdLayer: EdLayer,
        /* ★ 2026-09-22：`Row` / `Switch` 两个旧组件已随原著五页签重做删除。
           ⚠ 必须从这张表里**同时**删掉 —— 留着的话它们是 `undefined`，
             会进 `bad` → 挂载前判定"组件引用异常"→ **整个皮肤不挂载**（比 lint 红灯严重得多）。 */
        SessionSensor: SessionSensor,
      }
      const bad = []
      for (const k of Object.keys(refs)) {
        const v = refs[k]
        // ⚠ 注意：`React.Fragment` 是 `Symbol.for('react.fragment')`，
        //   `typeof` 是 `'symbol'` —— **既不是 function 也不是 object**。
        //   第一版体检只放行 function/object，于是把合法的 Fragment 判成异常，
        //   自己把挂载拦下来了（"组件引用异常：Fragment"）。symbol 必须放行。
        if (v === null || v === undefined) { bad.push(k); continue }
        const t = typeof v
        if (t !== 'function' && t !== 'object' && t !== 'symbol') bad.push(k)
      }
      return { bad: bad, all: Object.keys(refs).map(function (k) { return k + '=' + typeof refs[k] }) }
    }

    function mountSkinRoot() {
      if (killed || KILLED_AT_LOAD) return null
      if (skinReactRoot) return skinReactRoot
      try {
        // 先体检：任何一个组件引用是 null 都会让 jsx() 崩在这里
        const audit = auditComponentRefs()
        if (audit.bad.length) {
          noteWarning('组件引用异常：' + audit.bad.join(', '))
          reportToHost({ stage: 'mount-refs-bad', errors: [audit.bad.join(', ') + ' || ' + audit.all.join(' ')] })
          return null
        }

        // ★ hooks 取证三脚架：必须在首次渲染**之前**装好，否则第一帧就漏掉了。
        const wrapped = installHookTripwire()

        // ★★ 清掉**别的实例**留下的根节点。
        //   页面里如果同时存在两份皮肤代码（旧 bundle 实例没退场 + 新实例挂上），
        //   DOM 上就会有两个 #myh-skin-root、两棵树互相打架，
        //   表现出来就是"有的地方在动、有的地方不动"——极难从代码上猜。
        //   这里把带别的实例号的一律移除，并把这件事上报（这就成了可复现的证据）。
        const stale = []
        try {
          const all = document.querySelectorAll('[id="myh-skin-root"]')
          for (let i = 0; i < all.length; i++) {
            const old = all[i]
            const tag = old.getAttribute('data-myh-instance') || '(无)'
            if (tag !== INSTANCE_ID) {
              stale.push(tag)
              try { old.remove() } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }

        const el = document.createElement('div')
        el.id = 'myh-skin-root'
        el.setAttribute('data-myh-instance', INSTANCE_ID)
        el.setAttribute('data-myh-build', BUILD_ID)
        // 定位在 body 上、盖住整个视口；不参与 DSH 的网格布局
        el.setAttribute('style', [
          /* ★★★ 2026-09-20：从 2147482000 降到 900。
            旧值把 DSH 的**所有浮层**都盖住了（实测 DSH 自己的层级最高到 1100：
            下拉菜单 / 弹窗 / toast 都在那一档），于是"右侧选择模型的按钮按了弹不出选项"。
            层级体系（实测自 DSH 源码）：
              1~20     DSH 布局内部
              100      conversation 的固定件
              1100     ★ DSH 的浮层（菜单/弹窗/toast）—— **必须留在皮肤之上**
            皮肤取 900：在正文之上、在 DSH 浮层之下。
            · 正文层 .myh-column   z=4
            · 皮肤交互层 .myh-over z=8
            · composer 座位取 901 —— 只需盖过皮肤根，不需盖过 DSH 浮层。 */
          'position:fixed', 'inset:0', 'z-index:900',
          'pointer-events:none', 'overflow:hidden',
        ].join(';'))
        document.body.appendChild(el)
        skinContainer = el
        skinReactRoot = ReactDOMClient.createRoot(el)

        reportToHost({
          stage: 'mount',
          autoProbe: {
            instance: INSTANCE_ID,
            build: BUILD_ID,
            hookWrapped: wrapped,
            hookFrames: hookFrames.slice(-4),
            staleRemoved: stale,
            rootCountAfter: (function () {
              try { return document.querySelectorAll('[id="myh-skin-root"]').length } catch { return -1 }
            })(),
            fnBytes: (function () { try { return String(SkinRoot).length } catch { return -1 } })(),
          },
        })

        // ★ 不再用 `jsx()` 直接包组件树 —— 改用 React.createElement。
        //   实测 `jsx(SkinErrorBoundary, null, h(SkinRoot, null))` 在浏览器里
        //   抛 `Cannot read properties of null (reading 'key')`（type 变 null），
        //   而 createElement 对同样入参没有任何额外校验，行为更可预测。
        //   子组件内部继续用 jsx()（那是标准用法，没问题）。
        skinReactRoot.render(
          React.createElement(SkinErrorBoundary, null,
            React.createElement(SkinRoot, null)))

        // ★ 自动回传渲染结果 —— 这样"挂载后 DOM 到底长什么样"不用靠用户复制粘贴。
        //   注意：React 的 render 是异步的，所以分两拍采样：
        //   200ms 看"首次渲染落地没有"，1400ms 看"数据回来之后长什么样"。
        const probe = function (label) {
          return function () {
            try {
              const el = document.getElementById('myh-skin-root')
              const rootEl = document.querySelector('.myh-root')
              const allRoots = document.querySelectorAll('.myh-root')
              let nodes = []
              try {
                nodes = Array.from((el && el.querySelectorAll('*')) || []).slice(0, 40).map(function (e) {
                  return e.tagName.toLowerCase() + '.' + String(e.getAttribute('class') || '').split(' ').filter(Boolean).slice(0, 2).join('.')
                })
              } catch { nodes = [] }
              const w = function (s) {
                try { return Array.from(document.querySelectorAll(s)).map(function (e) {
                  return (e.getAttribute('class') || '') + (e.getAttribute('src') ? '<-' + String(e.getAttribute('src')).slice(-42) : '')
                }) } catch { return [] }
              }
              const allRootEls = Array.from(document.querySelectorAll('[id="myh-skin-root"]'))
              sampleHookTripwire()
              reportToHost({
                stage: 'probe-' + label,
                build: BUILD_ID,
                autoProbe: {
                  // ★ 这些字段必须放在 autoProbe **内部** ——
                  //   宿主的探针留存写的是 `body.autoProbe || body`，
                  //   放外面会被丢掉（我踩过：guard 字段一直看不到）。
                  //
                  // ★★ 这个对象**必须能过 JSON.stringify** —— 曾经把 el 本体塞进来，
                  //    onmessage 转发时静默抛错，于是"探针上报"这条链路一次都没走通，
                  //    而我一直以为是自己读得不对。任何 DOM 节点一律转成字符串/计数。
                  build: BUILD_ID,
                  instance: INSTANCE_ID,
                  bundleBytes: (function () {
                    try { return String(SkinRoot).length } catch { return -1 }
                  })(),
                  rootCount: allRootEls.length,
                  rootTags: allRootEls.map(function (e) { return e.getAttribute('data-myh-instance') || '(无)' }),
                  domNodes: nodes,
                  domNodeCount: nodes.length,
                  hookFrames: hookFrames.slice(-8),
                  lastHook: lastHookSnapshot,
                  internals: internalsShape(),
                  blockReason: svc.blockReason || null,
                  hasTitlebar: !!document.querySelector('.myh-titlebar'),
                  hasColumn: !!document.querySelector('.myh-column'),
                  hasTranscript: !!document.querySelector('.myh-transcript'),
                  guard: {
                    killed: killed, killedAtLoad: KILLED_AT_LOAD,
                    hasManifest: !!manifestBox.m,
                    hasSettings: !!store.get().settings,
                    enabled: !!(store.get().settings && store.get().settings.enabled),
                  },
                  container: !!el,
                  containerChildren: el ? el.children.length : -1,
                  containerOuterStart: el ? String(el.innerHTML).slice(0, 240) : null,
                  rootNodes: allRoots.length,
                  // ★ 逐个列出真实存在的节点，不再靠统计数字推断
                  nodes: {
                    root: w('.myh-root'),
                    bg: w('.myh-bg'),
                    sprite: w('.myh-sprite'),
                    band: w('.myh-band'),
                    say: w('.myh-say'),
                    hotzone: w('.myh-hotzone'),
                    menu: w('.myh-menu'),
                  },
                  // ★ 立绘站位几何（2026-09-21 修出框）：把立绘盒子的 left/right 与**容器宽**
                  //   一起报出来 —— overflowLeft/overflowRight ≤ 0 就是"在画面内"的机械判据，
                  //   不用靠肉眼。全是数字/字符串，JSON 安全（红线：诊断字段放 autoProbe 内部）。
                  spriteGeom: (function () {
                    try {
                      const e = document.querySelector('.myh-sprite')
                      if (!e) return null
                      const st = document.querySelector('.myh-stage')
                      const r = e.getBoundingClientRect()
                      const c = st ? st.getBoundingClientRect() : null
                      return {
                        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
                        containerW: c ? Math.round(c.width) : -1,
                        overflowLeft: c ? Math.round(c.left - r.left) : null,
                        overflowRight: c ? Math.round(r.right - c.right) : null,
                        natW: e.naturalWidth, natH: e.naturalHeight,
                        ar: (getComputedStyle(e).getPropertyValue('--myh-sprite-ar') || '').trim(),
                      }
                    } catch { return null }
                  })(),
                  rootBox: rootEl ? (function () {
                    const r = rootEl.getBoundingClientRect()
                    const s = getComputedStyle(rootEl)
                    return { w: Math.round(r.width), h: Math.round(r.height), display: s.display, vis: s.visibility, op: s.opacity }
                  })() : null,
                  skinAttr: document.body.getAttribute('data-myh-skin'),
                  store: (function () {
                    const s = store.get()
                    return {
                      ready: s.ready, scene: s.scene,
                      bg: s.bg ? String(s.bg).slice(-40) : '(空)',
                      sprite: s.sprite ? String(s.sprite).slice(-32) : '(空)',
                      settingsEnabled: !!(s.settings && s.settings.enabled),
                      error: s.error,
                      /* ★ 2026-09-20：**数据链路的三个数**（"正文为什么不显示"只能靠它们区分）。
                         缺了这三个数时，"传感器没跑"和"跑了但没数据"长得一模一样。 */
                      msgs: (s.messages || []).length,
                      line: s.line ? String(s.line).slice(0, 40) : '(空)',
                      agent: s.agent,
                    }
                  })(),
                  manifestLoaded: !!manifestBox.m,
                  // ★ 版面测量结果（诊断"输入框/审批卡有没有被热区吃掉"要看这个）：
                  //   composerTop = 输入框上沿，热区的洞②就挖在这一条
                  //   guard = 是否因为 DSH 有审批卡/对话框而让位
                  layout: svc.layout || null,
                  guard: (function () {
                    const hz = document.querySelector('.myh-hotzone')
                    return {
                      armed: hz ? hz.getAttribute('data-armed') : null,
                      guard: hz ? hz.getAttribute('data-guard') : null,
                      uiNeedsPointer: uiNeedsPointer(),
                      composerTop: svc.layout ? svc.layout.composerTop : null,
                      composerH: svc.layout ? svc.layout.composerH : null,
                      hole: svc.layout
                        ? [svc.layout.holeL, svc.layout.holeT, svc.layout.holeR, svc.layout.holeB]
                        : null,
                      // ★ 三个候选选择器各自的现场（Q14：分清"没渲染"和"被藏了"）
                      composerCandidates: composerCandidates(),
                    }
                  })(),
                  /**
                   * ★★ 2026-09-20 补：**外壳盒 vs 视口 vs 皮肤根** 三方对账。
                   *
                   * 用户报告「背景上下/左右漏出桌面」。已确认 `.myh-bg` 在它自己的视口里是
                   * 100%×100%（探针报 `.myh-root` = 1912×1115），但**用户截图上的画面是 16:9**，
                   * 与 1912×1115（1.715）对不上 → "皮肤看到的视口"与"用户看到的窗口"可能不是同一个。
                   *
                   * 这组字段一次分清三种可能：
                   *   ① `viewport` 本身就 ≠ 用户窗口 → 问题不在皮肤
                   *   ② DSH 外壳（centerCol/frame/viewArea）是 16:9 的盒子，而皮肤根被塞进了它里面
                   *      （`position:fixed` 的**包含块**会被 transform/filter/contain 祖先改掉）
                   *   ③ 皮肤根自己没铺满（`skinRootStyle` 的 inset/尺寸不对）
                   *
                   * ⚠ 只上报数字/字符串，必须能过 `JSON.stringify`（红线 7）。
                   */
                  outerBoxes: (function () {
                    const box = (el) => {
                      if (!el) return null
                      try {
                        const r = el.getBoundingClientRect()
                        const cs = getComputedStyle(el)
                        return {
                          w: Math.round(r.width), h: Math.round(r.height),
                          l: Math.round(r.left), t: Math.round(r.top),
                          display: cs.display, pos: cs.position,
                          transform: cs.transform === 'none' ? '-' : 'YES',
                          contain: cs.contain === 'none' ? '-' : cs.contain,
                          filter: cs.filter === 'none' ? '-' : 'YES',
                        }
                      } catch { return null }
                    }
                    const byCls = (frag) => {
                      try { return document.querySelector('[class*="' + frag + '"]') } catch { return null }
                    }
                    const skinEl = document.getElementById('myh-skin-root')
                    const out = {
                      viewport: {
                        w: window.innerWidth, h: window.innerHeight,
                        dpr: window.devicePixelRatio,
                        screen: screen.width + 'x' + screen.height,
                        ratio: (window.innerWidth / window.innerHeight).toFixed(4),
                      },
                      skinRoot: box(skinEl),
                      skinRootStyle: skinEl ? (skinEl.getAttribute('style') || '') : null,
                      skinAncestors: (function () {
                        const arr = []
                        let e = skinEl ? skinEl.parentElement : null
                        let d = 0
                        while (e && d < 6) {
                          const cs = getComputedStyle(e)
                          arr.push({
                            tag: e.tagName.toLowerCase(),
                            cls: String(e.getAttribute('class') || '').slice(0, 34),
                            pos: cs.position,
                            transform: cs.transform === 'none' ? '-' : 'YES',
                            contain: cs.contain === 'none' ? '-' : cs.contain,
                            filter: cs.filter === 'none' ? '-' : 'YES',
                            w: Math.round(e.getBoundingClientRect().width),
                            h: Math.round(e.getBoundingClientRect().height),
                          })
                          e = e.parentElement; d++
                        }
                        return arr
                      })(),
                      centerCol: box(byCls('centerCol')),
                      frame: box(byCls('frame')),
                      viewArea: box(byCls('viewArea')),
                      body: box(document.body),
                      html: box(document.documentElement),
                    }
                    out.verdict = (function () {
                      const v = out.viewport
                      if (!out.skinRoot) return 'skinRoot 不存在'
                      if (out.skinRoot.w === v.w && out.skinRoot.h === v.h) return '皮肤根 == 视口（铺满）'
                      return '皮肤根 ' + out.skinRoot.w + 'x' + out.skinRoot.h +
                        ' != 视口 ' + v.w + 'x' + v.h + ' → 没铺满'
                    })()
                    return out
                  })(),
                  // ★ 祖先链采样：找出"谁的背景是不透明的" —— 只有把这几层打透明，
                  //   皮肤的背景才能透出来。靠读 DSH 源码猜 class 名太不可靠。
                  backdropChain: (function () {
                    const out = []
                    let el = document.querySelector('[data-chat-flow]') || document.querySelector('[data-conversation-scroll]')
                    if (!el) el = document.querySelector('main') || document.body.firstElementChild
                    let depth = 0
                    while (el && depth < 14) {
                      const s = getComputedStyle(el)
                      out.push({
                        tag: el.tagName.toLowerCase(),
                        cls: String(el.getAttribute('class') || '').slice(0, 46),
                        bg: s.backgroundColor,
                        bgImg: s.backgroundImage === 'none' ? '-' : 'IMG',
                        z: s.zIndex,
                        pos: s.position,
                        op: s.opacity,
                      })
                      el = el.parentElement
                      depth++
                    }
                    return out
                  })(),
                  /* ★ 2026-09-20：输入框与正文的渲染实况一次性带上。
                     用户报"改了跟没改一样"时，这三种原因靠截图分不出来：
                     没命中 / 被盖住 / 数据是空的。这里一次量完。 */
                  composer: (function () { try { return composerProbe() } catch (e) { return { error: String((e && e.message) || e) } } })(),
                },
              })
            } catch (err) {
              try { reportToHost({ stage: 'probe-' + label, probeError: String((err && err.message) || err) }) } catch { /* ignore */ }
            }
          }
        }
        // ★★★ 这里原来是 `setTimeout(probe('t200'), 200)` —— 一个非常隐蔽的 bug：
        //   `probe('t200')` 是**立即调用**，返回的是 undefined，于是
        //   `setTimeout(undefined, 200)` 什么都不做。
        //   后果：探针一次都没上报过；而我却一直在根据"没有探针数据"去猜界面为什么没反应。
        //   正确写法是传函数本身（下面这个 IIFE 返回的才是 probe 函数）。
        setTimeout((function () { return probe('t200') })(), 200)
        setTimeout((function () { return probe('t1400') })(), 1400)

        // ★ 自动跑一次 h() 自检 —— "jsx 到底认不认变长 children"这件事必须自动化，
        //   否则又要用户去 Console 里手动调 __myhDebug()。
        //
        // ★★★ 2026-09-20 修：**这段自检原来会把 holder 永久留在 `document.body` 上**，
        //   造成页面多出 42px 可滚动高度（两个 holder 各 21px），
        //   表现是"本来不该有内容超出屏幕，但画面能往下滑一点、输入框被顶上去一点"。
        //   实测：`docScrollHeight 956` vs `docClientHeight 914`，差 42px，
        //   超出的 6 个节点全是 `.myh-probe-a` / `.myh-probe-b` / `.myh-probe-child`。
        //   ——**注意这不是皮肤层的问题**：皮肤根是 `fixed + overflow:hidden`，不产生滚动；
        //   这两个探针挂在 body 上、在皮肤层**之外**，所以**关掉皮肤照样能滑**。
        //   修法是"用完即卸"：读完 HTML 就把 React 树卸掉、把 holder 从 DOM 摘除。
        //   （不采用"给 body 加 overflow:hidden"——那是掩盖症状，而且会破坏 DSH 自己的滚动。）
        setTimeout(function () {
          try {
            const child = h('span', { className: 'myh-probe-child' }, 'CHILD')
            const parentA = h('div', { className: 'myh-probe-a' }, child, 'TEXT')
            const parentB = React.createElement('div', { className: 'myh-probe-b' }, child, 'TEXT')
            const holderA = document.createElement('div')
            const holderB = document.createElement('div')
            document.body.appendChild(holderA)
            document.body.appendChild(holderB)
            const rootA = ReactDOMClient.createRoot(holderA)
            const rootB = ReactDOMClient.createRoot(holderB)
            rootA.render(parentA)
            rootB.render(parentB)
            setTimeout(function () {
              const a = document.querySelector('.myh-probe-a')
              const b = document.querySelector('.myh-probe-b')
              reportToHost({
                stage: 'jsx-self-test',
                jsx: {
                  twoArg: (function () {
                    try { const e = h('div', { className: 'x' }); return e && e.props ? 'props=' + JSON.stringify(Object.keys(e.props)) : String(e) }
                    catch (err) { return 'ERR ' + err.message }
                  })(),
                  variadic: (function () {
                    try {
                      const e = h('div', { className: 'x' }, child, 'TEXT')
                      const c = e && e.props && e.props.children
                      return Array.isArray(c) ? 'array[' + c.length + ']' : String(c === undefined ? 'undefined' : typeof c)
                    } catch (err) { return 'ERR ' + err.message }
                  })(),
                  aHTML: a ? a.outerHTML.slice(0, 160) : '(未渲染)',
                  bHTML: b ? b.outerHTML.slice(0, 160) : '(未渲染)',
                  aKids: a ? a.children.length : -1,
                  bKids: b ? b.children.length : -1,
                },
              })
              // ★★ 取证完成 → 立刻撤掉探针（见上面那段注释：不撤会让页面多出 42px 可滚动高度）
              disposeProbe(holderA, rootA)
              disposeProbe(holderB, rootB)
            }, 400)
          } catch (err) {
            try { reportToHost({ stage: 'jsx-self-test', jsx: { error: String((err && err.message) || err) } }) } catch { /* ignore */ }
          }
        }, 2000)

        return skinReactRoot
      } catch (err) {
        const msg = String((err && err.stack) || (err && err.message) || err)
        noteWarning('自建挂载失败：' + msg)
        reportToHost({
          stage: 'mount-failed',
          errors: [msg.slice(0, 1200)],
          refs: (function () { try { return auditComponentRefs().all } catch { return null } })(),
        })
        return null
      }
    }

    /**
     * 拆掉一个"临时探针"：卸载 React 树 + 把 holder 从 DOM 摘掉。
     *
     * ★ 2026-09-20 新增。起因：`jsx 自检` 把两个 holder 挂到 `document.body` 上，
     * **读完 HTML 就不管了**，于是页面上永久留着两个 21px 的空 div，
     * 页面因此多出 42px 可滚动高度 —— 表现就是"本该没有超出屏幕的内容，
     * 却能往下滑一点、输入框被往上顶一点"，而且**关掉皮肤照样能滑**
     * （探针在皮肤层之外，挂在 body 上）。
     *
     * 实测证据（`probe-t1400.outerBoxes`）：`docScrollHeight 956` / `docClientHeight 914`，
     * 差 **42px**；超出的 6 个节点全是 `.myh-probe-a` / `.myh-probe-b` / `.myh-probe-child`。
     *
     * ⚠ 修的是**症状的根源**，不是掩盖：不采取"给 body 加 `overflow:hidden`"，
     *   那会破坏 DSH 自己的滚动，而且探针还是不撤。
     */
    function disposeProbe(holder, root) {
      try {
        if (root) {
          // 先卸载再摘节点 —— 反过来会留下孤儿 React 树
          setTimeout(function () { try { root.unmount() } catch { /* 已卸载过就算了 */ } }, 0)
        }
        if (holder && holder.parentNode) holder.parentNode.removeChild(holder)
      } catch { /* 尽力而为 */ }
    }

    /**
     * 扫掉残余的 jsx 自检探针（`killSkin` 时兜底调用）。
     *
     * 为什么需要它：探针 holder 挂在 `document.body` 上，**在皮肤层之外**，
     * 所以关掉皮肤（只隐藏 `.myh-root`）碰不到它们 —— 这正是
     * "皮肤关掉了也能往下滑一点"的原因。正常路径由 `disposeProbe` 收尾，
     * 这里兜"自检还在 400ms 定时器里没跑完，用户就按了 Ctrl+Shift+M"的时序。
     *
     * 只摘节点、不去 unmount React 根（这里拿不到 root 引用）——
     * 摘掉节点后 React 树自然失去宿主，React 18 会自行清理，不会泄漏成错误。
     */
    function sweepProbeHolders() {
      try {
        const marks = document.querySelectorAll('.myh-probe-a,.myh-probe-b,.myh-probe-child')
        for (let i = 0; i < marks.length; i++) {
          // 往上找到那个直接挂在 body 下的空 holder
          let el = marks[i]
          while (el && el.parentElement && el.parentElement !== document.body) el = el.parentElement
          if (el && el.parentElement === document.body && el.children.length <= 1 &&
              !el.className && !el.id) {
            el.parentNode.removeChild(el)
          }
        }
      } catch { /* 尽力而为 */ }
    }

    /** 卸载自建容器（关闭皮肤时调用）。 */
    function unmountSkinRoot() {
      try {
        if (skinReactRoot) {
          const r = skinReactRoot
          skinReactRoot = null
          setTimeout(function () { try { r.unmount() } catch { /* ignore */ } }, 0)
        }
        if (skinContainer && skinContainer.parentNode) skinContainer.parentNode.removeChild(skinContainer)
        skinContainer = null
      } catch { /* ignore */ }
    }

    /**
     * 紧急开关的键盘监听 —— 不再做成 React 组件。
     *
     * 理由：它原本注册进槽里，而槽整块被错误边界接管了，
     * 也就是说"逃生门"本身也跟着失效了 —— 这正是它最不该失效的时候。
     * 改成 apply() 里直接挂 window 监听，与 React 完全解耦。
     */
    /**
     * 紧急开关的键盘入口 —— **两个方向都要有**。
     *
     * ★ 设计缺陷修正（2026-09-17）：
     *   原来只有 `Ctrl+Shift+M = 关闭`。而关闭标记写在 localStorage 里、**每次刷新都生效**，
     *   于是"随手一按 → 之后每次打开都是默认界面 → 一条错都没有"。
     *   用户当时看到的正是这个：`killed=true` + `settings.enabled=false`，界面上毫无线索。
     *   一个只能关不能开的开关，本身就是故障源。
     *
     * 现在：
     *   · `Ctrl+Shift+M` → 关闭皮肤（**并且一定弹出看得见的横幅**）
     *   · `Ctrl+Shift+U` → 恢复皮肤（清关闭标记 + 把 settings.enabled 打开 + 重载）
     *   · 而且**每次加载**只要处于关闭态，就自动弹横幅，不用等用户记起快捷键。
     */
    function installKillHotkey() {
      try {
        window.addEventListener('keydown', function (e) {
          const ctrl = (e.ctrlKey || e.metaKey)
          if (!ctrl || !e.shiftKey) return
          const k = String(e.key || '').toLowerCase()
          if (k === 'm') {
            e.preventDefault()
            killSkin('Ctrl+Shift+M')
            // killSkin 内部已经会弹横幅（那是关闭后唯一的线索）
            return
          }
          if (k === 'u') {
            e.preventDefault()
            restoreSkin('Ctrl+Shift+U')
          }
        }, true)
      } catch (err) {
        noteWarning('紧急开关监听安装失败：' + String((err && err.message) || err))
      }
    }

    /**
     * 恢复皮肤：把**所有**关闭原因一次清干净。
     *
     * 为什么必须一次清干净：皮肤有两道独立的闸（localStorage 标记 / `settings.enabled`）。
     * 只清一道，用户刷新后还是默认界面 —— 那就是"明明按了恢复却没用"。
     */
    function restoreSkin(reason) {
      try { localStorage.removeItem(KILL_KEY) } catch { /* 存不下也要继续 */ }
      // 另一道闸在宿主设置里，走 HTTP 桥把它打开
      try {
        const body = JSON.stringify({ enabled: true, character: (settingsBox.s && settingsBox.s.character) || 'aoko' })
        const p = fetch(ROUTE + '/settings', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true,
        })
        if (p && typeof p.then === 'function') {
          p.then(function (r) { return r.text() }).catch(function () {}).then(function () {
            try { location.reload() } catch { /* ignore */ }
          })
          // 保险：即使请求挂了也在 600ms 后重载，至少 localStorage 那道闸已经清了
          setTimeout(function () { try { location.reload() } catch { /* ignore */ } }, 600)
          return
        }
      } catch { /* 走下面的兜底 */ }
      try { location.reload() } catch { /* ignore */ }
    }

    // ==================================================================
    // §10 apply()
    // ==================================================================

    const inject = ['slots']

    /**
     * 常驻调试钩子 + 注册诊断。
     *
     * 为什么要这个：skinAttr=null / root=0 / overlaySlot=1 这组现象说明
     * **组件没被挂进槽**，但 `slots.inject` 的失败路径有好几条
     * （槽没声明 / 回调没跑 / register 抛错 / 条目被顶掉），
     * 只靠外部观察分不出来。所以这里把每一步的结果都记下来，
     * 并暴露 `window.__myhDebug()`，出问题时不依赖 console 里的历史输出。
     */
    const regDiag = { injectCalls: [], registered: [], warnings: [], slotSpecs: {} }

    function noteWarning(msg) {
      try {
        regDiag.warnings.push(String(msg).slice(0, 400))
        if (regDiag.warnings.length > 30) regDiag.warnings.shift()
      } catch { /* ignore */ }
    }

    /** 注册一个槽条目，并把全过程记进 regDiag（**绝不抛**）。 */
    function registerEntry(ctx, slotName, options, Component, label) {
      const rec = { label: label, slot: slotName, id: options.id, injected: false, registered: false, error: null }
      regDiag.injectCalls.push(rec)
      try {
        // 先记录槽的声明情况（spec 存在与否是"槽有没有被声明"的直接证据）
        try {
          if (ctx.slots && typeof ctx.slots.spec === 'function') {
            const spec = ctx.slots.spec(slotName)
            regDiag.slotSpecs[slotName] = spec ? { kind: spec.kind, scope: spec.scope } : null
          }
        } catch { /* spec() 不可用就算了 */ }

        ctx.slots.inject(slotName, function () {
          rec.injected = true
          const dispose = ctx.slots.register(
            Object.assign({ name: slotName }, options),
            Component)
          rec.registered = true
          return dispose
        })
      } catch (err) {
        rec.error = String((err && err.stack) || (err && err.message) || err).slice(0, 700)
        noteWarning('[' + label + '] ' + rec.error)
        try { console.warn('[moye-skin] ' + label + ' 注册失败：', err) } catch { /* ignore */ }
      }
      return rec
    }

    /** 供用户在 Console 调用的一站式诊断；同时**回传宿主**，便于远端读取。 */
    function installDebugHook(ctx) {
      try {
        const snapshot = function () {
          const out = {
            // ★ 最前面就是构建指纹：任何一次快照都能回答"跑的是哪一份代码"
            build: BUILD_ID,
            regDiag: regDiag,
            managerEntries: {},
            mounted: !!skinReactRoot,
            dom: {
              overlaySlot: document.querySelectorAll('[data-slot="shell.overlay"]').length,
              slotErrors: Array.from(document.querySelectorAll('[data-slot-error]')).map(function (e) {
                return e.getAttribute('data-slot-error')
              }),
              root: document.querySelectorAll('.myh-root').length,
              container: document.querySelectorAll('#myh-skin-root').length,
              skinAttr: document.body.getAttribute('data-myh-skin'),
              css: !!document.querySelector('style[data-plugin-css="dsh-skin-mahoyo/client.css"]'),
              bg: !!document.querySelector('.myh-bg'),
              sprite: !!document.querySelector('.myh-sprite'),
              say: !!document.querySelector('.myh-say'),
              containerBox: (function () {
                const el = document.getElementById('myh-skin-root')
                if (!el) return null
                const r = el.getBoundingClientRect()
                const s = getComputedStyle(el)
                return { w: Math.round(r.width), h: Math.round(r.height), z: s.zIndex, pe: s.pointerEvents }
              })(),
              rootBox: (function () {
                const el = document.querySelector('.myh-root')
                if (!el) return null
                const r = el.getBoundingClientRect()
                const s = getComputedStyle(el)
                return { w: Math.round(r.width), h: Math.round(r.height), display: s.display, vis: s.visibility, op: s.opacity }
              })(),
            },
            store: (function () {
              const s = store.get()
              return {
                ready: s.ready, error: s.error,
                enabled: !!(s.settings && s.settings.enabled),
                character: s.character, scene: s.scene,
                hasBg: !!s.bg, hasSprite: !!s.sprite,
                /* ★ 台词链路取证：这三项直接回答"正文为什么空"
                   lineLen  > 0 而 msgCount = 0 → 解析出问题
                   lineLen == 0 而 msgCount = 0 → 快照本身没数据（或 chat 没到） */
                lineLen: typeof s.line === 'string' ? s.line.length : -1,
                msgCount: Array.isArray(s.messages) ? s.messages.length : -1,
                msgRoles: Array.isArray(s.messages)
                  ? s.messages.map(function (m) { return m.role }).join(',')
                  : '',
                /* ★ 2026-09-23：**消息到底挂在哪个会话上**。
                   用户报「新建聊天发第一句，发完就不见了」时，缺这个字段就无法区分
                   「消息没进 store」与「消息进了别的会话」—— 两者在别的数上长得一样。 */
                sessionId: (function () {
                  try { return s.sessionId || null } catch (_e) { return 'ERR' }
                })(),
              }
            })(),
            /* ★ 只读：原始 ChatSnapshot 的形状摘要。
               ⚠ 只上报**键名与否**，绝不把快照本体塞进来（红线 7：必须能过 JSON.stringify）。 */
            chat: (function () {
              const c = debugChat.snapshot
              if (!c) return { present: false }
              const out = { present: true, keys: Object.keys(c) }
              try {
                out.orderLen = Array.isArray(c.order) ? c.order.length : -1
                out.nodesType = c.nodes ? (c.nodes.constructor && c.nodes.constructor.name) || typeof c.nodes : 'none'
                out.nodesSize = c.nodes && typeof c.nodes.size === 'number' ? c.nodes.size
                  : (c.nodes && typeof c.nodes.getSnapshot === 'function' ? c.nodes.getSnapshot().length : -1)
                out.nodesHasGet = !!(c.nodes && typeof c.nodes.get === 'function')
                const lg = c.legacy
                out.legacyKeys = lg ? Object.keys(lg) : null
                out.legacyNodesLen = lg && Array.isArray(lg.nodes) ? lg.nodes.length : -1
                out.partialPresent = !!(lg && lg.partial)
                out.runningCallsLen = lg && Array.isArray(lg.runningCalls) ? lg.runningCalls.length : -1
                out.readBack = readMessages(c).length
                out.extractLen = extractAssistantText(c).length
              } catch (err) {
                out.err = String((err && err.message) || err)
              }
              return out
            })(),
          }
          for (const slot of ['shell.overlay', 'conversation.input.right']) {
            try {
              out.managerEntries[slot] = (ctx.slots && typeof ctx.slots.entries === 'function')
                ? ctx.slots.entries(slot).map(function (e) {
                  return { id: e.options && e.options.id, order: e.options && e.options.order }
                })
                : 'entries() 不可用'
            } catch (err) {
              out.managerEntries[slot] = 'entries() 抛错：' + String((err && err.message) || err)
            }
          }
          /* ★ 2026-09-21：L1「新建工作区」依赖的两个远程面**到底注入成功没有**。
             没这个字段时，点下去"无报错、无对话框、无 UI"有三种解释无法区分：
             ① 注入没成功、但被吞了 ② pick() 永远 pending ③ 动作没触发。
             ⚠ 只报"在不在 + 方法在不在"，绝不把服务对象本身塞进来（红线 7：必须能过 JSON.stringify）。 */
          out.remotes = {
            directoryPicker: remotes.directoryPicker
              ? { ok: true, pick: typeof remotes.directoryPicker.pick === 'function' }
              : { ok: false },
            workspace: remotes.workspace
              ? { ok: true, create: typeof remotes.workspace.create === 'function' }
              : { ok: false },
          }
          return out
        }

        window.__myhDebug = function () {
          const out = snapshot()
          // ★ 本次自检挂出去的临时 holder（读完由 disposeProbe 撤掉，见其注释）
          const probeHolders = []

          // ---- h() 自检：直接验证 json-runtime 的 jsx 是否接收"变长子参数" ----
          // 背景：实测 .myh-root 渲染出来了、尺寸也对，但里面**一个子节点都没有**
          // （连无条件渲染的 hotzone / menu 都不在）。所以要么 jsx 签名不同，
          // 要么 React.createElement 才是这里唯一可用的构造方式。这段自检直接给答案。
          try {
            const probeChild = h('span', { className: 'myh-probe-child' }, 'CHILD')
            const probeParentA = h('div', { className: 'myh-probe-a' }, probeChild)
            const probeParentB = React.createElement('div', { className: 'myh-probe-b' }, probeChild)
            out.jsxSelfTest = {
              hIsFunction: typeof h === 'function',
              jsxIsFunction: typeof (jsxRuntime && jsxRuntime.jsx) === 'function',
              jsxsIsFunction: typeof (jsxRuntime && jsxRuntime.jsxs) === 'function',
              createElementIsFunction: typeof React.createElement === 'function',
              // jsx 只传 2 个参数时的结果
              twoArgType: (function () {
                try { const e = h('div', { className: 'x' }); return e && e.type ? String(e.type) : String(e) } catch (err) { return 'ERR ' + err.message }
              })(),
              // jsx 传变长 children（我们到处在用的形式）
              variadicChildren: (function () {
                try {
                  const e = h('div', { className: 'x' }, probeChild, 'TEXT')
                  const c = e && e.props && e.props.children
                  return { hasProps: !!(e && e.props), childrenType: Array.isArray(c) ? 'array[' + c.length + ']' : typeof c, children: c === undefined ? 'undefined' : 'ok' }
                } catch (err) { return 'ERR ' + err.message }
              })(),
              // 真的插进 DOM 看浏览器怎么理解
              // ★ 2026-09-20：holder 与 root 都要**留引用**，读完后交给 disposeProbe 撤掉
              //   （原来只 append、不撤 → 页面多出 42px 可滚动高度，见 disposeProbe 注释）
              domA: (function () {
                try {
                  const holder = document.createElement('div')
                  document.body.appendChild(holder)
                  const r = ReactDOMClient.createRoot(holder)
                  r.render(probeParentA)
                  probeHolders.push([holder, r])
                  return 'rendered'
                } catch (err) { return 'ERR ' + err.message }
              })(),
              domB: (function () {
                try {
                  const holder = document.createElement('div')
                  document.body.appendChild(holder)
                  const r = ReactDOMClient.createRoot(holder)
                  r.render(probeParentB)
                  probeHolders.push([holder, r])
                  return 'rendered'
                } catch (err) { return 'ERR ' + err.message }
              })(),
            }
            // 稍后读回这两个 holder 的真实 HTML，读完立刻撤掉
            setTimeout(function () {
              try {
                const a = document.querySelector('.myh-probe-a')
                const b = document.querySelector('.myh-probe-b')
                reportToHost({
                  stage: 'jsx-self-test',
                  jsxSelfTest: {
                    aHTML: a ? a.outerHTML.slice(0, 200) : '(没渲染出来)',
                    bHTML: b ? b.outerHTML.slice(0, 200) : '(没渲染出来)',
                    aChildCount: a ? a.children.length : -1,
                    bChildCount: b ? b.children.length : -1,
                  },
                })
              } catch { /* ignore */ }
              // ★ 取证完毕 → 撤掉探针，别把 21px×2 留在页面上
              probeHolders.forEach(function (pair) { disposeProbe(pair[0], pair[1]) })
              probeHolders.length = 0
            }, 400)
          } catch (err) {
            out.jsxSelfTest = { error: String((err && err.message) || err) }
          }

          try {
            fetch(ROUTE + '/health', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ stage: 'debug-snapshot', snapshot: out }),
              keepalive: true,
            }).catch(function () {})
          } catch { /* ignore */ }
          return out
        }

        /**
         * ★ 只读：原始 ChatSnapshot 的形状 + 解析结果（2026-09-21）。
         *
         * 用途：`readMessages` / `extractAssistantText` 的输入只有在这里拿得到
         * （React 闭包里的 `useChat` 从外部调不了，会抛 #321）。
         * 所以"正文为什么空"的取证方式是：
         *     window.__myhChat()
         * 它回答五件事：
         *   · present      —— 快照到底有没有到传感器
         *   · keys         —— 顶层键真实是哪些
         *   · orderLen / nodesSize / nodesHasGet —— 主路径能不能走
         *   · legacyNodesLen / partialPresent    —— 兼容投影层有没有内容
         *   · readBack / extractLen              —— 解析函数实际吐出多少
         * 纯只读：不写 store、不改 DOM、返回值必须能过 JSON.stringify（红线 7）。
         */
        window.__myhChat = function () {
          const c = debugChat.snapshot
          if (!c) return { present: false, hint: '传感器还没把快照写进来（皮肤可能被拦/未挂载）' }
          const out = { present: true, keys: Object.keys(c) }
          try {
            out.orderLen = Array.isArray(c.order) ? c.order.length : -1
            out.nodesType = c.nodes ? ((c.nodes.constructor && c.nodes.constructor.name) || typeof c.nodes) : 'none'
            out.nodesSize = c.nodes && typeof c.nodes.size === 'number'
              ? c.nodes.size
              : (c.nodes && typeof c.nodes.getSnapshot === 'function' ? c.nodes.getSnapshot().length : -1)
            out.nodesHasGet = !!(c.nodes && typeof c.nodes.get === 'function')
            const lg = c.legacy
            out.legacyKeys = lg ? Object.keys(lg) : null
            out.legacyNodesLen = lg && Array.isArray(lg.nodes) ? lg.nodes.length : -1
            out.partial = lg && lg.partial
              ? { blocks: Array.isArray(lg.partial.blocks) ? lg.partial.blocks.length : -1 }
              : null
            out.runningCallsLen = lg && Array.isArray(lg.runningCalls) ? lg.runningCalls.length : -1
            const msgs = readMessages(c)
            out.readBack = msgs.length
            /* 只报角色与长度，**不报正文** —— 避免把会话内容塞进诊断体 */
            out.roles = msgs.map(function (m) { return m.role + ':' + String(m.text || '').length })
            /* ★ 2026-09-23：**原始 kind 直方图**（只报 kind 名与计数，不报正文）。
               为什么要它：`context` 与 `compaction-summary` **都**产出 `role:'notice'`，
               光看角色分不出"（上下文已压缩）"是哪一个来的 —— 而修法完全不同
               （前者是每轮的快照、要丢掉；后者是真压缩、要保留）。 */
            out.kinds = (function () {
              const h = {}
              const bump = function (n) {
                const k = (n && (n.kind || n.role)) || '(无)'
                h[k] = (h[k] || 0) + 1
              }
              try {
                if (Array.isArray(c.order) && c.nodes && typeof c.nodes.get === 'function') {
                  for (let i = 0; i < c.order.length; i++) bump(c.nodes.get(c.order[i]))
                }
                const lg2 = c.legacy
                if (lg2 && Array.isArray(lg2.nodes)) {
                  for (let j = 0; j < lg2.nodes.length; j++) bump(lg2.nodes[j])
                }
              } catch (_e) { /* 形状不符就不报 */ }
              return h
            })()
            out.extractLen = extractAssistantText(c).length
            /* 主路径与投影层分开复算，用来定位"是哪一路没给内容" */
            out.viaOrder = (function () {
              try {
                if (!Array.isArray(c.order) || !c.nodes || typeof c.nodes.get !== 'function') return -1
                let n = 0
                for (let i = 0; i < c.order.length; i++) {
                  if (normalizeNode(c.nodes.get(c.order[i]), i)) n++
                }
                return n
              } catch { return -1 }
            })()
            out.viaLegacy = (function () {
              try {
                if (!(c.legacy && Array.isArray(c.legacy.nodes))) return -1
                let n = 0
                for (let i = 0; i < c.legacy.nodes.length; i++) {
                  if (normalizeNode(c.legacy.nodes[i], i)) n++
                }
                return n
              } catch { return -1 }
            })()
            /* ★★ 2026-09-21：**逐键侦察**。
               快照里有 order / nodes / locations / navigation / timeline / legacy 六个键，
               而 `readMessages` 只读 order+nodes 与 legacy。若两者都空而界面上其实有正文，
               数据就一定在剩下的键里（最可疑的是 `timeline`）。
               这一段把每个键的**形状**报出来（类型 / 长度 / 方法名），
               用来决定该接哪一路 —— 只报结构，不报内容。 */
            out.scan = (function () {
              const s = {}
              for (const k of Object.keys(c)) {
                const v = c[k]
                if (v === null || v === undefined) { s[k] = String(v); continue }
                if (Array.isArray(v)) { s[k] = 'array[' + v.length + ']'; continue }
                if (typeof v !== 'object') { s[k] = typeof v + ':' + String(v).slice(0, 40); continue }
                const desc = { ctor: (v.constructor && v.constructor.name) || '?' }
                if (typeof v.size === 'number') desc.size = v.size
                const methods = []
                for (const mk of ['get', 'values', 'entries', 'getSnapshot', 'keys', 'at', 'some', 'items', 'turnOrder']) {
                  if (typeof v[mk] === 'function') methods.push(mk)
                }
                if (methods.length) desc.methods = methods
                if (Array.isArray(v.items)) desc.items = v.items.length
                if (Array.isArray(v.turnOrder)) desc.turnOrder = v.turnOrder.length
                s[k] = desc
              }
              return s
            })()
          } catch (err) {
            out.err = String((err && err.message) || err)
          }
          return out
        }
      } catch (err) {
        noteWarning('调试钩子安装失败：' + String((err && err.message) || err))
      }
    }

    function apply(ctx) {
      svc.ctx = ctx

      // 第一时间报到：证明"客户端 bundle 已经跑到 apply() 了"
      reportToHost({ stage: 'apply-enter', killed: killed || KILLED_AT_LOAD })

      /**
       * ★★★ 2026-09-20：**无条件的视口量测**（不看皮肤是否启用）。
       *
       * 为什么要有这个：皮肤处于**关闭态**时整条渲染链都不跑，
       * 于是"皮肤根到底多大、视口到底多大"永远拿不到——而这恰恰是本次
       * "背景铺不满/露黑边/图糊"要定案的唯一数据。
       * 用户明确要求**不再让他碰任何皮肤界面**（Q14 让界面不可用）。
       * 所以把量测挪到这里：`apply()` 一进就做，**早于所有 killed / enabled 守卫**，
       * 并且挂 resize 与 visualViewport 监听，30 秒后自动摘掉（**不留常驻定时器**）。
       *
       * ⚠ 字段一律是数字/字符串（红线 7：必须能过 `JSON.stringify`）。
       */
      try {
        let lastVp = ''
        const readVp = function (why) {
          try {
            const vw = window.innerWidth, vh = window.innerHeight
            const key = vw + 'x' + vh
            if (key === lastVp && why !== 't+3s') return
            lastVp = key
            const rootEl = document.querySelector('.myh-root')
            const bgEl = document.querySelector('.myh-bg')
            const rect = function (el) {
              if (!el) return { w: -1, h: -1, l: -1, t: -1 }
              const r = el.getBoundingClientRect()
              return { w: Math.round(r.width), h: Math.round(r.height),
                       l: Math.round(r.left), t: Math.round(r.top) }
            }
            const rootRect = rect(rootEl)
            const bgRect = rect(bgEl)

            /* ⚠ 补偿字段只做**上报**用，**不再参与任何尺寸计算**。
               实测算出 x=1.5063 / y=1.6143，那是把画面放大 1.5 倍而不是补缺口 ——
               根因是 dpr/screen/innerWidth 这组数在本机自相矛盾。留着只为取证。 */
            let scaleX = 1
            let scaleY = 1
            try {
              const physW = Math.round(screen.width * (window.devicePixelRatio || 1))
              const physH = Math.round(screen.height * (window.devicePixelRatio || 1))
              if (vw > 0 && vh > 0 && physW > 0 && physH > 0) {
                scaleX = Math.max(1, +(physW / vw).toFixed(4))
                scaleY = Math.max(1, +(physH / vh).toFixed(4))
              }
              document.documentElement.style.removeProperty('--myh-vw-scale-x')
              document.documentElement.style.removeProperty('--myh-vh-scale-y')
            } catch { /* ignore */ }
            reportToHost({
              stage: 'probe-vp-boot',
              build: BUILD_ID,
              autoProbe: {
                why: why,
                viewport: {
                  innerW: vw, innerH: vh,
                  dpr: window.devicePixelRatio,
                  screenW: screen.width, screenH: screen.height,
                  availW: screen.availWidth, availH: screen.availHeight,
                  outerW: window.outerWidth, outerH: window.outerHeight,
                  docW: document.documentElement.clientWidth,
                  docH: document.documentElement.clientHeight,
                  bodyW: document.body ? document.body.clientWidth : -1,
                  visual: window.visualViewport
                    ? (Math.round(window.visualViewport.width) + 'x' + Math.round(window.visualViewport.height))
                    : '-',
                },
                root: rootRect,
                bg: bgRect,
                scaleComp: { x: scaleX, y: scaleY },
                killedAtBoot: (killed || KILLED_AT_LOAD),
                verdict: (rootRect.w === vw && rootRect.h === vh)
                  ? '皮肤根 == 视口'
                  : ('皮肤根 ' + rootRect.w + 'x' + rootRect.h + ' != 视口 ' + vw + 'x' + vh),
              },
            })
          } catch { /* ignore */ }
        }
        readVp('boot')
        const onVp = function () { readVp('resize') }
        window.addEventListener('resize', onVp)
        if (window.visualViewport) {
          try { window.visualViewport.addEventListener('resize', onVp) } catch { /* ignore */ }
        }
        const t3 = setTimeout(function () { readVp('t+3s') }, 3000)
        // 30 秒后摘掉监听与定时器（**不留常驻定时器** —— docs/18 §1 的硬规矩）
        setTimeout(function () {
          try { window.removeEventListener('resize', onVp) } catch { /* ignore */ }
          if (window.visualViewport) {
            try { window.visualViewport.removeEventListener('resize', onVp) } catch { /* ignore */ }
          }
          clearTimeout(t3)
        }, 30000)
      } catch { /* 量测永不阻塞 apply */ }

      // 整体包一层：client 半边**任何**异常都不该让 DSH 页面出问题。
      try {
        installDebugHook(ctx)
        applyInner(ctx)
        let regs = null
        try {
          regs = (ctx.slots && typeof ctx.slots.entries === 'function')
            ? { overlay: ctx.slots.entries('shell.overlay').length }
            : null
        } catch (err) {
          noteWarning('读 entries() 失败：' + String(err && err.message || err))
        }
        reportToHost({
          stage: 'apply-done',
          cssInjected: !!document.querySelector('style[data-plugin-css="dsh-skin-mahoyo/client.css"]'),
          slots: regs,
          // ★ 把注册诊断一起报给宿主 —— 出问题时直接 GET /moye-skin/health 就能看到
          warnings: regDiag.warnings,
          injectCalls: regDiag.injectCalls,
          slotSpecs: regDiag.slotSpecs,
        })
      } catch (err) {
        const msg = String((err && err.stack) || (err && err.message) || err)
        try {
          console.error('[moye-skin] 皮肤初始化失败，已自动停用：', err)
          document.body.removeAttribute('data-myh-skin')
          document.body.removeAttribute('data-myh-tabs')
          const tag = document.querySelector('style[data-plugin="dsh-skin-mahoyo"]')
          if (tag) tag.remove()
        } catch { /* 清理失败也只能这样了 */ }
        reportToHost({ stage: 'apply-failed', errors: [msg.slice(0, 900)], warnings: regDiag.warnings })
      }
    }

    function applyInner(ctx) {
      // ---- 注入 CSS（factory 物化时执行） ----
      const cssId = 'dsh-skin-mahoyo/client.css'
      if (!killed && !KILLED_AT_LOAD && !document.querySelector('style[data-plugin-css="' + cssId + '"]')) {
        const tag = document.createElement('style')
        tag.setAttribute('data-plugin', 'dsh-skin-mahoyo')
        tag.setAttribute('data-plugin-css', cssId)
        tag.textContent = CSS
        document.head.appendChild(tag)
      }

      // ---- 紧急开关：直接挂 window 监听，不依赖 React、不依赖插槽 ----
      installKillHotkey()

      // ---- ★ 只要处于"关闭态"，就一定让用户看见 + 给一条回去的路 ----
      //
      // 关闭态有两个独立来源，而且是**静默**的：
      //   ① localStorage['moye-skin:kill']（Ctrl+Shift+M 或 ?mahoyo=off 写下的）
      //   ② 宿主设置里的 settings.enabled = false
      // 原来这两条都不弹提示：用户刷新后看到的只是"默认界面"，零线索，
      // 表现和"皮肤根本没装"完全一样。这正是 2026-09-17 卡住的那一轮。
      //
      // 延迟到设置回来之后再判 ②；①可以在当下就判。
      try {
        if (killed || KILLED_AT_LOAD) {
          showKilledBanner(killed ? '本次会话已手动关闭' : 'localStorage 里有 moye-skin:kill 标记', 'localStorage')
        }
      } catch { /* ignore */ }
      try {
        setTimeout(function () {
          try {
            const s = store.get().settings
            if (s && s.enabled === false) {
              // 这条是**设置项**关的：那个开关在皮膚自己的設定页里，
              // 而皮肤一关就没法进那个页面 —— 所以横幅必须能把 enabled 写回。
              showKilledBanner('设置里的「启用皮肤」是关的', 'settings')
            }
          } catch { /* ignore */ }
        }, 1800)
      } catch { /* ignore */ }

      // ---- 传感器：session 作用域，唯一拿得到 chat 的位置 ----
      // 这个渲染 null，不走任何视觉链路，留在槽里最省事也最可靠。
      registerEntry(ctx, 'conversation.input.right',
        { id: 'mahoyo-sensor', order: 900 }, SessionSensor, '会话传感器')

      // ---- ★ 皮肤根：自建容器挂到 body，不再注册进 shell.overlay ----
      mountSkinRoot()

      /* ---- L1 用到的远程面（点号名必须走子 fiber 注入，见 remotes 注释） ---- */
      installRemoteFaces(ctx)

      // ---- 斜杠命令：/mahoyo-character 切角色（可在无菜单时快速换人） ----
      ctx.inject(['commandUi'], function (sctx) {
        sctx.effect(function () {
          const command = sctx.get('commandUi')
          if (!command) return function () {}
          return command.register({
            name: 'mahoyo-character',
            description: '切换魔法使之夜皮肤的角色 / Switch skin character',
            available: function () { return true },
            ui: {
              kind: 'popupSelect',
              options: function () {
                const cur = (settingsBox.s && settingsBox.s.character) || 'aoko'
                return Promise.resolve(CHARACTERS.map(function (id) {
                  return {
                    id: id,
                    label: CHARACTER_CN[id],
                    detail: id === cur ? '当前' : undefined,
                    active: id === cur,
                  }
                }))
              },
              onSelect: function (option) { applySettings({ character: option.id }) },
            },
          })
        }, 'mahoyo: /mahoyo-character')
      })

      // ---- 载入 manifest + 设置 ----
      ctx.effect(function () {
        let alive = true
        Promise.all([fetchManifest(), fetchSettings()]).then(function (res) {
          if (!alive) return
          const m = res[0]
          const s = res[1]
          manifestBox.m = m
          settingsBox.s = s.value || settingsBox.s
          lexiconIndex = activeLexicon()
          spriteBox.t = buildSpriteTable(m)
          /* ★★★ 2026-09-20 修：**角色要一起写进 store**。
             原来这里只写 `settings`，**没写 `character`** —— 而 `scene` 是由
             `st.character` 推出来的（`SCENE_OF[st.character]`），
             于是界面永远停在 store 的初始值 `'aoko'` → 永远 A3/A4。
             症状：**用户在设置里选了金鹿/有珠，重载后画面还是青子**；
             只有手动点一次菜单里的角色才会切过去（那条路径才写 `character`）。
             这也直接挡住了"金鹿白天方位反过来"的验证（切不到 A5 就看不到镜像）。
             ⚠ 写成 `settings.character` 的**镜像**而不是第二份配置：设置是唯一真源。 */
          const chNow = (settingsBox.s && settingsBox.s.character) || 'aoko'
          store.set({ ready: true, settings: settingsBox.s, character: chNow, dark: isDarkBody() })
          reportToHost({
            stage: 'ready',
            character: settingsBox.s && settingsBox.s.character,
            enabled: settingsBox.s && settingsBox.s.enabled,
            scenes: Object.keys(spriteBox.t).length,
            lexicon: lexiconIndex.length,
            // ★ 重启后看这几项就知道"组件到底挂进容器没有"
            mounted: !!skinReactRoot,
            warnings: regDiag.warnings,
            injectCalls: regDiag.injectCalls,
            domRoot: document.querySelectorAll('.myh-root').length,
            domContainer: document.querySelectorAll('#myh-skin-root').length,
            overlayEntries: (function () {
              try { return ctx.slots.entries('shell.overlay').map(function (e) { return e.options && e.options.id }) }
              catch (err) { return 'entries() 抛错：' + String((err && err.message) || err) }
            })(),
          })
        }).catch(function (err) {
          const msg = String((err && err.message) || err)
          if (alive) store.set({ error: msg })
          reportToHost({ stage: 'data-failed', errors: [msg] })
        })
        return function () { alive = false }
      }, 'mahoyo: manifest + settings')
    }

    exports.apply = apply
    exports.inject = inject
    /**
     * 仅供离线自检（`skin/tools/check-client.mjs`）读取纯函数与索引表。
     * 不参与运行时逻辑；DSH 侧只读 apply / inject。
     */
    exports.__internals = {
      store: store,
      live: live,
      manifestBox: manifestBox,
      settingsBox: settingsBox,
      classifyText: classifyText,
      buildLexiconIndex: buildLexiconIndex,
      splitSentences: splitSentences,
      // ★ 2026-09-20：节点解析工具也要能被离线单测直接调
      //   （"DSH 的 assistant-step 到底认不认"这件事必须有机器判据）
      normalizeNode: normalizeNode,
      readMessages: readMessages,
      extractAssistantText: extractAssistantText,
      classifyBlocks: classifyBlocks,
      /* ★★★ 2026-09-23：Markdown 解析器也放出来给离线自检用。
         它是**纯函数**（字符串进、React 元素出），正适合离线断言 ——
         "标记有没有被解析掉"这件事必须有机器判据，不能靠肉眼看截图。 */
      mdBlocks: mdBlocks,
      mdInline: mdInline,
      mdAttachCaret: mdAttachCaret,
      /* ★ 2026-09-23：断点续播的判据也是纯函数，放出来给离线断言。
         "记住的位置该不该恢复"这件事有边界（太靠前 / 时长未知 / 离结尾太近），
         必须有机器判据 —— 全靠听感的话，回归了也发现不了。 */
      bgmResumeAt: bgmResumeAt,
      bgmKind: bgmKind,
      bgmMemo: bgmMemo,
      /* ★ 2026-09-23：立绘双槽状态机。用户报的「闪黑 / 错图 / 偏掉」三个症状
         都出自这里（细节见 Sprite 上方那段长注释）。它们是纯函数 ——
         字符串与对象进、对象出，正好离线断言。 */
      spriteInit: spriteInit,
      spriteSwap: spriteSwap,
      spriteLoaded: spriteLoaded,
      spriteOn: spriteOn,
      composerProbe: composerProbe,
      composerState: composerState,
      stepEmotion: stepEmotion,
      pickSprite: pickSprite,
      emo: emo,
      CSS: CSS,
      // ★ 供离线渲染测试用：直接跑 SkinRoot 拿元素树，能在本机抓出渲染期异常，
      //   不必把用户当调试终端使。
      renderSkinRoot: function () { return SkinRoot() },
      /** 测试用：读"已关闭"标志，确认两次情形没有互相污染。 */
      getKilled: function () { return killed || KILLED_AT_LOAD },
      /** 测试用：读渲染守卫的拒绝原因（null = 没被拦）。 */
      getBlockReason: function () { return svc.blockReason || null },
      /** 测试用：内置默认设置（离线测试要能造出"完整设置"这一情形）。 */
      defaultSettings: function () { return ui_defaultSettings() },
      /** 测试用：hooks 取证数据（离线复现 #310 现场用）。 */
      hooks: function () {
        try { sampleHookTripwire() } catch { /* ignore */ }
        return { frames: hookFrames.slice(-10), last: lastHookSnapshot, mismatch: hookMismatch() }
      },
      componentNames: {
        SkinRoot: SkinRoot, Transcript: Transcript, MessageRow: MessageRow,
        Menu: Menu, Sprite: Sprite, Wood: Wood,
      },
      loadManifest: function (m) {
        manifestBox.m = m
        lexiconCache.key = ''            // 强制重建（角色专属词表要跟着 manifest 走）
        lexiconIndex = activeLexicon()
        spriteBox.t = buildSpriteTable(m)
        return { lexicon: lexiconIndex.length, scenes: Object.keys(spriteBox.t).length }
      },
    }
    return module.exports
  },
})

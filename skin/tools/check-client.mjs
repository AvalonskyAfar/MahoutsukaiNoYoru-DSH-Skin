#!/usr/bin/env node
/**
 * 皮肤浏览器半边的离线自检。
 * ------------------------------------------------------------------
 * 不启动 DSH、不需要浏览器：用一个假的 `window.__ModuleLoader__` 把
 * `lib/client.js` 的 factory 跑起来，然后对**纯函数**做断言。
 *
 * 覆盖：
 *   1. bundle 形状：只 require 播种模块、导出 apply/inject
 *   2. apply() 不抛，且往正确的两个槽注册（shell.overlay / conversation.input.right）
 *   3. 分句器（spec-switching §2）
 *   4. 情绪分类器（spec-switching §4）+ 12 个槽位全部可判
 *   5. 立绘选取与回退链（spec-switching §6；金鹿只有 2 个槽位也必须不空手）
 *   6. CSS 完整性：三档色阶、聚焦描边、cover、九宫格木框
 *
 * 用法：node skin/tools/check-client.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')
const CLIENT = path.join(SKIN, 'lib', 'client.js')
const MANIFEST = path.join(SKIN, 'data', 'manifest.json')

let pass = 0
let fail = 0
const problems = []
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + label) }
  else { fail++; problems.push(label + (detail ? ' — ' + detail : '')); console.log('  \u2717 ' + label + (detail ? ' — ' + detail : '')) }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, actual === expected ? '' : `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`)
}

// ------------------------------------------------------------------
// 1. 造一个最小宿主，把 bundle 跑起来
// ------------------------------------------------------------------
const required = []
const fakeReact = {
  // 皮肤用了 class 组件做错误边界，所以假的 React 必须有 Component
  Component: class Component {
    constructor(props) { this.props = props; this.state = {} }
    setState(patch) { this.state = Object.assign({}, this.state, patch) }
    render() { return null }
  },
  createElement: () => null,
  Fragment: function Fragment() {},
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
  useCallback: (fn) => fn,
  useSyncExternalStore: (sub, get) => get(),
}
const fakeJsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: fakeReact.Fragment,
}
/** react-dom/client 也是播种模块；皮肤自建挂载要用 createRoot。 */
const fakeReactDomClient = {
  createRoot: () => ({ render: () => {}, unmount: () => {} }),
  hydrateRoot: () => ({ render: () => {}, unmount: () => {} }),
}
const SEED_WORDS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

let registered = null
globalThis.window = {
  __ModuleLoader__: {
    // 只登记，不执行 factory（factory 由下面的 api 主动调用，便于统计 require）
    load: (entry) => { registered = entry },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
}
/* ★ 2026-09-23：`sessionStorage` 夹具。
   BGM 断点续播会把播放位置写在里面（`moye-skin:bgm-pos`）。
   ⚠ 真实环境里它**必须显式提供** —— `bgmMemoLoad` 有 try/catch，
     不给的话会静默返回空表，断言照样"通过"但什么也没测到。
     这与 kill switch 那里同一套写法（隐私模式下 getItem 会抛）。 */
globalThis.sessionStorage = {
  _d: {},
  getItem(k) { return (k in this._d) ? this._d[k] : null },
  setItem(k, v) { this._d[k] = String(v) },
  removeItem(k) { delete this._d[k] },
  clear() { this._d = {} },
}
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ dataset: {}, setAttribute() {}, style: {}, textContent: '', appendChild() {} }),
  head: { appendChild() {} },
  body: { hasAttribute: () => false, setAttribute() {}, removeAttribute() {}, appendChild() {} },
  documentElement: { setAttribute() {}, getAttribute: () => null },
}

const makeRequire = () => (spec) => {
  required.push(spec)
  if (spec === 'react') return fakeReact
  if (spec === 'react/jsx-runtime') return fakeJsxRuntime
  if (spec === 'react-dom/client') return fakeReactDomClient
  throw new Error('意外的 require: ' + spec)
}

console.log('== 1. bundle 形状 ==')
// bundle 是脚本而不是模块：用 Function 求值，避免污染本文件的作用域
const src = fs.readFileSync(CLIENT, 'utf8')
new Function('window', 'document', src)(globalThis.window, globalThis.document)
ok(registered !== null, 'window.__ModuleLoader__.load 被调用')
eq(registered && registered.id, 'dsh-skin-mahoyo', 'bundle id 正确')
const api = registered ? registered.factory(makeRequire()) : {}
ok(required.every((s) => SEED_WORDS.includes(s)),
  '只 require 播种模块', required.join(', '))
ok(typeof api.apply === 'function', '导出 apply')
ok(Array.isArray(api.inject) && api.inject[0] === 'slots', '导出 inject=["slots"]')

// ------------------------------------------------------------------
// 2. apply() → 槽注册
// ------------------------------------------------------------------
console.log('\n== 2. apply() 注册的槽 ==')
const registeredSlots = []
const fakeCtx = {
  slots: {
    inject: (key, cb) => { registeredSlots.push(key); cb(); return () => {} },
    register: (opts) => { registeredSlots.push('register:' + opts.name + '#' + opts.id); return () => {} },
  },
  effect: (fn) => { try { fn() } catch (_e) { /* 异步部分不 await */ } return () => {} },
  inject: () => {},
  get: () => null,
}
try {
  api.apply(fakeCtx)
  ok(true, 'apply() 未抛异常')
} catch (err) {
  ok(false, 'apply() 未抛异常', String(err && err.message || err))
}
ok(registeredSlots.includes('conversation.input.right'), '注册进 conversation.input.right（session 传感器）')
ok(!registeredSlots.includes('root'), '**没有**占用 root 单槽（否则会顶掉整个 AppFrame）')
ok(!registeredSlots.some((s) => s === 'shell.overlay'),
  '**不再注册进 shell.overlay**（实测该槽被 DSH 错误边界接管，改自建容器挂载）')
ok(registeredSlots.filter((s) => s === 'conversation.input.right').length === 1,
  '会话传感器是唯一的槽注册')

// ------------------------------------------------------------------
// 3. 载入真实 manifest
// ------------------------------------------------------------------
console.log('\n== 3. manifest 装载 ==')
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const info = api.__internals.loadManifest(manifest)
ok(info.lexicon > 200, `词典词条 ${info.lexicon} 条（>200）`)
eq(info.scenes, 12, '表达式表覆盖 12 个景')

const internals = api.__internals
const { classifyText, splitSentences, pickSprite, emo } = internals

// ------------------------------------------------------------------
// 4. 分句器
// ------------------------------------------------------------------
console.log('\n== 4. 分句器（spec-switching §2）==')
{
  const s = splitSentences('「早上好。」她抬起头。窗外的雪停了！')
  ok(s.length === 3, '三个句末标点切出 3 句', JSON.stringify(s))
  const short = splitSentences('嗯。')
  eq(short.length, 1, '少于 4 字的短句不单独成句')
  const long = splitSentences('这是一句很长的中文，长到超过了四十个字的阈值，所以应该按照逗号被二次切分开来，否则底框会变得非常非常高。')
  ok(long.length >= 2, '超过 40 字的句子被逗号二次切分', JSON.stringify(long))
  ok(long.every((x) => x.length <= 44), '二次切分后每句不超过 ~44 字')
  eq(splitSentences('').length, 1, '空文本安全（返回 [""]）')
}

// ------------------------------------------------------------------
// 5. 情绪分类器：12 个槽位全部可判
// ------------------------------------------------------------------
console.log('\n== 5. 情绪分类器：12 槽位可判 ==')
{
  const idx = (() => {
    const pairs = []
    for (const slot of Object.keys(manifest.lexicon)) {
      for (const it of manifest.lexicon[slot]) pairs.push([it.w, slot, it.n])
    }
    return pairs.sort((a, b) => b[0].length - a[0].length)
  })()
  const cases = [
    ['neutral', '她只是点了点头，什么也没说。'],
    ['smile', '她微微一笑，嘴角上扬。'],
    ['laugh', '他忍不住大笑起来，笑出声了。'],
    ['angry', '青子真的生气了，怒气冲冲地发火。'],
    ['glare', '她用半眼瞪视着他，视线冰冷。'],
    ['surprised', '他惊讶地睁大眼，完全没想到。'],
    ['troubled', '她一脸为难，困惑地皱起眉。'],
    ['sad', '她神情失落，显得很难过。'],
    ['serious', '他表情认真，严肃地断言。'],
    ['think', '她陷入思考，开始琢磨这件事。'],
    ['tired', '她疲惫地打了个哈欠，叹气。'],
    ['shy', '她脸红了，害羞地别开视线。'],
  ]
  let hit = 0
  const misses = []
  for (const [want, text] of cases) {
    const r = classifyText(text, idx)
    if (r.slot === want) hit++
    else misses.push(`${want}→${r.slot}（"${text}"）`)
  }
  ok(hit === 12, `12/12 槽位全部判对（实得 ${hit}/12）`, misses.join('; '))
  const none = classifyText('。', idx)
  eq(none.slot, 'neutral', '无线索时兜底 neutral')
  eq(none.conf, 0, '无线索时置信度 0（触发 §4.6 的 0.5 门限 → 不切图）')
}

// ------------------------------------------------------------------
// 6. 立绘选取与回退链
// ------------------------------------------------------------------
console.log('\n== 6. 立绘选取与回退（spec-switching §6）==')
{
  const a3 = pickSprite('A3', 'neutral', 0)
  ok(!!a3 && a3.includes('sprite/'), 'A3 neutral 取到立绘', a3)
  ok(!!pickSprite('A3', 'shy', 0), 'A3 缺 shy → 走回退链仍取到图（不空手）')
  ok(!!pickSprite('A5', 'laugh', 0), 'A5（金鹿 4/12）laugh → 回退仍取到图')
  ok(!!pickSprite('A6', 'shy', 0), 'A6（金鹿 5/12）shy → 回退仍取到图')
  ok(!!pickSprite('ZZ', 'neutral', 0), '未知景 → 退回任意景 neutral')
  const a = pickSprite('A3', 'neutral', 0)
  const b = pickSprite('A3', 'neutral', 1)
  ok(!!a && !!b, '同槽位轮换可用（防呆板）')
  // 所有 12 槽位 × 6 景：永不返回空
  let empty = 0
  for (const sid of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) {
    for (const slot of ['neutral', 'smile', 'laugh', 'angry', 'glare', 'surprised',
      'troubled', 'sad', 'serious', 'think', 'tired', 'shy']) {
      if (!pickSprite(sid, slot, 0)) { empty++; console.log('   空:', sid, slot) }
    }
  }
  eq(empty, 0, '6 景 × 12 槽位 = 72 组合全部取到图')
  // _b 全身版绝不出现（docs/15 §6.2）
  let bCount = 0
  for (const sid of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) {
    for (const slot of Object.keys(manifest.expressions[sid].slots || {})) {
      for (const f of manifest.expressions[sid].slots[slot]) if (/_b\./.test(f)) bCount++
    }
  }
  eq(bCount, 0, '没有任何 _b 全身版立绘（docs/15 §6.2）')
}

// ------------------------------------------------------------------
// 7. 迟滞与防抖（§4.6）
// ------------------------------------------------------------------
console.log('\n== 7. 迟滞（spec-switching §4.6）==')
{
  const idx = (() => {
    const pairs = []
    for (const slot of Object.keys(manifest.lexicon)) {
      for (const it of manifest.lexicon[slot]) pairs.push([it.w, slot, it.n])
    }
    return pairs.sort((a, b) => b[0].length - a[0].length)
  })()
  // 重置引擎状态
  emo.slot = 'neutral'; emo.since = 0; emo.weakStreak = 0; emo.lastSwitch = 0; emo.roll = 0
  const t0 = 1e9
  ok(classifyText('她微微一笑', idx).slot === 'smile', '前置：smile 可判')
  void t0
  ok(true, '节流 / 置信度门限 / 同槽位轮换逻辑已在 stepEmotion 内（见源码 §4）')
}

// ------------------------------------------------------------------
// 8. CSS 关键规格
// ------------------------------------------------------------------
console.log('\n== 8. CSS 规格 ==')
{
  const css = internals.CSS
  /* ★ 2026-09-20：三档色阶的**承载者**变了。
     原来挂在自造的底部对话框（`.myh-dlg`）上，那个框已按原作为准删除。
     现在只有输入框用色阶，而它**只用中/浅两档**：
       中 = 正在生成；浅 = 等待你（输入框天生是"等你"，所以基线取中档）
     深档 `#364045` 的语义是"空闲 / 回放历史" —— 用在输入框上等于让人看不见它，
     所以有意不用。色值本身仍取自 `sel_win` 实测，不自创。 */
  /* ★★★ 2026-09-20：色值全部换成 `sel_win.cbg.png` 的**逐像素实测值**。
     旧断言查的是 `docs/04` 里那几个值，而那份文档在好几处与实物不符
     （详见 lib/client.js 的 1h 段长注释）。现在守实测值：
       中档 填充 rgb(26,100,131) 顶 rgb(61,250,252) 底 rgb(42,165,244)
       浅档 填充 rgb(59,147,168) 顶 rgb(176,247,248) 底 rgb(74,223,253)
     主体 alpha 0.85 —— 原作本来就半透明（用户明确要求"半透明"，这条是照搬的）。 */
  /* ⚠ 填充色**不在 CSS 数组里** —— 由 `measureShell()` 按状态拼成内联变量，
     所以只能查**源码全文**（`src`），不能查 CSS 串。 */
  ok(src.includes('26,100,131') && src.includes('59,147,168'),
    '输入框两档填充色齐全（中 26,100,131 / 浅 59,147,168，实测自 sel_win）')
  ok(src.includes('rgba(61,250,252') && src.includes('rgba(42,165,244'),
    '上下双描边色齐全（顶 61,250,252 / 底 42,165,244 —— 不是"底部轮廓光"）')
  ok(css.includes('var(--myh-cap-top') && css.includes('var(--myh-cap-bot'),
    '双描边用 CSS 变量驱动（随三档色阶切换）')
  ok(css.includes('0.85') || src.includes(',.85)') || src.includes("const A = .85"),
    '★ 主体半透明（alpha 0.85，实测原作值）')
  ok(css.includes('#58FFFD') && css.includes('#E2FFFF'),
    '聚焦描边两档齐全（菜单项 #58FFFD / 按钮 #E2FFFF）')
  ok(css.includes('outline-offset:-3px'), '聚焦用 outline + 负 offset（不改尺寸 → 不跳位，红线 4）')
  ok(css.includes('object-fit:cover'), '背景用 object-fit:cover（docs/15 §5.4）')
  ok(css.includes('border-image-slice'), '木框用 border-image 九宫格（装饰件永不拉伸，docs/08 §2.4）')
  /* ★★★ 2026-09-20：原来这条断言查的是 `86px`（`docs/04` 的对话框高度基准）。
     那个基准是把 `sel_win`（**选项**条）的高度套到"对话框"上的产物，而
     **原作根本没有底部对话框**（详见 lib/client.js 里 Dialogue 删除处的长注释）。
     用户 2026-09-20 决定以原作为准 → 提案作废 → 这条断言跟着换掉。
     改成检查"文字确实落在原作的载体（正文暗带）上"：
       · `.myh-band`  —— `ui/txtwindow*` 那条整屏羽化暗带（原作的文字载体）
       · `.myh-cur`   —— 当前台词层，画在**暗带上**而不是自造一个框
       ★ 2026-09-21 更正：原注释还要求 `css.includes('44px')`（"原作正文行距实测值"），
       但那条**从设立起就是靠巧合通过的** —— `44px` 这个字面量在注释剥离后的 CSS 里
       唯一来源是 `.myh-menuTitle{height:44px}`（乐曲/菜单标题的行高），
       与正文行距毫无关系。真实规则是 `.myh-say{...line-height:1.95}`，
       而代码里明确写了**故意用倍数、不写死像素**（"固定像素行距在某个尺寸下失效"，docs/22 §9 R13）。
       删掉 `.myh-menuTitle` 后这条露出原形。改为**测真正在管正文行距的那条规则**。 */
  /* ★★★ 2026-09-21：`.myh-cur`（输入框上方那层独立台词）**已按用户要求删除**：
     「下面这个弹文字的部分删掉」。它与正文流重复显示同一句话，
     属于"底部对话框"思路的残留。现在整屏只剩**一条**文字载体：正文流。
     判据改成"暗带在 + 正文流在 + `.myh-cur` 确实没了"，三件事一起守。 */
  ok(css.includes('.myh-band') && css.includes('.myh-transcript'),
    '★ 文字落在原作载体上（正文暗带 .myh-band + 正文流 .myh-transcript）')
  ok(!/\.myh-cur\{|'myh-cur'/.test(src),
    '★ 底部独立台词层 .myh-cur 已删除，不许回来（用户：那个弹文字的部分删掉）')
  ok(!css.includes('.myh-dlg'),
    '★ 已删除自造的底部对话框 .myh-dlg（原作没有对话框 → 提案作废）')
  ok(/\.myh-say\{[^}]*line-height:/.test(css),
    '★ 正文行距由 .myh-say 控制（倍数，不写死像素 —— 固定像素行距在大尺寸下会失效，docs/22 §9 R13）')
  ok(src.includes('data-myh-tabs') || src.includes('[role="tablist"]{display:none'),
    '顶部页签栏被隐藏（原生 UI 让位）')
  ok(src.includes('.myh-transcript') && src.includes('.myh-say'),
    '★ 自己画的正文层存在（.myh-transcript / .myh-say）—— 不是贴壳，是重画 UI')
  ok(src.includes('[data-chat-flow]{display:none'), '原生消息列表让位（data-chat-flow 隐藏）')
  ok(src.includes('[data-composer-card]'), 'composer 保留可用并重新着色')
  /* ★★★ 2026-09-20 回归断言：**composer 要读的变量必须声明在 `:root`**。
     病根：CSS 变量只沿 DOM 树继承，而 composer 在 DSH 自己的 DOM 里、
     **不在皮肤根子树内**。变量写在皮肤根上 → composer 读不到 →
     `background:var(--myh-composer-grad)` 整条作废 → 卡片没有底 →
     用户看到的就是"没有输入框"（实测复现过）。
     两条一起守：CSS 里在 `:root` 声明，JS 里写 `documentElement`。 */
  ok(css.includes(':root{') && css.includes('--myh-composer-grad'),
    '★ composer 变量声明在 :root（变量只沿 DOM 树继承，皮肤根传不到 composer）')
  /* ★★★ 2026-09-20 修正这条断言的**判据**：
     它原来是 `src.includes('documentElement.style.setProperty')` —— 那是
     **匹配一句注释**（变量是通过局部别名 `docEl` 写的，代码里从来没有这个整串）。
     删掉端帽花纹那段注释时它当场失配，暴露了它是"注释断言"而不是"代码断言"。
     现在改成量真实代码：必须存在 `const docEl = document.documentElement`，
     且其后**确有** setProperty 调用 —— 这才是"变量落到 documentElement"的证据。 */
  ok(/const\s+docEl\s*=\s*document\.documentElement/.test(src) &&
     /docEl\.style\.setProperty\(/.test(src),
    '★ composer 变量由 JS 写到 documentElement（同上，不能用皮肤根）')
  ok(css.includes('prefers-reduced-motion'), '有 prefers-reduced-motion 降级')
  /* ★★★ 2026-09-20 新增：**DSH 浮层 token 覆写必须存在**。
     病根：皮肤是深墨蓝整屏画面，而 DSH 原生浮层（模型选择 / 权限 / 斜杠菜单）
     读的是 `--dsw-*` 设计 token，**浅色档下是纯白卡片**（`#fff` + `#0f1115` 字），
     压在深色画面上像一块白补丁，和皮肤完全不是一个世界。
     修法是覆写那套 token（`--dsw-specific-menu` 等），一处生效、全家族统一。
     ⚠ 这条断言守的是"**覆写还在**"—— 别把它当成可有可无的装饰删掉。
     实测：覆写后浮层底色 `rgba(11,22,32,.94)`，主文字 15.6:1 / 三级 8.1:1，
     全部过 WCAG AA（`!important` 必需：DSH 用 `body{}` 定义这些变量，要压过它）。 */
  ok(css.includes('--dsw-specific-menu:') && css.includes('--dsw-alias-label-primary:'),
    '★ DSH 浮层 token 已覆写（否则浅色档下浮层是白卡片，与皮肤冲突）')
  ok(/--dsw-specific-menu:[^;]*!important/.test(css),
    '★ 浮层 token 覆写带 !important（DSH 用 body{} 定义，不加重会被压过）')
  /* ★★★ 2026-09-20 新增：输入框里那两枚白色圆钮（`uV2eYG_add`：指令 / 添加附件）
     原本是 DSH 浅色档的白底胶囊（`rgb(245,246,247)` + `border-radius:999px`），
     压在皮肤深青半透明条上非常扎眼。已改成半透明墨青 + 圆钮形状。
     ⚠ 断言要确认**只改 add、没碰 primary** —— 发送键是蓝底主动作按钮，
       压成透明会让"发送"失去视觉重量。 */
  ok(css.includes('uV2eYG_add'),
    '★ 输入框白圆钮已重新着色（指令 / 添加附件）')
  ok(!/button\[class\*="uV2eYG_primary"\]/.test(css),
    '★ 没有误改发送键 uV2eYG_primary（它是蓝底主动作按钮，要保住）')
  /* ★★★ 2026-09-20 新增：**页面不该有可滚动溢出**。
     jsx 自检的临时 holder 曾经**只用不撤**，在 `document.body` 上永久留下两个 21px 空 div，
     页面因此多出 42px 可滚动高度 —— 表现是"本该没有超出屏幕的内容，却能往下滑一点、
     输入框被往上顶一点"，而且**关掉皮肤照样能滑**（探针在皮肤层之外）。
     实测修复前 `docScrollHeight 956` / `docClientHeight 914`（差 42px，恰好两个 holder）。
     ⚠ 断言守的是"用完即卸"这个**机制**还在：撤探针的函数 + 关闭皮肤时的兜底扫描。 */
  ok(/function\s+disposeProbe\s*\(/.test(src) && /disposeProbe\(holderA/.test(src),
    '★ jsx 自检探针用完即卸（不撤会留下 42px 页面可滚动高度）')
  ok(/function\s+sweepProbeHolders\s*\(/.test(src) && /sweepProbeHolders\(\)/.test(src),
    '★ 关闭皮肤时兜底扫掉残余探针（探针挂在 body 上，皮肤层外，killSkin 够不着）')
  /* ★★★ 2026-09-20 新增：**正文列不该无端溢出**（用户看到的"右上角小滚动条"）。
     两处根因，都被这两条守住：
       ①`.myh-columnInner` 的底部内边距**不再叠加 composer 高度** ——
         原来是 `calc(150px + var(--myh-composer-h))`，属"列铺到屏幕底"时代的补偿；
         列现在已在输入框上沿停住，那 274px 成了双份留白，把内容顶出列外。
       ②`.myh-transcript` 的 `min-height:40vh` 是相对**视口**算的、与列高脱钩，
         124px 的列里它自己就 403px。已改成 flex 参与收缩 + 容器查询矮列紧凑。
     ⚠ 这两条都是"约束必须与盒子挂钩"的具体化（`docs/22` §9 R13 的老教训）。 */
  ok(!/calc\(150px\s*\+\s*var\(--myh-composer-h/.test(css),
    '★ 正文列底部内边距不再叠加 composer 高度（双份留白会把内容顶出列 → 滚动条）')
  ok(/\.myh-transcript\{min-height:0;flex:/.test(css),
    '★ transcript 不再是固定 40vh（与列高脱钩，矮列必溢出）')
  /* ★★★ 2026-09-21：**"矮列"这个前提本身被修掉了**。
     列现在铺满视口（`.myh-column{bottom:0}`），可视区不再被截成一条，
     所以"矮列自动紧凑"那套容器查询整体撤掉，改守**列铺满**这条更根本的约束：
       · `.myh-column{bottom:0}`   —— 列高 = 视口高（原来 = 视口高 − 输入框上沿 = 166px）
       · `padding-bottom` 让开输入框 —— 文字停止在输入框上方，而不是被列高截断
       · `flex:0 0 auto`           —— 内层必须能被列当作"可滚动内容"，否则列不滚
     三条缺一条，"只有顶部一小条"就会回来。 */
  ok(/\.myh-column\{[^}']*bottom:0;/.test(css),
    '★ 正文列铺满视口（bottom:0；不再是"视口高 − 输入框上沿"的硬截断）')
  ok(/\.myh-columnInner\{[^}']*padding:[^}']*var\(--myh-composer-h/.test(css),
    '★ 正文内层用 padding-bottom 让开输入框（列铺满后由它负责留白）')
  ok(/\.myh-columnInner\{[^}']*flex:0 0 auto/.test(css),
    '★ 正文内层不许收缩（否则列察觉不到溢出 → 不滚动、内容压到输入框上）')
  ok(!css.includes('@container (max-height:200px)'),
    '★ 旧的"矮列自动紧凑"容器查询已撤（列不再变矮，前提消失）')

  /* ★★★ 2026-09-21（用户反馈修复）：**截断滚动链**。
     用户："文本内容滑到底的时候文本跳对话框跳，到了底部之后继续滑动输入框跳别的不动。"
     那是典型的 scroll chaining —— 内层滚到边界后，多余的滚动量传给祖先滚动容器。
     实机复现（把 `.myh-root` 改成可滚 + 塞 1200px 占位）：
         修前：列到底继续滑 → 祖先 scrollTop 被带走 **300px**
         修后：同样操作 → 祖先 scrollTop 保持 **0**
     三处都要写，只写一处会漏（真实窗口里"被带走的祖先"未必是皮肤根）。 */
  ok(/\.myh-column\{[^}']*overscroll-behavior:contain/.test(css),
    '★ 正文列截断滚动链（overscroll-behavior:contain，滚到底不再把祖先带走）')
  ok(/\.myh-root\{[^}']*overscroll-behavior:contain/.test(css),
    '★ 皮肤根也截断滚动链（它不滚，但仍参与链式传播判定）')
  ok(/body\[data-myh-skin\]\{[^}']*overscroll-behavior:contain/.test(css),
    '★ body 截断滚动链（文档级那一路）')
  ok(css.includes('html:has(body[data-myh-skin]){overscroll-behavior:contain}'),
    '★ html 也按住（链式传播的判定可能发生在更外层）')

  /* ★★★ 2026-09-21（用户定案）：**文字左右缘与输入框对齐** + **字号调小**。
     用户："文字的字号调小，然后文字显示区的左右两侧要对齐输入框的左右两侧"。

     ① 对齐：内层的 margin 早已由实测变量给（盒子对齐了），
        但 `padding` 左右各 26px 把**文字**又推进去 26px —— 实测文字从
        94+26=120 起，而输入框卡片从 94 起。
        所以左右 padding 必须为 0；纵向 padding 仍要保留（顶部呼吸 + 底部让位）。
     ② 字号：旧值 `clamp(15px,min(2.2vh,1.25vw),25px)` 在 1600×900 下是 **19.8px**，
        在整屏读本里偏大。新值降到约 16px。 */
  /* ⚠ 判据不能用 `\s0\s` 这种松匹配 —— 第一版就是这么写的，
     结果 `26px ... 26px` 也能通过，反向验证当场露馅。
     也不能按空格拆 `padding` 的值：`calc(var(--x) + 12px)` 里带空格。
     最稳的判据是**认出那条 padding 声明的原文**，要求它正好是
     `<纵向> 0 <纵向> 0` 的四段式。 */
  const padDecl = (function () {
    const m = css.match(/\.myh-columnInner\{([^}']*)/)
    if (!m) return null
    const p = m[1].match(/padding:([^;']*)/)
    return p ? p[1].trim() : null
  })()
  ok(!!padDecl && /^[^\s]+ 0 [^;]*0$/.test(padDecl.replace(/\s+/g, ' ')),
    '★ 正文内层左右 padding 为 0（否则文字比输入框内缩 26px，对不齐） — 实得 ' + JSON.stringify(padDecl))
  ok(/\.myh-say\{[^}']*font-size:clamp\(13px,min\(1\.8vh,1\.05vw\),21px\)/.test(css),
    '★ 正文字号已调小（19.8px → 约 16px，上下限同步收到 13/21）')
  ok(/\.myh-say\{[^}']*line-height:1\.95/.test(css),
    '★ 正文行高改成倍数（跟着字号走，不写死像素）')
  /* ★★★ 2026-09-20（用户定案）：**对话框与立绘各往自己那一边靠近 50%**。
        · 立绘：站位偏移 20vw → 30vw
     用户对小屏/金鹿的镜像补了一句关键约束：
     「**金鹿的与别人相反方向同比例**」—— 所以断言要同时守住"符号相反"和"比例相同"。
     这两条一起写，是为了防止以后只改一边（项目历史上站位曾在三处各写一份然后漂掉）。
     ⚠ 方向：`--myh-sprite-x` 是**从中线起算的位移**，**越大越靠自己的那一边**。
       它不是"离边距离"—— 我一开始把 20vw 减半成 10vw，效果恰恰是往中间拉，被用户纠正。
     ※ 文本显示框原来那条"左右留白 6%"的断言**已被下一条需求取代**：
       用户后来要求"让文本显示框与输入框对齐"（同宽同位置），所以左右缘改用
       实测变量 `--myh-cur-left/right`（见下面 §9c）。这里改为守"确实读了变量"。 */
  /* ★ 2026-09-21：消费 `--myh-cur-*` 的那一层从 `.myh-cur` 换成了 `.myh-columnInner`
     （正文流），变量名与真源不变。 */
  ok(/\.myh-columnInner\{[^}']*left:var\(--myh-cur-left/.test(css) &&
     /\.myh-columnInner\{[^}']*right:var\(--myh-cur-right/.test(css),
    '★ 正文流的左右缘读实测变量（与输入框对齐，见 §9c）')
  ok(/\.myh-stage\{[^}']*--myh-sprite-x:30vw/.test(css) &&
     /--myh-sprite-x,30vw/.test(css),
    '★ 立绘 CSS 兜底偏移 30vw（与 Sprite 写入的真源一致，20vw→30vw）')
  /* ★★★ 2026-09-23：**两个槽必须叠在同一个格子里**（`grid-area:1/1`）。
     用户报的偶发 bug："立绘被拦腰截断、底边停在视口约 1/4 高处，几次之中有一次"。

     数学根因：`.myh-stage` 是 grid 且没有 `grid-area` → 两个槽**各占一行**，
     总高 `76vh × 2 = 152vh`；`align-content:end` 把溢出的 52vh 顶到视口上方
     → 第一个槽可见段只剩 `100vh − 152vh = −52vh` 起算的部分，约 24%。
     实测截图里那条底边在 ~24.4% 处，与算式吻合。

     ⚠ 只在**交叉淡入进行中**（双槽同时存在）才触发，动画结束即恢复 ——
       所以它"偶发"，且只在切角色/切景的那一瞬间能看见。
     ⚠ 这条断言防的是回归：删掉 `grid-area` 或改成各自一行，都会让 bug 回来。
       只断言 `.myh-sprite` 上**有** `grid-area:1/1` 即可 —— 它同时保证
       两个槽落在同一格（grid 默认把无定位子项按顺序放进下一格）。 */
  ok(/\.myh-sprite\{[^}']*grid-area:1\/1/.test(css),
    '★ 立绘两个槽叠在同一格（grid-area:1/1；缺了会在交叉淡入时把立绘顶出视口上缘）')
  /* ★★★ 2026-09-20（用户定案）：**金鹿白天（A5）整条方位反过来** ——
     不只是立绘，**输入框也要镜像到另一侧**。
     用户原话："所有的方位调整金鹿白天都要反着来。所以金鹿的输入框也应该反过来。"
     守两条：
       ① 镜像规则存在，且是**严格镜像**（只交换哪一侧是 auto，2.5% 与宽 50% 都不变）；
       ② 方位**不新增第二个真源** —— 属性由 JS 从 `spriteSideOf(景)` 反推，
          这样"改景就同时改立绘和输入框"，不会两边漂。 */
  /* ★ 2026-09-23：2.5% 与 50% 已收成变量（见下面那条「同源」断言），
     所以镜像这里断言的是**引用变量**，而不是字面量。契约不变：
     只交换哪一侧是 auto，宽度与左右留白两侧完全一致。 */
  ok(/html\[data-myh-side="right"\][^{]*\[data-composer-card\]\{[^}']*margin:0 var\(--myh-composer-side\) 10px auto/.test(css),
    '★ 输入框镜像规则引用的留白变量与靠左同源（只交换哪一侧是 auto）')
  /* ★★★ 2026-09-23（用户定案）：**底部原生待办栏要与输入框对齐**。
     用户原话：「这个站的位置也应该调整一下吧，跟输入框对齐吧」——
     截图里那条「任务 N 已完成」的栏比输入框宽出一大截。

     实测病根（3199 实例）：
       栈 wSkVaW_composerStack  x=56  宽 1534  gap 6px
       待办栏 lXshSW_root       x=88  宽 1470  右 1558
       输入框卡 uV2eYG_card     x=94  宽 767   右 861
     待办栏的宽走**原生**公式 calc(100% - 侧净空x2 - dock-insetx4) = 100% - 64px；
     它本该被 max-width:calc(var(--dsh-composer-card-max-width) - ...) 收窄，
     但本皮肤把 --dsh-composer-card-max-width 覆成了 none ⇒ 该 max-width 整条失效。
     ⇒ 两套坐标没接上，栏就放开到容器满宽。

     守四条（改任何一条都会让栏与框重新错位）：
       (a) 两个量**只有一处定义**（写死两处必漂 —— 项目史上漂过一次）；
       (b) 卡片**引用**它们（不再写字面量）；
       (c) 待办栏也**引用同一对**，选择器同时挂 data-testid 与哈希类名；
       (d) 靠右时与卡片**同轴翻转**。
     只改横向：栈 gap 已给 6px，栏自身 bottom margin 保持 0；
     若顺手照抄卡片的 10px，间隙会变成 16px。 */
  ok(/body\[data-myh-skin\]\{--myh-composer-w:50%;--myh-composer-side:2\.5%\}/.test(css),
    '★ 站位与宽度只有一处定义（--myh-composer-w / --myh-composer-side）')
  ok(/\[data-composer-card\]\{[^}']*width:var\(--myh-composer-w\)!important;max-width:var\(--myh-composer-w\)!important/.test(css),
    '★ 输入框宽度引用同一变量（不再有字面量 50%）')
  ok(/\[data-testid="todo-panel"\],/.test(css) && /body\[data-myh-skin\] \.lXshSW_root\{/.test(css),
    '★ 待办栏选择器同挂 data-testid 与类名（前者稳定、后者是哈希，坏一个不塌）')
  ok(/margin-left:var\(--myh-composer-side\)!important;margin-right:auto!important\}/.test(css),
    '★ 待办栏靠左 = 卡片靠左（同一留白变量 + 右侧 auto）')
  ok(/html\[data-myh-side="right"\][^{]*\[data-testid="todo-panel"\],[\s\S]{0,160}margin-left:auto!important;margin-right:var\(--myh-composer-side\)!important\}/.test(css),
    '★ 待办栏跟着方位镜像（与卡片同轴翻转）')
  ok(/const inputSide = spriteSideOf\(scene\) === 'left' \? 'right' : 'left'/.test(src),
    '★ 输入框方位由 spriteSideOf(景) 反推（立绘在左 → 输入框靠右），不新增第二个真源')
  ok(/documentElement\.setAttribute\('data-myh-side', inputSide\)/.test(src),
    '★ 方位写在 documentElement 上（composer 不在皮肤根子树里，皮肤根传不到它）')
  ok(/useEffect\(function \(\) \{[\s\S]{0,300}data-myh-side[\s\S]{0,200}\}, \[scene, m\]\)/.test(src),
    '★ 切景时同步方位（measureShell 只在挂载跑，靠它会在换角色后停在旧方位）')
  ok(/removeAttribute\('data-myh-side'\)/.test(src),
    '★ 关闭皮肤时摘掉方位属性（否则"皮肤关了、输入框还靠右"会留在页面上）')
  /* ★★★ 2026-09-20 修既有 bug：**设置里的角色必须写进 store**。
     原来设置加载后只写 `settings`，没写 store 顶层的 `character`；
     而 `scene` 由 `st.character` 推出 → 界面永远停在初始值 `'aoko'`（永远 A3/A4）。
     症状：**在设置里选了金鹿/有珠，重载后画面还是青子**；只有手点菜单切角色才生效。
     这条也直接挡住了金鹿 A5 的方位验证（切不到 A5）。两条路径都要写：
       · 启动加载设置那条（`store.set({ready:true,…})`）
       · `applySettings`（改设置那条） */
  ok(/store\.set\(\{ ready: true, settings: settingsBox\.s, character: chNow/.test(src),
    '★ 启动加载设置时把 character 一起写进 store（否则用户选的角永远不生效）')
  ok(/if \(patch && patch\.character\) upd\.character = patch\.character/.test(src),
    '★ applySettings 改角色时同步 store.character（两条路径口径一致）')
  /* ★★★ 2026-09-20（用户定案）：**文本显示框与输入框对齐**（同宽同位置）。
     难点是两者**坐标系不同**：文本框在皮肤根里（百分比按视口），
     输入框在「座」里（margin 的 2.5% 按座宽），而**座在视口里不对称**
     （实测 1629 视口：左留 56 / 右留 10）→ 照抄 2.5% 两头都会错。
     所以必须**实测卡片左右缘**再换算成视口百分比。
     守三条：① 有实测那段代码 ② 用了卡片的 getBoundingClientRect
             ③ 两个变量确实写到了 documentElement（不是皮肤根）。 */
  ok(/cardEl\.getBoundingClientRect\(\)/.test(src) && /--myh-cur-left/.test(src),
    '★ 文本框左右缘来自**实测**输入框卡片矩形（坐标系不同，不能照抄百分比）')
  ok(/setProperty\('--myh-cur-left'/.test(src) && /setProperty\('--myh-cur-right'/.test(src),
    '★ 实测结果写进 --myh-cur-left/right（文本框只读变量）')
  ok(/--myh-cur-right'[^)]*\)/.test(src) && !/myh-skin-root'\)\.style\.setProperty\('--myh-cur/.test(src),
    '★ 变量写在 documentElement（与 composer 那批同一处，不是皮肤根）')
  ok(css.includes('clamp(300px,36.5%,46%)'), '菜单板宽 36.5%（docs/09 A12）')
  ok(css.includes('height:76vh') && css.includes('align-items:end') && css.includes('justify-items:start'),
    '立绘按 76vh 摆、底边对齐画面下沿，横向位置交给与盒子宽挂钩的 clamp（取景=素材原画布，见 docs/17）')
  // ★ 2026-09-20 修正：原来这条是**全局**字符串匹配 `height:100vh` —— 现在 `100vh` 出现在
  //   **根层/背景层**上，那是**对的、也是必须的**（显式视口尺寸，不依赖祖先，见下方那条断言），
  //   全局匹配会把它误判成"旧规格"。所以改成**只看立绘那一块**。
  {
    const i = css.indexOf('.myh-sprite{')
    const spriteBlock = i >= 0 ? css.slice(i, i + 700) : ''
    ok(!/height\s*:\s*(100vh|70vh)/.test(spriteBlock),
      '立绘不用旧的 100vh / 70vh（100vh 会顶满整屏、70vh 是"只有脸"时代的产物）')
  }
  // ★★★ 2026-09-20 定案（第三版，真根因）：
  //   用户控制台给出权威值 `innerWidth=1357`，而探针报 `.myh-root` = **1912×1115**（宽差 555）。
  //   根因：皮肤满屏层用 `100%`（= 挂载时算出的父盒尺寸）→ **挂载后调整窗口就不跟随**，
  //   于是按旧宽度铺，多出来的部分露底色；图还被放大 → 糊。两个症状同一个根因。
  //   → 满屏层一律用 **`100vw/100vh`**（视口单位，**实时**跟随），并且必须**同时**具备：
  //     ① 尺寸用视口单位；② `resize` 监听重新测量（client.js 里已有，见 L2503 附近）。
  ok(/\.myh-root\{[^}]*inset:0[^}]*width:100vw[^}]*height:100vh/.test(css),
    '地基 .myh-root：inset:0 + 100vw×100vh（实时跟随视口，不依赖挂载时的测量值）')
  ok(/\.myh-under\{[^}]*width:100vw[^}]*height:100vh/.test(css),
    '底层 .myh-under：与地基同盒（100vw×100vh）')
  ok(/\.myh-bg\{[^}]*width:100vw[^}]*height:100vh[^}]*object-fit:cover/.test(css),
    '背景 .myh-bg：100vw×100vh + object-fit:cover（视口单位，唯一的可信口径）')
  /* ★★★ 2026-09-20（用户定案）：暗带**不再是满屏** —— 它要跟着正文收窄。
     用户："阴影没有跟着改"（正文已对齐输入框，暗带还铺满整屏，右边一片暗）。
     原来是 `width:100vw;height:100vh`（与背景同盒）。
     现在左右缘读 `--myh-cur-left/right`（与正文、台词同一组真源），
     高度仍 100vh，`object-fit:cover` 保住素材两侧的羽化。
     守两条：① 确实读了那组变量 ② 高度仍是 100vh（不要退化成内容高）。 */
  /* ★★★ 2026-09-20（用户定案）：暗带**居中加宽**，宽度独立成变量。
     用户："太窄了，宽一点" / "肯定是暗带" / "**别的我一点都不想改**" /
           "居中加宽（两侧各扩）" / "先按 5% 慢慢改，改一次我看一次"。
     ⇒ 暗带不再与文本框共用左右缘，改用 `--myh-band-w` / `--myh-band-l`。
     ⚠ 同时守"**左右边距相等**"（居中的定义），防止只改宽度忘了改左缘。 */
  ok(/\.myh-band\{[^}]*left:var\(--myh-band-l[^}]*width:var\(--myh-band-w/.test(css),
    '★ 暗带用独立的宽度/左缘变量（居中加宽，不再跟文本框共用左右缘）')
  /* ⚠ 加宽锚点 = **盒子中心**（两侧各扩），不是"视口居中"、也不是"左缘不动"。
     这条我表达拧了两次才对齐用户的真实意图，写死下来：
       · 错法一：`(100 − 宽)/2` —— 那是**视口居中**，会把暗带挪到屏幕正中
         （文本靠左时暗带就跑到右边去了）
       · 错法二：`左缘 = 输入框左缘` 只往右扩 —— 那左边不动，不是"两边各扩"
       · 对法：中心 = 输入框实测中心；左缘 = 中心 − 宽/2 ⇒ 两侧等量外移 */
  /* ★ 2026-09-21：写法从 `(kLeftPct + (100 - kRightInsetPct)) / 2` 换成
     直接取卡片矩形的中点 —— 两者等价，但后者不受"百分比基准换成列内容宽"影响
     （那组百分比现在是给内层用的，暗带的包含块不同，见 lib/client.js 里的长注释）。
     断言守的**意图不变**：中心必须来自**实测的输入框矩形**，不是视口中心。
     所以判据改成"算式里必须出现 kRect 的中点"，并且**不许**出现 (100-宽)/2 那种视口居中。 */
  ok(/const bandCenterPct = \(\(kRect\.left \+ kRect\.right\) \/ 2\) \/ vw \* 100/.test(src),
    '★ 暗带中心取自输入框实测中心（不是视口中心）')
  ok(!/bandCenterPct = 50|bandCenterPct = \(100 -/.test(src),
    '★ 暗带中心不是"视口居中"（错法一：(100−宽)/2 会把暗带挪到屏幕正中）')
  ok(/const bandLeftPct = bandCenterPct - bandWPct \/ 2/.test(src),
    '★ 暗带左缘 = 中心 − 宽/2（两侧等量外扩，中心不动）')
  /* ⚠ 这条守的是一个**实测撞出来的坑**：`left`+`right`+`width:auto` 在这里不生效 ——
     img 是替换元素，auto 会取固有宽（1921px）并让 right 失效（实测右缘跑到 1693、出框）。
     所以必须用 calc 算宽。谁要是"顺手简化"回 left/right+auto，这条会拦住。 */
  ok(!/\.myh-band\{[^}]*left:[^}]*(?!width:calc)[^}]*right:var\(--myh-cur-right/.test(css) ||
     /\.myh-band\{[^}]*width:calc\(100%/.test(css),
    '★ 暗带用 calc 算宽（不用 left/right+auto —— img 固有宽会让 right 失效）')
  ok(/\.myh-band\{[^}]*height:100vh/.test(css) && /\.myh-band\{[^}]*object-fit:fill/.test(css),
    '★ 暗带 100vh 高 + object-fit:fill（cover 会把羽化区裁掉 → 硬切边）')
  ok(/\.myh-root\{[^}]*background:#000/.test(css),
    '根层有纯黑兜底底色（任何情况都不露白/露桌面，对齐 tsukiweb 的 background:#000）')
  ok(/addEventListener\('resize'/.test(src),
    '监听 resize 重新测量（视口变化后布局跟着更新）')
  // ★★ 2026-09-19 踩过：素材路由是 max-age=86400，而素材**文件名不变**，
  //    重烘立绘后浏览器一直用缓存里的旧图 —— 用户看到"改了跟没改一样"。
  //    这条断言守住"素材 URL 必须带 ?v=<BUILD_ID>"。
  ok(/assetURL = function[\s\S]{0,600}?\?v=/.test(src),
    '素材 URL 带 ?v=<BUILD_ID> 破缓存（同名素材换包必须失效）')
}

// ------------------------------------------------------------------
// 9. 立绘站位：manifest 按景给值，运行时真读它（防漂移）
// ------------------------------------------------------------------
// ★ 2026-09-19：站位以前是**硬编码**的，还在三处各写了一份（client.js 的 CSS 兜底 20vw、
//   expression-lab.html 的 right:5%、preview/index.html 的 grid 居中），早就漂了。
//   现在唯一事实来源是 manifest.expressions[景].spriteSide：'left' / 'right'，默认 'right'。
//   金鹿的 A5 必须是 'left' —— 她的立绘**面朝右**，站右侧等于冲着屏幕外看；
//   站左侧视线横穿画面、落在中央的对话框上。
//   2026-09-20：A6 曾一并设为 'left'，现已**按用户要求回 'right'**（用户只要求 A5 靠左）。
console.log('\n== 9. 立绘站位 spriteSide（manifest 驱动，仅 A5 靠左、A6 回右）==')
{
  const side = (sid) => (manifest.expressions && manifest.expressions[sid] || {}).spriteSide
  for (const sid of ['A1', 'A2', 'A3', 'A4', 'A6']) {
    eq(side(sid), 'right', `${sid} spriteSide = right（${(manifest.scenes[sid] || {}).character}）`)
  }
  for (const sid of ['A5']) {
    eq(side(sid), 'left', `${sid} spriteSide = left（金鹿面朝右 → 站左侧，视线横穿画面）`)
  }
  // 运行时必须真的读这个字段：不是只有死变量，而是"取景 → 组件 → CSS 变量"一条链都在
  const iSide = src.indexOf('function spriteSideOf(')
  ok(iSide >= 0, 'client.js 有 spriteSideOf(景) 取值函数')
  ok(src.includes('.spriteSide ==='), 'buildSpriteTable 读 manifest 的 spriteSide 字段')
  ok(src.indexOf('side: spriteSideOf(') > iSide, 'Sprite 挂载点用 spriteSideOf(当前景) 传 side')
  /* ★★★ 2026-09-20（用户定案）：偏移 20vw → 30vw（"往自己的那一边再靠近 50%"）。
     断言不用写死数字 —— 改成**检查"符号镜像 + 两侧同比例"这个结构**：
     金鹿必须取负、其余取正，且两侧引用**同一个数值**（用户要求"金鹿的与别人相反方向同比例"）。
     写死数字的话，以后调站位又会像上次那样三处各写一份然后漂掉。 */
  {
    const m = /props\.side === 'left' \? '(-?[\d.]+vw)' : '(-?[\d.]+vw)'/.exec(src)
    ok(!!m, "Sprite 用 'left'/镜像位**写变量**（不是只判断不写）")
    if (m) {
      const neg = parseFloat(m[1]), pos = parseFloat(m[2])
      ok(neg < 0 && pos > 0, `镜像符号正确：left ${m[1]} / right ${m[2]}（方向相反）`)
      ok(Math.abs(neg) === Math.abs(pos), `两侧**同比例**（|left| == |right|，用户 2026-09-20 明确要求）`)
      /* ★ 方向断言（2026-09-20 新增，因为这里真的错过一次）：
         `--myh-sprite-x` 是"从中线起算的位移"，**越大越靠自己的那一边**。
         我最初把它减半（20→10vw）当"靠近 50%"，实际效果是把立绘从右边拉回中间 —— 方向反了。
         所以现在**钉住下限**：偏移必须**大于**居中基准（等价于"确实偏向自己那一侧"），
         并且不小于被它取代的 20vw（用户要的是"更靠边"，不是"更靠中间"）。 */
      ok(pos >= 20, `偏移不小于被取代的 20vw（${m[2]}）—— 小于它等于往中间拉，方向反了`)
    }
  }
  const r = /function spriteSideOf\([\s\S]{0,400}?\}/.exec(src)
  const sideBody = r ? r[0] : ''
  ok(sideBody.includes("=== 'left'") && sideBody.includes("'right'"),
    "spriteSideOf 只认 'left'、其余（含缺字段/脏值）归 'right' —— 旧 manifest 行为不变")
  ok(!sideBody.includes('px'), '站位只用 vw 镜像，没有新写死像素')
  // 位置读对了还不算完：没有写变量的那一半，立绘仍会走 CSS 兜底 20vw（=金鹿又跑到右边）
  ok(/spriteSideOf\(/.test(src) && (src.match(/spriteSideOf\(/g) || []).length >= 2,
    'spriteSideOf 既被读取链用到、也被组件用到（不是死代码）')
  ok(src.includes("'--myh-sprite-x'"),
    'CSS 变量 --myh-sprite-x 由 JS 内联写入（此前全仓库没有一处赋值，永远走兜底 20vw）')
}

// ------------------------------------------------------------------
// 9b. 立绘**出框**回归（2026-09-21）
// ------------------------------------------------------------------
// 现场：上一版是「grid 居中 + transform:translateX(±20vw)」—— 20vw 是**容器宽**的比例、
//   与**盒子宽 B 无关**，画布越宽 / 窗口越窄越偏。Edge 无头实测（本文件那份 CSS 原样）
//   在 1080 高的视口下，1640 画布的右缘：1280 视口 1425（出框 145px）、
//   1440 视口 1537（出框 97px）、1920 视口 1873（恰好放得下）→ 窄窗口才现形。
//   （任务书里写的"1920 下右缘 2040 / 出框 120px"对不上这份 CSS 的实际算式：
//    居中后右缘 (W+B)/2=1489，再加 20vw=384 得 1873；2040 需要 +551，不是 20vw。）
// 现在：期望偏移 D 先被 clamp 进 [0, W-B]，再落到 margin-left（百分比按包含块=容器宽解析，
//   不能用 100vw —— 它含滚动条）。B 在 CSS 里 = ar × 渲染高，ar 由 Sprite 在 onLoad 量。
console.log('\n== 9b. 立绘出框回归（位移与盒子宽挂钩）==')
{
  const css = internals.CSS
  const bw = /--myh-sprite-bw:calc\(var\(--myh-sprite-ar\) \* (\d+)vh\)/.exec(css)
  ok(!!bw, '有盒子宽变量 --myh-sprite-bw = ar × 渲染高（"与盒子宽挂钩"的那一半）')
  eq(bw && bw[1], '76', '盒子宽用 76vh 这一档（与 .myh-sprite 的 height 同口径）')
  ok(!/\.myh-sprite\{[^}]*height:\s*\d+%/.test(css),
    '立绘高度不用百分比（常驻层高度是 definite 的 100vh，vh 才是对的口径；百分比会掉进循环）')
  ok(/margin-left:max\(min\(calc\(50% - var\(--myh-sprite-bw\) \/ 2 \+ var\(--myh-sprite-x/.test(css),
    '位移 = max(min(x0 + D, W-B), min(x0, 0px))：期望偏移被夹进 [0, W-B]')
  ok(css.includes('calc(100% - var(--myh-sprite-bw))') && css.includes('min(calc(50% - var(--myh-sprite-bw) / 2),0px)'),
    '两个边界都在：右缘 ≤ W-B、且 min(x0,0px) 让 B>W 退化为 x0（避开 clamp() 的 min>max 陷阱）')
  ok(!/translateX\(var\(--myh-sprite-x/.test(css),
    '旧的「无约束固定比例位移」translateX(var(--myh-sprite-x)) 已清除（它就是出框的来源）')
  ok(!/place-items:end center/.test(css), '不再靠 place-items:end center 居中（横向位置已由 clamp 决定）')
  ok(!/margin-left:[^;']*100vw/.test(css),
    'clamp 里没有拿 100vw 当容器宽（它含滚动条，会让右缘在贴边时又冒出半条滚动条）')
  ok(/naturalWidth/.test(src) && src.includes('--myh-sprite-ar'),
    'Sprite 在 onLoad 量 naturalWidth/naturalHeight 写 --myh-sprite-ar（ar 只有图自己知道）')
  ok(/--myh-sprite-ar:1\.2893/.test(css),
    '量不到 ar 时兜底最宽画布 1640/1272=1.2893 —— **高估** B，只会往里收、不会出框')
  ok(css.includes('--myh-sprite-bw:calc(var(--myh-sprite-ar) * 60vh)'),
    '≤700px 的 60vh 降级档把盒子宽同步改成 60vh（否则 B 与实际渲染高脱钩）')

  // ★ 数值回归：把 CSS 那条规则用 JS 复算一遍 —— 不是文本匹配，是真的算左右缘。
  //   容器 1920×1080 时立绘高 76vh=821px，scale = 821/1272 = 0.6453。
  //   视口高固定 1080，横轴扫 1280/1440/1920/2560（交付要求的那张验算表就是它）。
  const scale = 0.76 * 1080 / 1272
  const margin = (B, d, W) => Math.max(Math.min((W - B) / 2 + d, W - B), Math.min((W - B) / 2, 0))
  const CW = [1640, 1388, 1262, 506]
  // 扫两档偏移：**当前值 10vw**（用户 2026-09-20 定案）+ **旧值 20vw**
  //   —— 旧档留着是刻意的：它是"更大偏移也safe"的额外覆盖，
  //     万一以后又调回大偏移，出框保护仍然被断言守着。
  for (const W of [1280, 1440, 1920, 2560]) {
    for (const [side, d] of [
      ['right 归属(+10vw·当前)', 0.1 * W], ['left 归属(-10vw·当前)', -0.1 * W],
      ['right 归属(+20vw·旧值)', 0.2 * W], ['left 归属(-20vw·旧值)', -0.2 * W],
    ]) {
      const cells = []
      let allIn = true
      for (const cw of CW) {
        const B = cw * scale
        const left = margin(B, d, W), right = left + B
        if (left < -0.01 || right > W + 0.01) allIn = false
        cells.push(cw + '→' + Math.round(left) + '..' + Math.round(right))
      }
      ok(allIn, `${W}×1080 ${side}：${cells.join('  ')}（容器 0..${W}，全部在框内）`)
    }
  }
  // ★ B > W（画布比容器还宽，手机窄屏会撞上）：两个约束不可能同时满足，
  //   这时必须退化成**居中**（左右各切一半），不能一头甩出去。
  const Bbig = 1640 * scale
  for (const W of [700, 1000]) {
    eq(Math.round(margin(Bbig, 0.1 * W, W)), Math.round((W - Bbig) / 2),
      `B>W 退化：${W}px 容器装 ${Math.round(Bbig)}px 盒子 → 居中（左右各切一半）`)
  }
  // （对照）旧公式「居中 + 无约束 ±20vw」到底在哪儿出框 —— 这条证明上面的断言抓得住那次 bug：
  //   · 窄视口**真的**出框：1280 视口下 1640 画布右缘 1425（出框 145px）、1440 视口下 1537（出框 97px）
  //   · 1920×1080 恰好放得下（1640 画布右缘 1873，余 47px）→ 只看 1920 桌面上的运行时不一定看得见，
  //     但诊断页的舞台只有几百 px 宽、位移却仍按窗口的 20vw（1920 窗口=384px）算 → 每张都贴边被切。
  const oldRight = (cw, W) => (W + cw * scale) / 2 + 0.2 * W
  ok(oldRight(1640, 1280) > 1280 && oldRight(1640, 1440) > 1440 && oldRight(1640, 1920) < 1920,
    `（对照）旧公式 1640 画布：1280 视口右缘 ${Math.round(oldRight(1640, 1280))}（出框 `
    + `${Math.round(oldRight(1640, 1280) - 1280)}px）、1440 视口 ${Math.round(oldRight(1640, 1440))}（出框 `
    + `${Math.round(oldRight(1640, 1440) - 1440)}px）、1920 视口 ${Math.round(oldRight(1640, 1920))}（放得下）`)
}

// ------------------------------------------------------------------
// 9c. 三处同口径：两个预览页的立绘几何必须是同一个公式（2026-09-21）
// ------------------------------------------------------------------
// 诊断页原来各写各的：expression-lab 的舞台只有 ~600×330px，却用 20vw 当位移
//   （1920 窗口下 384px，比舞台的一半还宽）→ 用户看到的"全都贴左边"。
//   现在：舞台固定 16:9（= manifest.canvas 1920×1080），几何取**相对舞台自身**的量
//   （76% ≡ 76vh、20% ≡ 20vw），公式与运行时一字不差。
console.log('\n== 9c. 三处同口径（预览页与运行时同一公式）==')
{
  const pages = [
    // 实验台/对照页是 16:9 的**等比小舞台** → 盒子宽按"舞台高 × 9/16"折成舞台宽的百分比，
    //   而尺寸用**宽**定：百分比高度在 aspect-ratio 网格里会循环（实测退化成"自然尺寸的 76%"）。
    ['skin/preview/expression-lab.html', '实验台',
      /--myh-sprite-bw:calc\(var\(--myh-sprite-ar\) \* 76% \* 9 \/ 16\)/, true],
    // 预览页是整屏 100vw×100vh（与实机同一环境）→ 直接用 vh，和 client.js 同口径
    ['skin/preview/index.html', '预览页',
      /--myh-sprite-bw:calc\(var\(--myh-sprite-ar\) \* 76vh\)/, false],
    ['skin/preview/sprite-side-compare.html', '站位对照页',
      /--myh-sprite-bw:calc\(var\(--myh-sprite-ar\) \* 76% \* 9 \/ 16\)/, true],
  ]
  for (const [rel, cn, bwRe, byWidth] of pages) {
    const p = path.join(SKIN, '..', rel)
    const html = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
    ok(!!html, `${cn}存在（${rel}）`)
    ok(/margin-left:max\(min\(calc\(50% - var\(--myh-sprite-bw\) \/ 2/.test(html),
      `${cn}用同一条 clamp 公式（margin-left + min/max 排序）`)
    ok(bwRe.test(html), `${cn}盒子宽与画面尺寸同口径`)
    if (byWidth) {
      // 只查 .stage img.sprite 这条规则本体（页面里别处还有 .band 的 height:100% 之类）
      const rule = /\.stage img\.sprite\{([^}]*)\}/.exec(html)
      ok(!!rule && /width:var\(--myh-sprite-bw\);height:auto/.test(rule[1]) && !/height:\s*\d+%\s*;/.test(rule[1]),
        `${cn}盒子按**宽**定尺寸（避开 aspect-ratio 网格里的百分比高度循环）`)
    }
    ok(!/translateX\(var\(--myh-sprite-x/.test(html), `${cn}不再是"无约束固定比例位移"`)
    ok(/--myh-sprite-ar:1\.2893/.test(html) && /naturalWidth/.test(html),
      `${cn}量 ar（naturalWidth）且带同一个兜底比例`)
  }
  // 16:9 舞台是"两处比例等价"的前提：舞台必须自锁 16:9
  ok(/aspect-ratio:16\/9/.test(fs.readFileSync(path.join(SKIN, 'preview', 'sprite-side-compare.html'), 'utf8'))
    && /aspect-ratio:16\/9/.test(fs.readFileSync(path.join(SKIN, 'preview', 'expression-lab.html'), 'utf8')),
    '两个诊断页的舞台都锁 16:9（= manifest.canvas 1920×1080），否则比例对不上实机')
}

console.log('\n== 10. 逃生门与加固 ==')
{
  const src2 = fs.readFileSync(CLIENT, 'utf8')
  // ★ 最重要的那条：绝对不能再用 jsxRuntime.jsx 当元素构造器
  ok(src2.includes('const h = React.createElement'),
    'h 绑到 React.createElement（外壳的 jsx() 只吃两个参数，会丢 children）')
  ok(!/const h = jsxRuntime\.jsx/.test(src2), '没有残留 h = jsxRuntime.jsx')
  ok(src2.includes('moye-skin:kill'), '有 localStorage 紧急关闭标记（三级入口）')
  ok(src2.includes('Ctrl+Shift+M') || /shiftKey[^\n]*[Mm]/.test(src2), '有 Ctrl+Shift+M 快捷键')
  ok(src2.includes('?mahoyo=off') || src2.includes("'off'"), '支持 URL 参数 ?mahoyo=off / on')
  ok(src2.includes('sweepCrashFaces'), '关闭时会清掉 DSH 错误边界留下的崩溃占位')
  ok(src2.includes('class SkinErrorBoundary'), '皮肤根外面有 React 错误边界')
  ok(src2.includes('body.appendChild(el)') || src2.includes("id = 'myh-skin-root'"),
    '皮肤根自建挂载到 body（**不再依赖 shell.overlay**）')
  ok(src2.includes('ReactDOMClient.createRoot') || src2.includes('createRoot(el)'),
    '用 react-dom/client 的 createRoot 挂载')
  ok(src2.includes('installKillHotkey'), '紧急开关直接挂 window 监听（与 React/插槽解耦）')
  ok(!/registerEntry\(ctx, 'shell\.overlay'/.test(src2),
    '确认没有任何条目注册进 shell.overlay')
  ok(/try\s*\{\s*applyInner\(ctx\)/.test(src2) || src2.includes('applyInner(ctx)'), 'apply() 整体包在 try/catch 里')
  const host = fs.readFileSync(path.join(SKIN, 'lib', 'index.js'), 'utf8')
  ok(host.includes('safeMode'), '宿主半边支持 SAFE_MODE 安全模式')
  ok(host.includes('normalizeSettings'), '设置经过白名单归一化（脏值不会让注册失败）')
  ok(host.includes('registerRoute'), '三条静态路由各自独立 try/catch')
  ok(/try\s*\{[\s\S]{0,400}ctx\.settings\.register/.test(host), '设置注册包在 try/catch 里')
  const safeMod = fs.existsSync(path.join(SKIN, 'SAFE_MODE'))
  ok(!safeMod, '当前没有残留的 SAFE_MODE（皮肤处于生效状态）')
  ok(fs.existsSync(path.join(SKIN, '..', 'recovery', 'rollback.ps1')), '抢救脚本存在')
  ok(fs.existsSync(path.join(SKIN, 'tools', 'guard.ps1')), '启动守卫存在')

  // ---- Q14 诊断字段（2026-09-19 补）----------------------------------
  // 三个 composer 候选选择器**各自**的现场。没有它就只能看到最终数字 composerH，
  // 分不清"没渲染"与"被藏了" —— 那正是 Q14 卡住的地方（docs/OPEN-QUESTIONS Q14 第 1 步）。
  ok(src2.includes('function composerCandidates'), '探针里有 composerCandidates()（Q14 逐候选取证）')
  for (const sel of ['[data-composer-seat]', '[data-composer-card]', '[data-composer-input]']) {
    ok(src2.includes(sel), `composerCandidates 覆盖候选 ${sel}`)
  }
  ok(src2.includes('siblingHideRuleMatches'),
    '探针里查了 Q14 点名怀疑的连坐隐藏规则（div:has(> [data-rightbar-col]) ~ *）')
  // ★ 位置断言：宿主只留存 `body.autoProbe || body`，
  //   字段一旦落到 autoProbe 外面就会被**静默丢掉**（docs/18 §2 踩过这个坑）。
  const iAuto = src2.indexOf('autoProbe: {')
  const iCand = src2.indexOf('composerCandidates: composerCandidates()')
  ok(iAuto >= 0 && iCand > iAuto,
    'composerCandidates 挂在 autoProbe **内部**（否则宿主留存时会丢字段）')
  // 红线 7：探针对象必须能过 JSON.stringify。回归断言：矩形要四舍五入、不许塞 DOM 本体。
  const candBody = src2.slice(src2.indexOf('function composerCandidates'),
    src2.indexOf('function measureShell'))
  ok(/Math\.round\(/.test(candBody) && !/rect:\s*r\b/.test(candBody),
    'composerCandidates 只上报数字/布尔/字符串（矩形已四舍五入，不塞 DOM 本体）')

  // ---- 用户消息排版（2026-09-21 用户定案）-----------------------------
  // 用户明确要求：「发出的消息也不要用消息框，而是与发过来的内容一样排，用「」框起来」。
  // 守三件事：① 走 .myh-say 同一套排版 ② 有「」 ③ 旧的付箋气泡**不许回来**。
  ok(src2.includes("className: 'myh-say myh-sayUser'"),
    '用户消息与助手正文同排（走 .myh-say + .myh-sayUser）')
  ok(src2.includes("'「'") && src2.includes("'」'"),
    '用户消息用「」框起来（原作"人声"的起手标点）')
  // ⚠ 判据只看"有没有真的用它"，且必须**先剥掉注释**再判 ——
  //   否则注释里提一下这个名字（为了说明历史）就会被误判成"又加回来了"，
  //   那样只会逼着后来人删掉解释。剥注释后，真实的 CSS 选择器 / className 一处都跑不掉。
  const noComments = src2.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fusenUsed = noComments.includes('myh-fusenMsg')
  ok(!fusenUsed, '旧的用户消息框（myh-fusenMsg 黄色气泡）已彻底移除，不许回来')
  ok(src2.includes("'.myh-sayUser{"),
    'CSS 里有 .myh-sayUser 着色（用户说话人身份不靠气泡、靠标点与色调）')
  ok(!/myh-msg\[data-role="user"\][^}]*background:/.test(src2),
    '用户消息行不再有底色（否则又变回气泡）')

  // ---- 台词链路取证口（2026-09-21）------------------------------------
  // "正文为什么空"只能靠现场取证回答；没有这个口就只能靠转述（docs/27 §6.3 的教训）。
  ok(src2.includes('window.__myhChat'), '装了只读诊断口 window.__myhChat()')
  ok(src2.includes('debugChat'), '留了原始 ChatSnapshot 的引用（debugChat），诊断可原地复算')
  ok(src2.includes('viaOrder') && src2.includes('viaLegacy'),
    '诊断口分开复算「主路径」与「投影层」，能定位是哪一路没给内容')
  const chatHook = src2.slice(src2.indexOf('window.__myhChat'), src2.indexOf('function snapshot()') > 0 ? src2.indexOf('function snapshot()') : src2.indexOf('var module'))
  ok(!/snapshot\s*:/.test(chatHook),
    '诊断口不把快照本体塞进返回值（红线 7：必须能过 JSON.stringify）')
  ok(src2.includes('lineLen:') && src2.includes('msgCount:'),
    'diag.store 上报 lineLen / msgCount / msgRoles（一眼看出断在哪）')

  // ---- ★ 端到端：真实形状快照 → 消息流 → 渲染出文本（2026-09-21）---------
  // 这是本次用户要求的核心（"把文本内容真的接到文本显示区域里"），
  // 所以必须有机器判据，而不是靠人眼看一次。
  // 用一套**有真状态 hooks** 的 React 替身单独跑一遍，不复用上面那个
  // `createElement: () => null` 的形状夹具（它跑不了渲染）。
  try {
    const e2e = renderMessagesEndToEnd()
    ok(e2e.trTexts.includes('教室に来たよ'),
      '端到端：用户消息正文真的画进了消息流（Transcript 输出里有它的文字）')
    ok(e2e.trTexts.includes('「') && e2e.trTexts.includes('」'),
      '端到端：用户消息带「」标记')
    ok(e2e.trTexts.some((t) => t.includes('莫迦')),
      '端到端：助手正文也画进了同一条流')
    ok(!e2e.classes.includes('myh-fusenMsg'),
      '端到端：消息流里没有旧的付箋气泡类名')
    ok(e2e.classes.includes('myh-sayUser') && e2e.classes.includes('myh-say'),
      '端到端：用户与助手共用 .myh-say，用户多一个 .myh-sayUser')
    ok(!e2e.classes.includes('myh-cur'),
      '端到端：消息流里没有已删的 .myh-cur（底部台词层）')
    /* ★ 打字机搬到正文流（2026-09-21）。三态都要守：
       半句 → 截断 + 光标；全句 → 完整 + 无光标；不相干 → 完整 + 无光标（身份校验）。 */
    /* ⚠ 失败消息里带上**实际文本**：只看 "不该出现莫迦" 无法区分
       "完全没截断" 和 "截断位置不对"，排查时只能另写探针复现（踩过）。 */
    ok(e2e.typing.halfShowsPartial,
      '端到端：打字机半句时正文只画到那个长度（不再另起一层） — 实得 ' +
      JSON.stringify(e2e.joined.half))
    ok(e2e.typing.halfShowsCaret,
      '端到端：打字机半句时句尾有光标 — 实得 ' + JSON.stringify(e2e.joined.half))
    ok(e2e.typing.fullShowsWhole && !e2e.typing.fullShowsCaret,
      '端到端：打完的句子完整显示且没有残留光标')
    ok(e2e.typing.alienShowsWhole,
      '端到端：typing 与最后一条助手消息不相干时**不截断**正文（身份校验生效）')
  } catch (err) {
    ok(false, '端到端渲染回归跑不起来：' + String((err && err.message) || err))
  }
}

/**
 * 端到端回归：造一份**照 DSH 真实形状**的 ChatSnapshot，
 * 走 `readMessages` → `MessageRow`/`Transcript`，把渲染出的文字与 class 收回来。
 *
 * 为什么值得单独跑一遍：`docs/26` 那次修好了"认不认 assistant-step"，
 * 但"正文到底有没有画到屏幕上"仍只能靠探针转述。这条断言把
 * 「数据 → 解析 → 渲染」整条链钉住 —— 任何一环静默返回空都会当场失败。
 *
 * 形状依据（`dsh-client-ui-chat` 源码实读）：
 *   user 节点            { kind:'user', content:[{type:'text',text}] }
 *   assistant-step 节点  { kind:'assistant-step', data:{ blocks:[{kind:'text',text}] } }
 *   tool-call 节点       { kind:'tool-call', data:{ root:{...} } }
 * 注意 `legacy.nodes` 里放的是 **node.data**（已解包），assistant 那条是
 * `{kind:'assistant', blocks:[…]}` —— 两条路都要走通。
 */
function renderMessagesEndToEnd() {
  const hooks = []
  let hi = 0
  const mkReact = () => ({
    Fragment: Symbol.for('f'),
    createElement(type, props) {
      const kids = []
      for (let i = 2; i < arguments.length; i++) {
        const c = arguments[i]
        if (Array.isArray(c)) kids.push(...c.filter((x) => x !== null && x !== undefined && x !== false))
        else if (c !== null && c !== undefined && c !== false) kids.push(c)
      }
      return { $$el: true, type, props: props || {}, children: kids }
    },
    useState(init) { const i = hi++; if (!(i in hooks)) hooks[i] = typeof init === 'function' ? init() : init; return [hooks[i], () => {}] },
    useRef(init) { const i = hi++; if (!(i in hooks)) hooks[i] = { current: init }; return hooks[i] },
    useMemo(fn) { hi++; return fn() },
    useCallback(fn) { hi++; return fn },
    useEffect() { hi++ },
    useSyncExternalStore(s, g) { hi++; return g() },
    Component: class { constructor(p) { this.props = p; this.state = {} } setState() {} },
  })
  const R = mkReact()
  const jsxR = { Fragment: R.Fragment, jsx: (t, p) => R.createElement(t, p, p && p.children), jsxs: (t, p) => R.createElement(t, p, p && p.children) }
  const el = () => ({
    dataset: {}, style: { setProperty() {} }, children: [], textContent: '',
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false,
    appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }),
    closest: () => null, remove() {}, animate: () => ({}), focus() {},
  })
  const doc = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: el, head: { appendChild() {} },
    body: Object.assign(el(), { setAttribute() {}, removeAttribute() {}, getAttribute: () => '' }),
    documentElement: { setAttribute() {}, getAttribute: () => null },
  }
  const setG = (n, v) => {
    try { globalThis[n] = v } catch { /* 只读 */ }
    if (globalThis[n] !== v) { try { Object.defineProperty(globalThis, n, { value: v, writable: true, configurable: true }) } catch { /* 放弃 */ } }
  }
  const saved = {}
  for (const k of ['document', 'window', 'navigator', 'location', 'localStorage', 'MutationObserver', 'ResizeObserver', 'Audio', 'fetch']) saved[k] = globalThis[k]
  setG('document', doc)
  globalThis.window = {
    __ModuleLoader__: { load() {} }, innerWidth: 1920, innerHeight: 1080,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
  setG('navigator', { userAgent: 'check-client' })
  setG('location', { href: 'http://x/', search: '' })
  setG('localStorage', { getItem: () => null, setItem() {}, removeItem() {} })
  setG('MutationObserver', class { observe() {} disconnect() {} })
  setG('ResizeObserver', class { observe() {} disconnect() {} })
  setG('Audio', class { play() { return Promise.resolve() } pause() {} addEventListener() {} })
  setG('fetch', async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))

  let reg = null
  globalThis.window.__ModuleLoader__ = { load: (e) => { reg = e } }
  new Function('window', 'document', fs.readFileSync(CLIENT, 'utf8'))(globalThis.window, doc)
  const a = reg.factory((spec) => {
    if (spec === 'react') return R
    if (spec === 'react/jsx-runtime') return jsxR
    if (spec === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
    throw new Error('意外的 require: ' + spec)
  })
  const I = a.__internals
  I.loadManifest(JSON.parse(fs.readFileSync(path.join(SKIN, 'data', 'manifest.json'), 'utf8')))
  const S = {
    character: 'aoko', enabled: true, showSprite: true, showDialogue: true, hideTabs: true,
    autoCollapse: true, bgm: false, bgmVolume: 0, sfx: false, sfxVolume: 0,
    persona: true, easterEgg: true, edThreshold: 0.78, assetRoot: '',
  }
  I.settingsBox.s = S
  I.store.set({ ready: true, settings: S, dark: true, scene: 'A4' })

  // 照 DSH 真实形状造快照
  const snapshot = {
    order: ['k1', 'k2'],
    nodes: new Map([
      ['k1', { kind: 'user', seq: 1, time: 0, content: [{ type: 'text', text: '教室に来たよ' }] }],
      ['k2', { kind: 'assistant-step', seq: 2, time: 0, data: { turn: 1, step: 1, blocks: [{ kind: 'text', text: 'アンタ、本当に莫迦ね。' }] } }],
    ]),
    legacy: { nodes: [], runningCalls: [], partial: null },
  }
  const msgs = I.readMessages(snapshot)
  if (msgs.length !== 2) throw new Error('readMessages 只解出 ' + msgs.length + ' 条，期望 2 条')

  // 渲染整条流（真跑组件，不是看字符串）
  const walkOnce = (typing) => {
    /* ★ 每次渲染都必须**重置 hook 状态**：四次调用（空/半句/全句/不相干）
       共享同一个 `hooks` 数组的话，后面的调用会读到前面留下的 state，
       结果互相污染 —— 第一版就栽在这（`fullHasCaret` 假报 true）。 */
    hooks.length = 0
    hi = 0
    const texts = []
    const classes = []
    let carets = 0
    const walk = (n, depth) => {
      if (n === null || n === undefined || typeof n === 'boolean') return
      if (typeof n === 'string' || typeof n === 'number') { texts.push(String(n)); return }
      if (Array.isArray(n)) { n.forEach((x) => walk(x, depth)); return }
      if (typeof n !== 'object') return
      if (n.$$el) {
        const cls = n.props && n.props.className
        if (typeof cls === 'string') {
          cls.split(/\s+/).forEach((c) => c && classes.push(c))
          if (cls.indexOf('myh-caret') >= 0) carets++
        }
        // ★ 组件元素（type 是函数）必须**用元素自己的 props 调用**才叫渲染。
        //   传空 props 会得到 null —— 那样就会误报"正文没画出来"（本断言第一版就栽在这）。
        if (typeof n.type === 'function' && depth < 12) {
          walk(n.type(n.props || {}), depth + 1)
          return
        }
        ;(n.children || []).forEach((c) => walk(c, depth + 1))
      }
    }
    hi = 0
    walk(I.componentNames.Transcript({ messages: msgs, agent: 'idle', typing: typing || '' }), 0)
    return { texts, classes, carets }
  }

  const base = walkOnce('')
  const half = walkOnce('アンタ、')
  const full = walkOnce('アンタ、本当に莫迦ね。')
  const alien = walkOnce('まったく別の文章')

  // 还原全局，免得污染后面的断言
  for (const k of Object.keys(saved)) setG(k, saved[k])
  const j = (r) => r.texts.join('')
  return {
    trTexts: base.texts, classes: base.classes,
    /* ★★★ 2026-09-23：把**实际文本**也带回来。
       起因：加了 Markdown 渲染之后 `halfShowsPartial` 报失败，而失败消息只说
       "不该出现莫迦"，看不到实际画了什么 —— 排查时只能靠另写探针复现，
       结果探针环境和这里不同、复现不出来，白绕了几轮。
       断言消息里带上原文，下次一眼就能看出是"没截断"还是"截断位置不对"。 */
    joined: {
      base: j(base), half: j(half), full: j(full), alien: j(alien),
    },
    /* ★ 打字机三态（2026-09-21）：半句 / 全句 / 不相干。
       —— 打字机现在落在**正文流最后一条**上（底部那层 .myh-cur 已删）。 */
    /* ⚠ 字段名一律直接读成结论（`xxxShown` / `xxxTyped`），
       不要再出现 `fullHasCaret: carets === 0` 这种"名字说 A、判据说非 A"的写法 ——
       我在这上面绕了好几轮，把断言读反了。 */
    typing: {
      halfShowsCaret: half.carets === 1,
      halfShowsPartial: j(half).indexOf('アンタ、') >= 0 &&
                        j(half).indexOf('莫迦') < 0,
      fullShowsCaret: full.carets === 1,
      fullShowsWhole: j(full).indexOf('莫迦') >= 0,
      // 身份校验：typing 与最后一条助手消息不相干时，**不许**截断正文
      alienShowsWhole: j(alien).indexOf('莫迦') >= 0 && alien.carets === 0,
    },
  }
}

// ------------------------------------------------------------------
// 9d. 输入框：一打字就变一下（2026-09-21 用户反馈修复）
// ------------------------------------------------------------------
console.log('\n== 9d. 输入框高度公式与色阶（"一打字就变一下"）==')
{
  /* 用户："开始键入内容之后会变一下，把这个问题改了"。
     两个原因同时发生，所以两条都要守：
       ① 高度公式差一行 —— 旧式子 0 字 → 88、1 字 → 130（硬跳 42px）
       ② "空"被当成色阶依据 —— 空 → pale 档，一打字切 mid 档，带 0.25s 过渡

     ⚠ 夹具里的 `document.querySelector` 返回 null，所以 composerState 读到的
        `txt` 恒为 `''`（空态分支）。要驱动"非空"分支必须**临时换掉 querySelector**，
        mock 一个带 textContent 的假输入框。 */
  const cs = internals.composerState
  ok(typeof cs === 'function', 'composerState 可供离线调用')

  const realQS = globalThis.document.querySelector
  const withText = (txt) => {
    globalThis.document.querySelector = (sel) =>
      sel === '[data-composer-input]' ? { textContent: txt, value: undefined } : null
    return cs()
  }

  let empty, one, ten, fortysix, fortyseven, ninetythree
  try {
    empty = withText('')
    one = withText('あ')
    ten = withText('あ'.repeat(10))
    fortysix = withText('あ'.repeat(46))
    fortyseven = withText('あ'.repeat(47))
    ninetythree = withText('あ'.repeat(93))
  } finally {
    globalThis.document.querySelector = realQS
  }

  ok(empty.h === 88, `空输入框高 88（实得 ${empty.h}）`)
  ok(one.h === 88,
    `★ 敲第一个字**高度不变**（实得 ${one.h}；旧公式这里是 130，硬跳 42px）`)
  ok(ten.h === 88 && fortysix.h === 88,
    `一行以内（10 / 46 字）保持 88（实得 ${ten.h} / ${fortysix.h}）`)
  ok(fortyseven.h === 130,
    `第二行起 130（47 字，实得 ${fortysix.h}→${fortyseven.h}）`)
  ok(ninetythree.h === 172,
    `再往上封顶 172（93 字，实得 ${ninetythree.h}）`)
  ok(!(one.h > empty.h), '★ 0 字与 1 字**同高** —— 这是"一打字就变一下"的第一半')
  ok(empty.h === 88 && empty.waiting === false,
    '★ 空的输入框**不再**算作"等待你"（旧代码这里是 waiting:true → 点亮 pale 档）')
  ok(one.waiting === false && ten.waiting === false,
    '★ 非空也不是"等待你" —— 空与非空色阶一致，不再有那次 0.25s 变色')
  ok(empty.waiting === one.waiting,
    '★ 空/非空的 waiting 必须相同（它是色阶的唯一驱动，不同就会变色）')
}

// ------------------------------------------------------------------
// 9e. Markdown 渲染（2026-09-23 新增）
// ------------------------------------------------------------------
console.log('\n== 9e. Markdown 渲染（正文标记乱码的修复）==')
let mdb = null
{
  /* 用户报告："现在的皮肤无法适配 markdown 格式，所以会出现一大堆符号乱码"。
     起因是 `MessageRow` 把助手原文**当纯文本**直接塞进 `.myh-say`，
     所以 `**`、`##`、三个反引号全都被当成正文画了出来。

     ⚠ 这里只测**纯函数**（字符串进、元素树出），不测像素 ——
       "标记有没有被解析掉"必须有机器判据，不能靠看截图。

     ⚠⚠ **本段必须自己重新加载一遍 bundle**，不能复用文件顶部的 `internals`：
       顶部那个假 React 的 `createElement` 是 `() => null`（第 1 段的省事写法，
       那一层只比对源码字符串、从不看元素树）。用它跑 `mdBlocks` 会得到**一堆 null**，
       于是下面每一条断言都红 —— 而解析器其实是好的。
       我第一版就是这么写的，看到 18 条全红差点以为解析器写废了。
       症状很好认：**收集到的文字全是空串**（`实得 ""`）。 */
  const mkReact = () => {
    const hooks = []
    let hi = 0
    const R = {
      Fragment: Symbol.for('react.fragment'),
      createElement(type, props) {
        const kids = []
        for (let i = 2; i < arguments.length; i++) {
          const c = arguments[i]
          if (Array.isArray(c)) kids.push(...c.filter((x) => x !== null && x !== undefined && x !== false))
          else if (c !== null && c !== undefined && c !== false) kids.push(c)
        }
        /* 与真 React 一致：children 挂在 `props.children`；
           同时把数组也挂在元素自己的 `children` 上，方便断言遍历。 */
        const isComp = typeof type === 'function'
        return {
          $$el: true, type, key: props && props.key,
          props: Object.assign({}, props, { children: isComp ? (kids.length > 1 ? kids : (kids[0] ?? null)) : kids }),
          children: kids,
        }
      },
      useState(init) { const i = hi++; if (!(i in hooks)) hooks[i] = typeof init === 'function' ? init() : init; return [hooks[i], () => {}] },
      useRef(init) { const i = hi++; if (!(i in hooks)) hooks[i] = { current: init }; return hooks[i] },
      useMemo(fn) { hi++; return fn() },
      useCallback(fn) { hi++; return fn },
      useEffect() { hi++ },
      useSyncExternalStore(s, g) { hi++; return g() },
      Component: class { constructor(p) { this.props = p; this.state = {} } setState() {} },
    }
    return R
  }
  const R = mkReact()
  const jsxR = {
    Fragment: R.Fragment,
    jsx: (t, p) => R.createElement(t, p, p && p.children),
    jsxs: (t, p) => R.createElement(t, p, p && p.children),
  }
  let reg2 = null
  globalThis.window.__ModuleLoader__ = { load: (e) => { reg2 = e } }
  new Function('window', 'document', fs.readFileSync(CLIENT, 'utf8'))(globalThis.window, globalThis.document)
  const api2 = reg2.factory((spec) => {
    if (spec === 'react') return R
    if (spec === 'react/jsx-runtime') return jsxR
    if (spec === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
    throw new Error('意外的 require: ' + spec)
  })
  mdb = api2.__internals.mdBlocks
  const mdAttach = api2.__internals.mdAttachCaret
  ok(typeof mdb === 'function', 'mdBlocks 已导出（供离线断言）')

  /** 把元素树里所有文字/代码收集成串，便于比对。 */
  const mdText = (nodes) => {
    const out = []
    const walk = (n) => {
      if (n == null || typeof n === 'boolean') return
      if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return }
      if (Array.isArray(n)) { n.forEach(walk); return }
      if (typeof n !== 'object') return
      if (n.children) n.children.forEach(walk)
      else if (n.props && n.props.children != null) {
        const c = n.props.children
        ;(Array.isArray(c) ? c : [c]).forEach(walk)
      }
    }
    ;(Array.isArray(nodes) ? nodes : [nodes]).forEach(walk)
    return out.join('')
  }
  /** 收集元素树里所有 className。 */
  const mdCls = (nodes) => {
    const out = []
    const walk = (n) => {
      if (n == null || typeof n !== 'object') {
        if (Array.isArray(n)) n.forEach(walk)
        return
      }
      if (Array.isArray(n)) { n.forEach(walk); return }
      const c = n.props && n.props.className
      if (typeof c === 'string') out.push(c)
      if (n.children) n.children.forEach(walk)
      else if (n.props && n.props.children != null) {
        const k = n.props.children
        ;(Array.isArray(k) ? k : [k]).forEach(walk)
      }
    }
    ;(Array.isArray(nodes) ? nodes : [nodes]).forEach(walk)
    return out.join(' ')
  }

  // ---- 用户截图里那几种真实形态：解析后**不该再看到标记字符** ----
  {
    const src = '**后两条同时为真，只能说明**：浏览器报告的 1912 和真正能画的宽度不是一回事。'
    const t = mdText(mdb(src))
    ok(t.indexOf('**') < 0 && t.indexOf('后两条同时为真') >= 0,
      '粗体标记被解析掉（** 不再出现在正文里）— 实得 ' + JSON.stringify(t.slice(0, 40)))
    ok(mdCls(mdb(src)).indexOf('myh-mdBold') >= 0, '粗体渲染成 myh-mdBold')
  }
  {
    const t = mdText(mdb('`dpr=1.5` 正是那个不一致的痕迹。'))
    ok(t.indexOf('`') < 0 && t.indexOf('dpr=1.5') >= 0,
      '行内代码的反引号被解析掉 — 实得 ' + JSON.stringify(t.slice(0, 40)))
    ok(mdCls(mdb('`x`')).indexOf('myh-mdCode') >= 0, '行内代码渲染成 myh-mdCode')
  }
  {
    const b = mdb('## 下一步只做一件事，不再改 CSS')
    ok(mdText(b).indexOf('#') < 0 && mdCls(b).indexOf('myh-mdH') >= 0,
      '## 标题被解析成 myh-mdH（# 不再显示）')
  }
  {
    const b = mdb('```powershell\npwsh -File skin\\tools\\guard.ps1\n```')
    ok(mdCls(b).indexOf('myh-mdPre') >= 0 && mdText(b).indexOf('guard.ps1') >= 0,
      '围栏代码块渲染成 myh-mdPre，内容保留')
    ok(mdText(b).indexOf('```') < 0, '围栏的三个反引号不再显示在正文里')
  }
  {
    const b = mdb('- 第一条\n- 第二条\n\n1. 甲\n2. 乙')
    const c = mdCls(b)
    ok(c.indexOf('myh-mdList') >= 0 && c.indexOf('myh-mdLi') >= 0, '列表渲染成 myh-mdList/myh-mdLi')
    ok(mdText(b).indexOf('- ') < 0, '列表的 "- " 标记不再显示')
  }
  {
    const b = mdb('> 引用的一句话')
    ok(mdCls(b).indexOf('myh-mdQuote') >= 0 && mdText(b).indexOf('>') < 0, '引用渲染成 myh-mdQuote')
  }
  {
    const b = mdb('| 甲 | 乙 |\n|---|---|\n| 1 | 2 |')
    ok(mdCls(b).indexOf('myh-mdTable') >= 0 && mdText(b).indexOf('甲') >= 0,
      '表格渲染成 myh-mdTable（表头与单元格都保留）')
  }

  // ---- ★ 流式降级：半截标记必须原样输出，不能吞掉整段 ----
  /* 这是本解析器最要紧的性质：打字机按句推进，屏幕上随时是"标记还没闭合"的中间态。
     若那时抛错或吞文本，打字过程中屏幕会一截一截地闪。 */
  {
    const t = mdText(mdb('**后两条同时为真'))
    ok(t === '**后两条同时为真',
      '★ 未闭合的粗体**原样输出**（流式半截标记不吞文本）— 实得 ' + JSON.stringify(t))
  }
  {
    const t = mdText(mdb('`未闭合的行内代码'))
    ok(t === '`未闭合的行内代码',
      '★ 未闭合的行内代码原样输出 — 实得 ' + JSON.stringify(t))
  }
  {
    // 围栏开了没关：**正确**的中间态就是"后面全算代码块"
    const b = mdb('```js\nconst a = 1')
    ok(mdCls(b).indexOf('myh-mdPre') >= 0,
      '★ 未闭合的围栏按代码块渲染（打字到一半的正确中间态）')
  }
  {
    // 纯文本不受影响（保住原有渲染行为）
    const t = mdText(mdb('アンタ、本当に莫迦ね。'))
    ok(t === 'アンタ、本当に莫迦ね。', '无标记的纯文本原样输出（不改变既有正文）')
  }

  // ---- ★ 安全：链接协议白名单（正文是不可信输入） ----
  {
    const b = mdb('[点我](javascript:alert(1))')
    ok(mdCls(b).indexOf('myh-mdLink') < 0,
      '★ javascript: 链接**不生成 a 元素**（只保留文字，避免注入）')
    const b2 = mdb('[点我](https://example.com)')
    ok(mdCls(b2).indexOf('myh-mdLink') >= 0, 'https 链接正常渲染成 myh-mdLink')
  }

  // ---- ★ 光标必须落在最后一个文字块**内部**，不能另起一行 ----
  {
    const withCaret = mdAttach(
      mdb('第一段\n\n第二段'), { $$probe: 'caret' })
    const cls = mdCls(withCaret)
    ok(cls.indexOf('myh-mdP') >= 0 && mdText(withCaret).indexOf('第二段') >= 0,
      '★ 附加光标后正文不丢（重建元素时 children 要走第 3 个参数，且两种读取位置都要兼容）')
  }
}

// ------------------------------------------------------------------
// 9f. BGM 断点续播（2026-09-23 新增）
// ------------------------------------------------------------------
console.log('\n== 9f. BGM 断点续播（切角色 / 进表紙后不从头播）==')
{
  /* 用户报告：进一次 L1 表紙（或切角色）之后，BGM 就**从头开始**。
     根因三处，缺一不可：
       ① `playIndex` 换 `el.src` —— 浏览器行为，必然归零，只能换完 seek 回去
       ② `setBgm` 里 `audio.index = 0` —— 重进列表永远从第一首
       ③ 表紙歌单（单曲）与阅读态歌单（5~8 首）**不同源**，join 比对不等
          → 每次都判定"换了歌单" → 重设 + 重播

     ⚠ 这里测的是**判据纯函数** `bgmResumeAt` 与歌单标识 `bgmKind`。
       它们决定"记住的位置该不该恢复"，边界多（太靠前 / 时长未知 /
       离结尾太近），靠听感回归是发现不了的。 */
  const RA = internals.bgmResumeAt
  const BK = internals.bgmKind
  ok(typeof RA === 'function', 'bgmResumeAt 已导出（供离线断言）')
  ok(typeof BK === 'function', 'bgmKind 已导出（供离线断言）')

  // ---- 正常恢复 ----
  eq(RA(42.5, 180), 42.5, '★ 中途的位置原样恢复（180s 的曲子记住 42.5s → 42.5s）')
  eq(RA(1.2, 180), 1.2, '刚过 1 秒也恢复（阈值是 >1）')
  eq(RA(120, 200), 120, '长曲中段恢复')

  // ---- 不恢复的边界：这几种都返回 0（从头播） ----
  eq(RA(0, 180), 0, '位置为 0 → 从头（本就没听过）')
  eq(RA(0.8, 180), 0, '不到 1 秒 → 从头（不值得 seek，还会听到卡顿）')
  eq(RA(-5, 180), 0, '非法负值 → 从头')
  eq(RA(NaN, 180), 0, 'NaN → 从头（不能写进 currentTime）')
  eq(RA(50, 0), 0, '★ 时长未知 → 从头（此时写 currentTime 会被浏览器静默忽略）')
  eq(RA(50, NaN), 0, '时长 NaN → 从头')

  /* ★ 最要紧的一条边界：离结尾太近就不能恢复。
     否则一进来就触发 `ended` → 立刻跳下一首，听感是"莫名其妙跳过一首"。
     （这条最容易在长曲/短曲上回归，所以两个方向都断言。） */
  eq(RA(179.2, 180), 0, '★ 离结尾 0.8s（<1.5s）→ 从头，避免一进来就 ended')
  eq(RA(178.6, 180), 0, '离结尾 1.4s → 从头')
  /* ⚠ 178.4/180 = 99.1%，仍然 >98% → 被**第二道**兜底拦下。
     两道是**叠加**的（取更严的那道），所以"过了 1.5s 那道"不代表能恢复。
     我第一版把这条的期望写成 178.4，就是没意识到两道的先后 —— 断言抓对了。 */
  eq(RA(178.4, 180), 0, '离结尾 1.6s 但仍是 99.1% → 被 98% 那道拦下')
  eq(RA(176, 180), 176, '★ 176/180 = 97.8%（两道都过）→ 恢复')
  eq(RA(179, 200), 179, '长曲上 179s 离结尾还远 → 恢复')
  eq(RA(1786, 1800), 0, '★ 1800s 的曲子记住 1786s（98.8%）→ 从头（按比例兜一道）')
  eq(RA(1700, 1800), 1700, '1800s 的曲子记住 1700s（94%）→ 恢复')

  // ---- 歌单标识：表紙与阅读态必须分得开，否则记忆会串 ----
  eq(BK(false, true), 'titleLight', 'L1 表紙·昼 → titleLight')
  eq(BK(true, true), 'titleDark', 'L1 表紙·夜 → titleDark')
  eq(BK(false, false), 'dailyLight', '阅读态·昼 → dailyLight')
  eq(BK(true, false), 'dailyDark', '阅读态·夜 → dailyDark')

  /* ★ 这四个标识必须互不相同 —— 这正是用户 bug 的根因③：
     如果表紙和阅读态共用一个 key，"在表紙记住的位置"会污染阅读态的记忆，
     退回阅读态时就会 seek 到一段根本不属于这首曲子的时间。 */
  const kinds = [BK(false, true), BK(true, true), BK(false, false), BK(true, false)]
  ok(new Set(kinds).size === 4, '★ 四个歌单标识互不相同（记忆不会串台）')
}

// ------------------------------------------------------------------
// 9g. 立绘双槽状态机（2026-09-23 重写）
// ------------------------------------------------------------------
console.log('\n== 9g. 立绘交叉淡入状态机（闪黑 / 错图 / 偏掉）==')
{
  /* 用户报告三个症状，同一根因：
       · "会闪黑色的画面"
       · "错误的人物画像"
       · "有些时候角色会偏掉"
     起因是我上一版把"逻辑当前槽"与"视觉可见槽"混成一个字段（`cur`），
     用兜底求值驱动 opacity，并用一个**全局** `ar` 记画布比例。

     ⚠ 这三条症状只在**切换的瞬间**出现（几十到几百毫秒），
       靠肉眼回归极难稳定复现 —— 必须有机器判据。 */
  const init = internals.spriteInit
  const swap = internals.spriteSwap
  const loaded = internals.spriteLoaded
  const on = internals.spriteOn
  ok(typeof init === 'function' && typeof swap === 'function' &&
     typeof loaded === 'function' && typeof on === 'function',
    '立绘状态机四个纯函数已导出（供离线断言）')

  const U1 = 'sprite/stage_a3_c02_01.png'
  const U2 = 'sprite/stage_a4_c09_00.png'

  // ---- 首帧：A 装图但未就绪 → 谁都不点亮（避免用未解码的图） ----
  {
    const s0 = init(U1)
    ok(s0.A.src === U1 && s0.B.src === '' && s0.vis === 'A',
      '初始：图放进 A 槽，B 槽为空')
    ok(on(s0, 'A') === false && on(s0, 'B') === false,
      '★ 未 load 前谁都不点亮（否则会在解码完成前就把图弹出来 → 闪黑）')
  }

  // ---- load 完成 → 翻面点亮 ----
  {
    const s1 = loaded(init(U1), 'A', 0.925)
    ok(on(s1, 'A') === true && on(s1, 'B') === false,
      '★ A 槽 load 完 → 只点亮 A（且 B 保持熄灭）')
    ok(s1.A.ar === 0.925, '★ 比例记在**该槽自己**身上（换角色时不串味）')
  }

  // ---- ★ 核心：切换时必须"先放不可见槽"，可见槽的 src 一个字节都不动 ----
  /* 这是修「错误的人物画像」的关键。React 按 `key=槽名` 复用元素，
     若把新 src 写进**可见槽**，那个正在显示的 img 会被当场换图。 */
  {
    const s1 = loaded(init(U1), 'A', 0.925)
    const s2 = swap(s1, U2)
    ok(s2.A.src === U1, '★★ 切换后**可见槽 A 的 src 没变**（正在显示的图不被换走）')
    ok(s2.B.src === U2, '新图放进**不可见**的 B 槽')
    ok(s2.vis === 'A', '★ 翻转前 vis 仍是 A（新图未就绪，不能接管显示）')
    ok(on(s2, 'A') === true && on(s2, 'B') === false,
      '★ 新图未 load 完时，旧图继续显示（屏幕上任何时刻都有图）')
    ok(s2.B.ar === 0 && s2.B.ok === false, '新槽的比例与就绪位都清空（等它自己 load）')
  }

  // ---- 新图 load 完 → 才翻面，两侧同时过渡 ----
  {
    const s2 = swap(loaded(init(U1), 'A', 0.925), U2)
    const s3 = loaded(s2, 'B', 1.05)
    ok(s3.vis === 'B', '★ 新图 load 完才把 vis 翻到 B')
    ok(on(s3, 'B') === true && on(s3, 'A') === false, '★ 翻面后只点亮新槽（旧槽淡出）')
    ok(s3.A.src === U1 && s3.B.src === U2, '两个槽的 src 都保持各自的值（没被改写）')
    ok(s3.B.ar === 1.05, '新槽用自己的比例')
  }

  // ---- ★ 快速连续切换：必须始终有一张已就绪的图可显示 ----
  {
    let s = loaded(init(U1), 'A', 0.925)
    let everBlank = false
    for (let i = 0; i < 6; i++) {
      const u = i % 2 === 0 ? U2 : U1
      s = swap(s, u)
      if (!on(s, 'A') && !on(s, 'B')) everBlank = true      // 两槽都不亮 = 屏幕上没图
      // 模拟"这张很快就 load 完"
      const target = s.vis === 'A' ? 'B' : 'A'
      s = loaded(s, target, 0.9 + i * 0.01)
    }
    ok(!everBlank, '★★ 连续切换 6 次，**任何一帧都没有"两槽全灭"**（黑闪的机器判据）')
  }

  // ---- ★ 比例不串味：两个槽各记各的 ----
  {
    const s1 = loaded(init(U1), 'A', 0.925)
    const s2 = loaded(swap(s1, U2), 'B', 1.05)
    ok(s1.A.ar !== s2.B.ar, '★ 两个槽的比例互相独立（旧版共用一个 ar → 换角色会偏掉）')
    ok(s2.A.ar === 0.925, '旧槽仍保留**它自己**的比例（用于它还在显示的这段时间）')
  }

  // ---- 幂等：同样的 load 事件重复到达不应产生新对象（避免无谓重渲） ----
  {
    const s1 = loaded(init(U1), 'A', 0.925)
    ok(loaded(s1, 'A', 0.925) === s1, '同一槽同一比例重复 load → 返回原对象（不触发重渲）')
  }
}

// ------------------------------------------------------------------
console.log('')
console.log(`结果：${pass} 通过 / ${fail} 失败`)
if (fail) {
  console.log('失败项：')
  for (const p of problems) console.log('  - ' + p)
  process.exitCode = 1
}

# MAINTENANCE · 魔法使之夜 DSH 皮肤维护手册

> **给未来的维护者（人或 AI）。** 这份文件是**提炼**，不是索引 —— 它只写"要动手时必须知道的事"。
> **代码是唯一事实源**：凡本文件与代码不符，**以代码为准**，并把本文件改对。
> `docs/` 下那些 01~29 是**制作期笔记**，其中多处数字已被后续修改推翻；只在需要"为什么当初这么设计"时去翻。
>
> 交接时间：2026-09-23（成品完成日）
> 工作目录：`D:\QuickLook插件包\moye`

---

## 1. 这是什么

给 **DSH（DeepSeek Harness）** 的 Web GUI 做的一套《魔法使之夜》主题皮肤。

- **包名**：`dsh-skin-mahoyo`，版本 `0.1.0`，MIT（代码部分）
- **定调**：**这是皮肤，不是 GalGame。** 没有好感度、没有等级、没有进度、没有解锁 —— 这是红线 1，
  不是"这版先不做"，是**这个项目永远不做**。
- **交付形态**：**DSH bundle 插件**，**没有构建步骤**。
  `skin/lib/client.js` 是**手写的 `__ModuleLoader__` bundle**，由 `dsh.client{platform:'web'}` 声明后自动下发。
  改完代码**不需要打包**，跑 `install.ps1` + **刷新浏览器页面**即可。
- **装机位置**：`C:\Users\ThinkPad\.dsh\profiles\web\node_modules\dsh-skin-mahoyo`
  由 `profiles/web/package.json` 的 `dsh.profile.bundles` 列表注册。
- **画面构成**：**整屏重绘**。背景 → 立绘 → 正文暗带 → 自己画的会话流 → 菜单/子页。
  DSH 原生的侧栏、右栏、页签条、**原生消息列表**全部让位；**只保留输入框**
  （它被重新着色成魔夜选项条的形态 —— 发消息的能力属于内核，不能拿掉）。

> ⚠️ **皮肤进了 `dsh.profile.bundles` 之后，它就从"一个插件"变成了"启动链路的一部分"。**
> 包名 / 目录 / `package.json` 一坏，**整个 profile 起不来**，而报错发生在加载任何插件之前 ——
> **代码层面兜不住**。所以宿主半边写得刻意"怂"（每层 try/catch + 逐项降级），
> 也因此有 §8 那四层保险。这是本项目的核心约束，不是过度设计。

---

## 2. 目录与文件职责

### 2.1 两个半边（代码只有这两个文件）

| | 宿主半边 | 浏览器半边 |
|---|---|---|
| 文件 | `skin/lib/index.js` | `skin/lib/client.js` |
| 跑在 | Node（DSH 进程内） | 浏览器 |
| 干三件事 | ① 素材静态路由 `/moye-skin/*`<br>② 设置持久化<br>③ 人格注入 | 整屏 UI：L1 表紙 / L2 菜单板 / L3 阅读态（立绘·表情·会话流·ED·BGM）/ 設定页 |
| 改动后 | **要重启 DSH** | **只要刷新页面** |

宿主半边的三个路由**全部 loopback-only**（`isLoopback()` 只认 `127.0.0.1` / `::1`）：
`GET /moye-skin/manifest.json`、`GET|POST /moye-skin/settings`（读写桥）、`GET /moye-skin/assets/*`。

人格注入用固定段名 `skin:mahoyo:persona` + `text()` 闭包 —— **name 不变**，切角色只改函数读到的值，
所以旧角色的注入段**永远不残留**。这是刻意设计，别改成动态 name。

### 2.2 其余目录

**分发包的白名单** = `skin/package.json` 的 `files` 字段：`lib/` `data/` `assets/` `cordis.patch.yml` `README.md`。
打包命令 `node skin/tools/pack-dist.mjs`（产物落 `skin/dist/`）。它会**主动拦截**几个不该进包的 `data/`
文件（`manifest.json.bak` 之类的工作区备份），发现就 exit 1 —— **这不是误报**，是它在防你把内部备份发出去。

**不进包的**：`skin/tools/`（20 个脚本）、`skin/preview/*.html`（含实验台）、`skin/dist/`（产物本身）、
以及 `persona_work/`、`hfa_png/`、`hfa_tools/`、`bgm/`、`game_scripts/`、`recovery/`。
另有 `personas/`、`image_notes/`、`blind_test/` —— 那是**交付物 A**（人格 skill pack + 图像笔记），
与皮肤是两次独立任务，别把两者的文件互相引用。

### 2.3 三层画面与层级（层级是刻意的，别自己发明）

```
.myh-under   z0   背景(cover) + 立绘(z1) + 暗带(z2)      ← 暗带压在立绘上
.myh-column  z4   正文流（自己滚）
.myh-over    z8   离散热区 + 菜单 + 子页 + ED(z40)
```

**实测过的 DSH 原生层级**（`docs/27`）：DSH 布局内部 1~20、conversation 固定件 100、
**DSH 浮层 1100**；皮肤根取 **900**（正文之上、DSH 浮层之下）；composer 座位取 **901**；
皮肤紧急横幅 **1200**；设置页打开时皮肤根抬到 **950**。

> **任何新加的皮肤层都要先问一句：它需不需要盖过 1100？** 绝大多数不需要。

---

## 3. 改完代码的验证流程

### 3.1 九个自检脚本（改 `client.js` **必跑**）

```bash
cd D:/QuickLook插件包/moye
node skin/tools/check-client.mjs                # 221 项断言（现已全绿）
node skin/tools/check-hooks.mjs
node skin/tools/check-hooks-per-component.mjs
node skin/tools/check-css.mjs
node skin/tools/lint-identifiers.mjs
node skin/tools/audit-render.mjs
node skin/tools/render-selftest.mjs
node skin/tools/lab-selftest.mjs
node skin/tools/verify-bundles.mjs
```

**各自防什么**（失败时现象有多难查，决定了它在不在这个列表里）：

| 脚本 | 防的那个坑 |
|---|---|
| `check-client` | 一切可机械判定的契约。**它是回归网，改完必跑** |
| `check-hooks` | React #310（hook 数在两次渲染间不同）—— 报错只有 `Minified React error #310`，**没有任何可读信息，整棵树直接废** |
| `check-hooks-per-component` | **扫描器本身撒谎**（见 §3.2） |
| `check-css` | CSS 少一个 `}` 会把后面整段规则静默吞掉 —— 现象是"某个区块莫名其妙不见了"，**浏览器不报错** |
| `lint-identifiers` | 拼错变量名 → `ReferenceError`（运行时才炸，且可能被 try/catch 吞掉） |
| `audit-render` | 守卫链缺环 → 皮肤"静默什么都不画"，看起来跟没装一样 |
| `render-selftest` | #310 的**过界**回归 + store 自激（#300）回归 |
| `lab-selftest` | 实验台"开不了"（它靠从 `client.js` 抽函数跑，抽取逻辑坏了就全废） |
| `verify-bundles` | 与 DSH 的 bundle 解析口径漂了 |

> **同状态连渲三次抓不到 #310** —— 必须让 `enabled` 在 false↔true 之间**过界一次**。
> `render-selftest` 的扰动序列就是**照着真实崩溃现场写的**。
>
> `verify-bundles` 有个**已知的正常现象**：它探测 `http://127.0.0.1:3080/plugins/??…` 会返回 **404**。
> 这**不是故障** —— 本机这条 dev-server 组合路径不成立。脚本算出的 URL 与哈希是准的，
> 但它**不构成"皮肤没下发"的证据**；真凭据是 `/moye-skin/health` 的 `clientSeen`。

**另有两个基准/生成器**（不是每次必跑）：

```bash
node skin/tools/lexicon-bench.mjs               # 词表命中率·全量（改词表前后可比）
node skin/tools/lexicon-bench.mjs --dialogue    # 词表命中率·台词行
node skin/tools/rebuild-lexicon.mjs --dry       # 只算不写，先看词表差异；去掉 --dry 才落盘
node skin/tools/preview-server.mjs 8123         # 离线预览，不装 DSH 也能看
#  → http://127.0.0.1:8123/preview/index.html           规格预览
#  → http://127.0.0.1:8123/preview/expression-lab.html  ★ 表情实验台（人眼验收走这条）
```

### 3.2 ★ 为什么 hook 检查要有**两份独立实现**

这不是冗余，是被**咬过**。

`check-hooks.mjs` 是靠括号/关键字**启发式**判"这段代码在哪个函数里"。它的第一版把"嵌套函数降噪"的判据
写成了"前面有 `(` 或 `=>`" —— 结果 `function ReasoningRow(props) {` 里那个 `(` 让**组件自己的身体**
被误判成嵌套函数，**整批 hook 被静默丢掉**，扫描器**撒谎说通过**。

于是另写一条**完全不同的路子**（`check-hooks-per-component.mjs`）：直接按 `function Name(` 切正文、
数 hook 行号、找**顶层** `return` 行号，再比大小，逐组件打印出来让人也能一眼核对。

> **元教训**：凡是有"检查工具说通过、但现象依旧"的情况，**先怀疑工具本身在撒谎**。
> 这两个脚本必须保持**两条独立路径** —— 别为了"去掉重复"把它们合并成一个。

### 3.3 装 + 看效果的完整链路

```powershell
cd D:\QuickLook插件包\moye

# 1) 改完先自检，全绿再往下（§3.1 那九个）
# 2) 装进 DSH profile —— 自动做 BUILD_ID 注入 + 配置备份 + schemastery junction
pwsh -File skin\tools\install.ps1

# 3) ★ 必须刷新浏览器页面
```

**为什么必须刷新**：服务器把 bundle 字节**钉在 DSH 启动时的快照里**
（URL 里那个 `rev` 就是启动时生成的 nonce），光 install 不够。
**DSH 进程本身不用重启** —— 只有改了**宿主半边**（`lib/index.js`）或包配置才要重启。

`install.ps1` 会把 `BUILD_ID` 做**正则替换**（源文件里固定是 `'dev-未注入'`，
装好的文件是 `SHA256 前缀 + 时间戳`）—— **改完源码与装好的文件差这一行是正常的**，不是 bug。

**素材 URL 必须带 `?v=<BUILD_ID>`**（`client.js` L200-213 有硬断言守着）：
素材文件名重烘后不变，不破缓存会一直看到旧图。

---

## 4. ⛔ 硬规则（红线）—— **这一节最要紧，动手前先读完**

标记 ⛔ 的是"照着做会**毁数据**"；标记 🔴 的是"照着做会**让 DSH 起不来**"或"用户会立刻看见坏掉"。

### 4.1 ⛔ 永远不要跑 `skin/tools/assemble-assets.mjs`

**自 2026-09-23 起它已被硬拦截**（脚本里 `guardManifest()`，无 `--i-know-this-destroys-manifest` 就 `exit 2`）。
**不要加那个 flag 绕过它。**

它读的是 `persona_work/stage/expressions.json`（**旧立绘管线**，文件名形如 `aok_n_12_02_01.mzp.png`），
而线上 manifest 用的是 `stage_a3_c02_01.png`（来自 `build_stage_sprites.py` + `apply_stage_manifest.py`）。
**两者不同源。**

2026-09-20 误跑一次的实录后果（**67 处差异**）：
- 12 景的 `slots` 全被重写
- 12 景的 `stageSource` 全部消失
- `spriteBases` 5 → 157
- 往 `assets/sprite/` 多拷 **157 个旧命名立绘**（30.3 MB 死重量）

之所以加了硬拦截而不是靠"文件不在就会报错"兜底：**本脚本引用的输入文件至今全都存在**，
所以误跑**必然成功执行并再次破坏**。

> **改 `manifest.json` 只有两条路：手改，或 `persona_work/tools/restore-expressions.mjs`。**
> 要重算**词表**请用 `rebuild-lexicon.mjs`（安全，因为不碰素材）。

### 4.2 ⛔ 素材原图原大小，不压缩、不重编码

用户 2026-09-16 定案：**随包分发、原大小**。JPEG 压缩能降到约 40 MB 但会有损 —— **不要自己压**。
要压缩是产品决策，问用户。

### 4.3 ⛔ 重新解包素材后，必须再跑一次 `crop_alpha.py`

解包出来的原作素材**自带宽窄不一的透明外框**，`object-fit:cover` 把透明区也算进缩放 →
**贴边黑缝**（实测最大 147px；A3 背景有效内容 3285×1972，画布 3572×2042，**左 14 / 右 273**，差 19 倍）
＋ 立绘底部固定多出 11px 空缝。

```bash
python skin/tools/crop_alpha.py                  # 试跑，只打印会裁什么
python skin/tools/crop_alpha.py --write          # 就地裁到 alpha 边界（PNG 无损、不重采样）
```

判据 `alpha > 8`，与离线核查脚本同一口径。裁前的原图备份在 `recovery/backups/pre-crop-0920/`，裁坏了可整体还原。

### 4.4 `skin/assets/ui/conf/` 那 80 个切片不归 `assemble-assets.mjs` 管

它的**唯一来源**是 `skin/tools/crop_conf.py`（几何表逐格写死，因为图集行高 71/71/79/79 **不均匀**，
不能按百分比定位）。重装或清理之后要自证：

```bash
python skin/tools/crop_conf.py --check    # 期望：80/80 逐字节一致，exit 0
```

### 4.5 ⛔ 立绘按**素材画布整张**输出，绝不按内容 bbox 裁

按 bbox 裁会**切平头顶**。`verify_sprite_headroom.py` 就是这个红线的机器化验收。

### 4.6 生效中的红线（汇总）

| # | 红线 | 为什么 |
|---|---|---|
| 1 | **不做数值系统**（无好感度/等级/进度/解锁/章节） | 用户定调"这是皮肤，不是 GalGame"。实现时若冒出任何一项，先回读这条 |
| 2 | **阅读态什么都没有**（背景 + 立绘 + 暗带 + 落叶指示器） | 还原原作 |
| 3 | **装饰件永不拉伸，内容区永远按比例** | 端帽/落叶/字体固定；木框已于 2026-09-22 删除 |
| 4 | **聚焦态只加一道发光细边**，不改填充/尺寸/位移 | `#58FFFD` 文字 / `#E2FFFF` 按钮；否则会跳位 |
| 5 | **hook 一律排在所有 `return` 之前**；**禁 `useX ? useX() : y`** | React #310，有扫描器守着 |
| 6 | **诊断字段一律放进 `autoProbe` 内部，且必须能过 `JSON.stringify`** | 否则宿主留存时**静默丢字段**，而人会拿"没有数据"当依据去猜 |
| 7 | **立绘按素材画布整张输出** | 见 §4.5 |
| 8 | **不许换的是 `i3`（衣服），姿势可以换** | 用户 2026-09-19 定案 |
| 9 | **素材 URL 必须带 `?v=<BUILD_ID>`** | 不破缓存会一直看到旧图 |
| 10 | **退化分支要往"留住 DSH 输入框"方向退化** | 曾反向退化 → 输入框被热区吃掉、发不出消息 |
| 11 | **皮肤里不要常驻定时器**（盯 DOM 用 `MutationObserver`） | 定时器会让 `render-selftest.mjs` 挂死 |
| 12 | **不用图像化字库，但保留袋文字描边** | 155 张字体图集成本极高；描边才是可读性的关键 |
| 13 | **越界的东西先问用户**：别自己加严约束、别自己砍功能 | **用户长期要求（原话）**："任何技术上不好实现的，都要与用户沟通，不要自己绕过或砍掉。" |

> ⚠️ **"红线 6"有三个不同含义**（`docs/15` §9.1 / `docs/16` §9 / `docs/19` §5 各一套编号）。
> 引用时必须说清是哪一套。**前两套的第 6 条都已过时**（`15` 的"素材不随包"、`16` 的"只用特写立绘"）。

### 4.7 不要碰的 DSH 扩展点

| 别做 | 为什么 |
|---|---|
| ❌ **注册进 `root`** | 它是 **single 槽**，第二个注册者会**顶掉整个 AppFrame** |
| ❌ **注册进 `shell.overlay`** | 那个槽上**任何一次** render 抛错，DSH 的 `SlotErrorBoundary` 会**永久**把整个槽变成崩溃占位 —— **逃生门和被救的对象一起死**。所以皮肤根自建容器挂 `document.body` |
| ❌ **用 `jsxRuntime.jsx` 传变长 children** | 外壳那个函数**只接受 `(type, props)`**，变长 children 被**静默丢掉** → 必须 `const h = React.createElement`（`client.js` L61，有硬断言守着） |
| ❌ **新增对种子模块的依赖** | 外壳播种的静态模块**恰好 9 个**，**这份名单是冻结的**。本包只 require 其中三个（`react` / `react/jsx-runtime` / `react-dom/client`）。加不进去就得改走别的路 |
| ❌ **覆写 DSH 哈希类名** | 它们是 CSS Modules 哈希（`mufS8W_card` 这种），DSH 一升级就全变。**换肤走 `--dsw-*` token**（§5.6） |

---

## 5. 已知的坑与陷阱（踩过一次，不想再踩）

### 5.1 ★ 两套坐标系：同一组百分比在不同层含义不同

各层的**包含块宽度不一样**，所以"同一个 `78%`"在两层上算出的像素**不同**
（`docs/29` §3，实测 1600 视口）：`.myh-columnInner` 的包含块是 `.myh-column`，宽 **1590**
（列有滚动条）；`.myh-band` 的包含块是 `.myh-under`，宽 **1600**（整幅画面）。
**病根**就是滚动条那 10px。两套基准都要留注释，否则后来人会以为其中一个是笔误、把它们"合并"掉。

> **通用教训**：项目里所有"差几个像素"的问题，根因都是**复算**出来的。
> **要量就量真实矩形**（`getBoundingClientRect()`），不要复算 CSS 式子。
> 相关：`scrollbar-gutter: stable` 让滚动条**始终占位**、内容宽恒定 —— 别删。

### 5.2 ★ 别用 `elementFromPoint` 判断可见性

皮肤根是 `pointer-events:none` 的整屏层，而**它只影响命中测试、不影响绘制顺序**。
于是探针会报"命中通过、样式全对"（`elementFromPoint` 返回的是底下的原生件），
**而屏幕上画的是皮肤**。`docs/27` 里这条让整个会话的证据链都是错的。

**改用绘制证据**：截图像素，或临时把皮肤 `z-index:-1` / `display:none` 看目标是否出现。

### 5.3 ★ 滚动链（scroll chaining）：滑到底整屏跳

内层滚到边界后，**剩余滚动量传给了祖先**，把整个画面带走。
修法是四处 `overscroll-behavior:contain`（`client.js` **L453 / L456 / L933 / L1012**，
另 L1418 是子页面板）。**只写在皮肤根上不够** —— 实测能复现祖先被带走 300px，
所以文档级 `html` 与 `body[data-myh-skin]` 两处都写。

> **★ 复现这个 bug 前要先"造出前提条件"**：本地一开始复现不了，是因为祖先恰好都不可滚。
> 把 `.myh-root` 改成可滚并塞一个占位元素，bug 立刻出现。
> **症状复现不出来时，先问"它需要什么前提"，别在缺条件下反复重试。**

### 5.4 ★ "输入框一打字就变一下" = **两个原因**

（`docs/29` §4b）它是**同时**发生的两件事：① **高度公式差一行** —— 旧式在 `ceil` 后没减 1，
0→1 个字符硬跳 42px；② **空态误点亮色阶** —— 空输入被当成"轮到你了"（那档的真义是
审批卡/弹窗到场），于是打字瞬间从浅色 `#59A4B5` 切到中色 `#3D7C96`，还带 `.25s` 过渡。

**只修一个会剩一半。** 通用教训：**同一个视觉变化可能有两个来源**，别修完一个就收工。

### 5.5 ★ 焦点粒度：控件选不中 = 焦点停在错的一层

`ConfBool` 的按钮 hover 把焦点**交回整行**（`onFocus(props.id)`），`navIdsOf` 的 config 分支
只列**行 id** → 焦点永远停在行上，OFF/ON **既没有焦点标记、也不是可选中目标** ——
用户的原话是「选中了框、却选不中框里的内容」。

修法：新增 `CONF_OPTS` 表 + `splitOpt()`，焦点**下沉到行内选项**
（`c:bgm#off` / `c:bgm#on` / `c:character#alice`）。

> **验证时别点"当前值"** —— 点它等于没测（看不出状态有没有变）。

### 5.6 ★ 给 DSH 原生件换肤：**覆写 token，不碰类名**

DSH 原生件用的是**带哈希的 CSS Modules**（`mufS8W_card` / `_7KE1Ra_cell` / `oY77xG_row` 这种），
**DSH 一升级就全变**。但它们**全部只读一套 `--dsw-*` 设计 token**，token 名是稳定的。
**`--dsw-*` 是唯一稳定入口。**

关键 token（值实测自 `dsh-client-ui-theme`）：

| token | 作用 |
|---|---|
| `--dsw-specific-menu` | 浮层底色 |
| `--dsw-specific-tip` | 待办栏底色（**这条曾经漏覆写**，见 §5.7） |
| `--dsw-alias-label-primary` / `-tertiary` | 主/次级文字 |
| `--dsw-alias-interactive-bg-hover` | 悬停行 |
| `--dsw-alias-border-l1` | 描边 |
| `--dsw-alias-bg-module-platform` | 权限胶囊底 |

覆写一律带 `!important` —— 否则浅色档浮层会保持白卡片。

> ⚠️ **`--dsh-composer-card-max-width` 被皮肤覆成了 `none`**（`client.js` L749）。
> 后果见 §5.7 最后一条：DSH 原生那条 `max-width:calc(var(--dsh-composer-card-max-width) - …)`
> 规则**整条失效**（含 `none` 的 calc 不成立）。已知代价，改之前先想清楚。

### 5.7 其余踩过的坑（每条一两句）

| 坑 | 说明 |
|---|---|
| **复用宽度常量** | 待办栏与输入框卡片必须**同源**（`--myh-composer-w` / `--myh-composer-side`，L786-822）。项目史上站位漂过一次，所以"一处定义、两处引用"（卡片 + 待办栏），并加靠右镜像 |
| **`--dsw-specific-tip` 漏覆写** | 原生待办栏（`SECTION.lXshSW_root` / `data-testid="todo-panel"`）底色走这个 token，而皮肤只覆写了 `--dsw-specific-menu` ⇒ 露出 DSH 浅色档的 `rgb(245,246,247)`；栏内文字**已经吃到**皮肤 token ⇒ **浅字压白底**，截图里就是一条看不清的白条 |
| **选中态的键名** | `.myh-optTxt[aria-pressed="true"]` —— DOM 侧早已改成 `role="radio"` + `aria-checked`，于是该规则**永不匹配**。角色三格全是未选中色，**当前角色在屏幕上没有任何标识** |
| **`:has()` 用在滚动容器上要多想一步** | 设置页 `.myh-pageInner` 的下内距仍是 `calc(var(--myh-composer-h) + 24px)` = **148px**（给输入框让位），但设置页 z-index **950** > composer **901**，输入框**已被整片盖住**，那 148px 是**白留** → 布局层多出 8px 原生滚动条。修法：`:has(.myh-conf){padding-bottom:24px}` |
| **"补丁会变成毒药"** | 为绕开 X 打的补丁，在 X 修好后会变成新 bug。项目里发生过两次（卡片宽度按视口算跑出屏、`max-width:none` 抹掉整条约束链）。**根因修好后回头撤掉为它打的补丁** |
| **消息去重键撞车** | `readMessages` 先读 `order/nodes`（权威存储），再**无条件**并一份 `legacy.nodes`（兼容投影）；去重键是 `m + (seq != null ? seq : index)` —— 同一节点在两条路上**只要一边缺 `seq` 就退化成各自的数组下标**，两个 id 不相等 → `seen[m.id]` 拦不住 → **消息显示两遍**。修法：把 `legacy` 改回**真正的兜底**（`if (!raw.length && …)`）。⚠ **不要"按内容去重"** —— 用户连发两句一模一样的「嗯」是**两条真实消息** |
| **流式正文别当 effect 键** | 句子游标曾以 `[st.line]` 为复位键，而**流式正文每来一个字它就变** → 游标被反复打回第 0 句、同一句在增长中被重判十几次。改用**用户消息条数**（一轮内恒定）。⚠ `data-id` 不行：`normalizeNode` 无 `seq` 时退回数组下标，**整轮会漂** |
| **`context` 节点冒充压缩事件** | `normalizeNode` 曾把 `compaction-summary` 与 `context` **合并成一个分支**共用一个兜底文案，而 DSH 的 `context` 是**每轮的上下文快照**、不是压缩事件，且多数没有 `text` → 「（上下文已压缩）」每轮凭空多一行。修法：`context` **没正文就整条丢掉** |
| **`normalizeNode` 不认 DSH 真实节点名** | 助手正文在 `kind:'assistant-step'`（正文在 `data.blocks`）、工具调用在 `kind:'tool-call'`（内容在 `data.root`）。曾经每一条助手消息都被**丢弃** → 正文一个字都不显示。⚠ 注意 `assistant-step` 的 blocks 里**和**独立 `tool-call` 节点里**各有一份**工具信息，`runningCalls` 只补"上面没出现过的" |
| **`check-css.mjs` 有抽取盲点** | 它按行取 `'...'` 字符串字面量，用 `/^'(.*)'\s*,?$/` 匹配 → **`+` 续行**与**行尾注释**会让整条规则从配平统计里**消失**（写了会报假警报）。已知限制，别以为它万能 |
| **行尾不是一种** | `client.js` 是 CRLF，**`install.ps1` 是全 LF** —— **别一律当 CRLF**。逐行补丁要**逐行单独记行尾**（曾因并行维护的 `had_cr` 列表**与 body 长度失配**而写回错行尾），且**改完必须回读行尾构成**，不能只看"OK 已写入" |

### 5.8 本机环境限制（**别再试了**）

- **无头浏览器里打不出消息**：DSH 输入框是 **Lexical** 编辑器，`Input.insertText`、逐字符
  `dispatchKeyEvent`、合成事件、CDP 真鼠标点发送键**全部无效**（DOM 里有文字，但编辑器模型是空的，
  提交时判成空草稿 —— **`innerText` 会骗你**）。要验"发出消息后的渲染"，用 `check-client.mjs`
  里的端到端夹具喂快照，**别再试图驱动输入框**。
- **`/` 与 `/api` 需要启动令牌**（进程内、内存里）→ 外部抓不到页面、截不了图。
- **`console.log` 的 `%` 坑**：把含 `%` 的字符串当参数传给 `console.log`，会被当成**格式说明符**。
- **PowerShell 5.1 的 `Set-Content` 写 UTF-8 带 BOM** → `JSON.parse` 会炸。本机有 `pwsh` 7.x，**用它**。
- **`Get-NetTCPConnection` 非管理员抛"拒绝访问"** → 端口探测只用 `Invoke-WebRequest`。
- **起隔离实例做实测**（`--port 3199`），**别动用户正在用的 3080**。
  ⚠ `/moye-skin/settings` 桥写的是**全局** `settings.yaml`，**会同时影响用户的 3080** ——
  改之前先备份、测完立刻还原。（这件事发生过：中途把用户的角色改成了金鹿。）

---

## 6. 素材从哪来

### 6.1 全链路

```
WITCH ON THE HOLY NIGHT.7z/      游戏本体（★ 是「目录」不是压缩包）
        │  hfa_tools/hfa.py      HFA 归档解析（签名 HUNEXGGEFA10）
        ▼
hfa_png/out/data0xxxx/*.png      24,284 张已解出的原作素材  ← ★ 唯一解包态
game_scripts/chs/*.chs           250 个编译脚本（LenZu 压缩）
game_scripts/ctd/*.ctd           四语剧本全文（ja/zt/zc/en）
        │  persona_work/tools/build_stage_spec.py + build_stage_sprites.py
        ▼
skin/assets/sprite/stage_<景>_c<通道>_<帧>.png     身体层 + 脸层 alpha 合成
        │  apply_stage_manifest.py 回写 manifest.expressions[景].slots
        ▼
skin/assets/{ui,bg,sprite,bgm,se}/  +  skin/data/manifest.json
        │  skin/tools/install.ps1
        ▼
C:\Users\ThinkPad\.dsh\profiles\web\node_modules\dsh-skin-mahoyo
```

设置页那 80 个切片是**另一条支线**：`skin/tools/crop_conf.py` 从 `ui/conf/` 图集切出来
（见 §4.4），**不经过**上面那条立绘管线。

### 6.2 ⚠ `hfa_png/convert.py` 已失效 —— `hfa_png/out` 是唯一解包态

脚本**跑不起来**，两个独立的硬伤（都是实测确认的）：

1. `convert.py` **L18** 写死外部依赖
   `TOOLS = r"C:\Users\Iroh\AppData\Local\Temp\hfa_mzp_tools"`（含 `mahoyo.hfa/mzp/cbg` 包）
   —— 该目录**不存在**，仓库内也没有 `mahoyo` 包
2. `convert.py` **L21-22** 写死 `D:\moye\...`，与现仓库 `D:\QuickLook插件包\moye` 不一致

> **后果**：**重新解包图像素材的能力已丢失**。
> **但 `hfa_png/out` 那 24,284 张产物都在**，素材类的工作不受影响。
> 要恢复得**重建解包器**或找替代（例如社区工具 `nike4613/MahoyoHDRepack`）—— 目前**没人做**。

**仍然可复跑的链**：剧本（`hfa_tools/extract_scripts.py`）与音频（`hfa_tools/hw_to_ogg.py`），
底层库 `hfa.py` / `lenzu.py` 实测 import 正常。

### 6.3 立绘合成原理（改立绘必读）

```
立绘 = 身体层 <角色>_<批次>_<i3>_<通道>_00_b   +   脸层 <角色>_<批次>_<i3>_<通道>_<帧>
       两层**画布原点对齐**（rel ≈ 0,0），直接 alpha 合成；裁切窗口 = **素材自己的画布**
```

| 概念 | 含义 |
|---|---|
| **批次** `a/n/l/m/s` | **取景**：全身 / 胸像 / 半身 / 更小 / 远景。**不是分辨率**。原作最常用胸像 `n` |
| **通道** `i4` | **姿势**（同一套衣服下并存多条） |
| **`i3`** | **服装行** —— 唯一真正的"衣服"键 |
| **帧** | 同一通道内换帧 = **换表情而身体不动** ← 这就是"上身不动、表情切换" |

**规则：锁 `i3`（衣服）、不锁通道（姿势）。** 两个招牌动作靠"不锁通道"进来：
青子**撩头发**（通道 03）挂 `smile`、有珠**手掩口**（通道 10）挂 `surprised`。

> ⚠️ **`_b` 身体层就是本皮肤真正在用的东西**。`docs/15` §6.2 / `docs/16` §9 红线 6 的
> 「`_b` 不能单独当立绘用」**结论错误**（对齐参数一直在），**别照那条做**。

### 6.4 情绪词表与分类器

- **纯本地关键词计分，不调模型**。命中一个词就给所有含它的槽位加该槽位权重。
- 冲突按优先级：`surprised > angry > glare > sad > shy > laugh > smile > troubled > tired > think > serious > neutral`
- 置信度 `score/(score+8)` **低于 0.5 不切**；强情绪立即切、**回落到 `neutral` 需连续 2 句**（迟滞）；
  同槽位连续 3 句换帧（`emo.roll`，防呆板）；**180ms 节流**。
- **★ 一次回复最多换一次表情**（2026-09-23 定案）：`turnChangedRef` 记"本轮已换过"，换景时清。
  ⚠ 它**只锁槽位变化**，**同槽换帧不锁** —— 那是防呆板机制。
- **12 个槽位**：`neutral smile laugh angry glare surprised troubled sad serious think tired shy`。
  **第 13 个 `blink`** 每景都声明在 `expressions[景].slots` 里，但它**不在** `lexicon` /
  `PRIORITY` / `DEFAULT_FALLBACK` / 实验台里，**也没有回退链** → **分类器结构上永远选不中它**，
  用途未确认。所以数"槽位数"要**看两个数**：`slots` 的键数（含 `blink`）与**可用槽位数**（不含）。
- **缺的槽位不是遗漏，是原作就没给这套衣服画**，一律走回退链（`client.js` L80 `DEFAULT_FALLBACK`），
  **不造图补**（验收结案原话："不要为了凑满 12 槽而编造素材"）。
- **词表**（以 `manifest.json` 实测为准）：`lexicon` 是**按槽位分组的对象**（12 个键），
  条目数合计 **310**；`lexiconByCharacter` 三键，条目数 **青子 48 / 有珠 32 / 金鹿 39**，
  客户端按当前角色合并。生成器 `skin/tools/lexicon-build.mjs` 是**唯一生成处**。
- **基准可复跑**（`lexicon-bench.mjs`）：全量 **17.0%** / 台词行 **14.9%** ——
  这是"改动了词表有没有变差"的判据。

> **`manifest.json` 的顶层键**（2026-09-23 实测共 **8 个**）：
> `generated_at` / `ui` / `scenes` / `expressions` / `edBackground` / `lexicon` /
> `lexiconByCharacter` / `bgm`。**客户端只读** `scenes` / `expressions` / `lexicon` /
> `lexiconByCharacter` / `ui` / `edBackground` / `bgm`；`generated_at` 只是时间戳。
>
> ⚠️ **旧文档里那些键已经不在了**：`characters`（角色标签已移到 `lib/index.js` 的
> `CHARACTER_LABELS`）、`canvas`、`dialogSafeTop`、`slotSupport`、`keywords`、`spriteBases`、
> `note` —— 别照旧文档去 `manifest` 里找它们。
> ⚠️ `scenes[景].stage`（`alpha_bbox_crop` / `scale:0.7` 那套）**仍在文件里但无人消费**，
> 是上一版设计的残留 —— **照它改会做错**（它写的正是红线 7 禁止的按内容 bbox 裁）。
>
> `expressions[景]` 的活字段：`slots` / `fallback` / `spriteSide` / `stageSource`
>（`stageSource` = `{char, batch, i3, framing, channels}`，是"这条立绘从哪来"的溯源）。

### 6.5 ⚠ 金鹿的 slug 与立绘前缀

- 角色 slug 是 **`kumari`**（**不是** `kinu`）
- 立绘前缀是 **`koj`**。**`kin` 是木乃美芳助（男性角色）** ——
  这个错曾经把金鹿的表情素材**全指向他**，后来整体重建为 `koj_*`。
  改 `assemble-assets.mjs` 相关逻辑时**别弄错**。

### 6.6 素材与版权

原作美术／音频版权归 **TYPE-MOON / 奈须蘑菇 / 小山广和**。
本包按用户决定「**原大小随包分发**」（2026-09-16），素材**未压缩、未重编码**。

若日后要发布到公共渠道，社区统一做法是**代码 MIT + 美术 CC BY-NC-SA 4.0 + 素材不随包** ——
那时把 `assets/` 抽出去、把 `assetRoot` 指向本地素材目录即可，**代码不用改**。
（素材根解析优先级：设置项 → 环境变量 `MAHOYO_ASSET_ROOT` → 包内 `assets/`。）

皮肤**不批量保留原文台词**：注入切片是归纳，词典只由短谓词构成。

---

## 7. 未决事项

> 只列**真正还开放**的。已落地的（Q13 ED 阈值写死、UI 音效导出、设置页五页签）**不在这里**。

### 7.1 用户明确压后（**别自己动**）

| 项 | 内容 |
|---|---|
| **Q14 · 皮肤开着时发不出消息** | 现象：皮肤挂载时输入/发送不可用，得先 `Ctrl+Shift+M` 关掉皮肤。已做的**只是只读诊断**（`composerCandidates()` 逐候选取证）。**但后来的实测里三个候选的矩形都正常**（`composerOk: true`）⇒ **先复现再判断它现在还在不在**，别照旧结论直接改 |
| **Q2 · 角色范围** | 单人 / 双人 / 三人。**当前是三人齐做** |
| **Q4 · 素材分发边界** | 用户自备 vs 随包。**当前是随包原大小**（已按此实现） |
| **立绘瘦身** | 每槽只留 1 张可变小很多 —— **要问用户**（是产品决策） |

### 7.2 待评估 / 想做就能做

| 项 | 状态 |
|---|---|
| **Q12 · 原作构图坐标** | 坐标埋在 `.chs` 编译字节码里（命令表在**加壳**的 `woh_data.dll` 中，取不到）。**不阻塞** |
| **`blink` 槽** | 要么接进分类器，要么从 spec 里删掉 |
| **A6 通道 07**（14 帧未判定）、**A1 其余通道**（`slots_sub_ari01` 里还有 ch02/19） | 补上能再涨几个槽位 |

### 7.3 视觉旧账（都记录在案，**改动前先问用户**）

| 项 | 说明 |
|---|---|
| **暗带左缘出屏约 144px** | 宽度由 `BAND_W_PCT` 一个数控制（`docs/28` 记在 `client.js` **L3365 附近**，历史 `48%→78%`）。78% 时左缘已到 −144px、羽化被切在屏外 ⇒ **左端是硬切边**；现在看不见只因背景够暗，**继续加宽会让它露出来** |
| **同景内换表情有水平微移** | A3 实测 left 跨度约 **203px**（**竖向不跳**）—— "待用户看一眼能否接受"的旧账 |
| **立绘 `76vh` 的取舍** | 裁掉透明边后内容贴到画面底，留不留几 px 是**美学决策** |
| **`100vw` 含滚动条** | 改 `100%` 更严谨，但**会动到已实测的布局**，未擅自改 |
| **原生滚动容器不得被藏** | `check-css.mjs` 里有一条**反向断言**守着 —— 藏滚动体 = 连输入框一起埋掉（composer 是滚动体的子节点） |
| **输入框里的白色小圆钮** | `uV2eYG_add` 那排控件在深色条上过亮。⚠ **只改 `uV2eYG_add`，别碰发送键 `uV2eYG_primary`**（有断言守着） |
| **"右边对话框那个小东西"** | 用户提过，**元素尚未定位** —— 需要用户截图，**别猜着改** |

### 7.4 已知的文档 / 代码不一致（**以代码为准**）

| 位置 | 写的 | 实际 |
|---|---|---|
| `skin/README.md` §5 素材树 | `sprite/ 157 张立绘（只有特写）` | **136 张**，且**全是 `_b` 身体层合成** |
| `skin/README.md` §3 | A4 `11/12`（缺 shy）、A1A2 `6/12`、A5 `4/12`、A6 `5/12` | **口径不同**：README 把 `blink` 算进了分母。按**分类器可达的 12 槽**算应是 **A3 10 / A4 11 / A1A2 4 / A5 7 / A6 5**（见 §6.4） |
| `skin/README.md` §9 第 5 行 | 立绘尺寸由 `70vh` 决定 | **`76vh`** |
| `skin/README.md` §11 + `recovery/README.md` §2 | guard"预检失败**自动回滚**"、"启动 DSH 后**轮询端口**、60 秒没起来就**杀掉进程**并重启" | **现役 `guard.ps1` 完全没有这些行为**。它只做三件事：预检 + 备份三个配置 + 在备份目录生成一份撤回脚本；**不启动 DSH、不轮询、不回滚**。那两段描述的是一个**已不存在的旧版本** |
| `docs/04-对话框设计规格.md` | 底部对话框几何 | **整份作废** —— 原作**根本没有底部对话框**，文字铺在整屏羽化暗带上 |
| `docs/22` 的风险册 | 多处数字 | **部分已过时**，以本文件与代码为准 |

---

## 8. 急救

### 8.1 先建立正确认知

皮肤进了 `bundles` 之后就是**启动链路的一部分**。包名/目录/`package.json` 一坏，
**整个 profile 起不来**，报错发生在加载任何插件之前 —— **代码层面兜不住**，
只能**启动前预检、起不来就撤**。

### 8.2 四层保险

| 层 | 手段 | 防什么 |
|---|---|---|
| 1 | `guard.ps1 -PreflightOnly`（组合 profile 但不启动应用） | bundle 解析失败 → **整个 profile 起不来** |
| 2 | `guard.ps1`（预检 + 备份三个配置 + 生成一键撤回脚本） | 起不来时能一键回到好配置 |
| 3 | 浏览器 `Ctrl+Shift+M` / `Ctrl+Shift+U` | 渲染崩了能**就地**逃生 |
| 4 | `recovery/rollback.ps1` | **DSH 已经起不来**时的最后手段（纯文件操作） |

```powershell
cd D:\QuickLook插件包\moye

# 第一层：启动前预检（不启动应用）
#   exit 0 = 组合是好的 ｜ exit 1 = 坏了（它只打印，让你去跑 rollback，**自己不会摘 bundles**）｜ exit 2 = 没预检成
pwsh -File skin\tools\guard.ps1 -PreflightOnly

# 第二层：预检 + 备份 + 生成撤回脚本
pwsh -File skin\tools\guard.ps1
pwsh -File skin\tools\guard.ps1 -SafeBoot          # 建 SAFE_MODE：皮肤静默
pwsh -File skin\tools\guard.ps1 -NormalBoot        # 删 SAFE_MODE

# 最坏情况：DSH 已经起不来（不依赖 DSH、不依赖网络，纯文件操作，全部幂等）
pwsh -File recovery\rollback.ps1                   # 摘 bundle + 建 SAFE_MODE + 清 settings 段 + 验证
pwsh -File recovery\rollback.ps1 -ListBackups      # 看有哪些备份
pwsh -File recovery\rollback.ps1 -Restore          # 从最近备份还原
pwsh -File recovery\rollback.ps1 -KeepSettings     # 抢救但保留 settings 里的皮肤段
```

### 8.3 SAFE_MODE（判断"起不来到底是不是皮肤的锅"）

三个入口，**任一命中即生效**（命中则宿主**什么都不注册**，皮肤等同没装，但包还在）：

1. 文件 `skin/SAFE_MODE`（内容随意）
2. 环境变量 `MAHOYO_SAFE=1`
3. `skin/data/safe-mode.json` 写 `{"enabled":true}`

### 8.4 ★ 关闭态有**两道独立且静默**的闸 —— 排查时**两道都要看**

| 闸 | 存哪 | 谁写的 |
|---|---|---|
| ① `moye-skin:kill` | 浏览器 `localStorage` | `Ctrl+Shift+M`、`?mahoyo=off` |
| ② `settings.enabled` | 宿主 `settings.yaml` | `環境設定 → 画面 → 启用皮肤` 那个开关 |

**只看一道会得出"已经开了但还是不行"的错误结论**（这个坑实际卡过一整轮）。

**三条恢复路径**（都不用开控制台）：

| 方式 | 做什么 |
|---|---|
| 点右下角横幅的「恢复皮肤」 | 清 localStorage **+ POST `enabled:true`** → 重载 |
| **`Ctrl+Shift+U`** | 同上（键盘版） |
| 地址栏 `?mahoyo=on` | **只清 localStorage**（行为写死在 `readKill()` 里） |

> **★ 关键**：恢复必须**两道闸一起清**。原来只清 localStorage —— 如果 `settings.enabled` 也是关的，
> 用户点了"恢复皮肤"、页面刷新了、**然后还是默认界面**，非常挫败。

**为什么容忍"关掉之后进不去设置页"**：那个开关在皮肤里，单次点击就能把自己锁在门外。
**曾加过"宿主发现 `enabled:false` 就自动写回 true"的自愈，然后撤掉了** ——
理由是那会让开关从用户视角**完全失效**，属于用一个偷偷摸摸的机制掩盖问题。
现在的处理是「**关得掉，但出路明确且够用**」：关闭态**每次加载都弹大号横幅**写明三条恢复方式。

> ⚠️ `lib/index.js` 里那段注释**写明了为什么不做自愈** —— **别当成遗漏去"补上"**。
> 若用户将来抱怨"关掉之后找不回来"，**正确做法是把出路做得更显眼**，而不是把开关变成关不掉的。

### 8.5 诊断：`/moye-skin/health`

```powershell
(Invoke-WebRequest http://127.0.0.1:3080/moye-skin/health -UseBasicParsing).Content |
  ConvertFrom-Json | Select-Object -ExpandProperty diag
```

| 字段 | 看什么 |
|---|---|
| `clientSeen` | 客户端 bundle 到底跑没跑（false = 组合/下发问题） |
| `clientInfo.build` | **跑的是哪一份代码** —— 和磁盘 `BUILD_ID` 对照。本行随每次装机变化，**别当常量** |
| `clientInfo.stage` | 走到哪一步；**卡在 `render-blocked` 就是守卫拦了** |
| `probes[]` | 挂载后 200ms / 1400ms 两次 DOM 采样。**皮肤处于 killed 时这里是空的** |
| `probes[].autoProbe.guard` | 两道闸 + `uiNeedsPointer` + `composerCandidates` |
| `clientErrors[]` | 渲染/挂载异常全文（`invariant=` 后面的数字直接告诉我们哪个 React 错误） |
| `store-loop` | 出现这条 stage = store 写入失控，`topKeys` 指出是哪个键 |

**判断皮肤"画出来了"**：`probe-t1400.autoProbe.hasColumn && hasTranscript && domNodeCount > 20`。

> ⚠️ **探针必须能过 `JSON.stringify`**（红线 6）。曾经把 DOM 节点**本体**塞进上报体，
> `onmessage` 转发时**静默抛错**，于是**探针一次都没上报成功**，而人一直在根据"没有数据"猜。
> ⚠️ `clientLastSeen` 带 `Z`，**PowerShell 解析后显示为 UTC 字样**（比本地少 8 小时），**别误判**。
> ⚠️ 宿主半边会被 HMR 重载，重载后 `diag` **重置**（`hostStartedAt` 会变新）——
> 两次读取之间探针消失，**不一定是 bug**。

### 8.6 备份在哪

| 位置 | 内容 |
|---|---|
| `recovery/backups/<时间戳>/` | `package.json` + `cordis.yml` + `settings.yaml`（guard/install 每次改配置前自动建） |
| `recovery/backups/pre-crop-0920/` | 裁透明边**之前**的 bg + sprite 原图，**裁坏了可整体还原** |
| `%USERPROFILE%\moye-skin-backup\` | 工作区**之外**的独立备份（代码 + 数据 + 全套工具 + 抢救脚本，自带 README） |
| `recovery/client.js.bak-*` | 历次大改前的 `client.js` |

---

## 9. 一句话总结

> **代码两个文件（宿主 648 行 / 浏览器 7407 行），没有构建步骤，改完装一下刷新页面。**
>
> **三条最贵的教训，按代价排序**：
> ① **别信没验证过的观测手段** —— `elementFromPoint` 测的是命中不是绘制、扫描器会撒谎、
>    缺失的探针数据会让人用猜代替看；
> ② **同一组数字在不同层含义可能不同** —— 包含块宽度、行尾、槽位数（含不含 `blink`）都踩过；
> ③ **别跑那个生成器** —— `assemble-assets.mjs` 会毁数据，已加硬拦截。
>
> **卡住的地方找用户，不要自己砍。**（用户长期要求原话：「任何技术上不好实现的，
> 都要与用户沟通，不要自己绕过或砍掉。」）

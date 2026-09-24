# dsh-skin-mahoyo · 《魔法使之夜》DSH Web GUI 皮肤

> 给 DeepSeek Harness 的 Web GUI 做一套「魔法使之夜」主题皮肤。
> **这是皮肤，不是 GalGame** —— 没有好感度、没有等级、没有进度、没有解锁。
>
> 界面元素全部取自原作素材；阅读态什么都没有，点击空白处唤出菜单。

> **★ 接着做的人先读这份维护手册**：`docs/MAINTENANCE.md`
> —— 里面有目录职责、验证流程、13 条红线、踩过的坑、素材链，以及未决事项。
> （制作期的 `docs/01`～`29` 编号笔记已归档到 `.tmp/docs-archive/`，只在查
> "为什么当初这么设计"时才需要翻它们。）
>
> **⚠️ 改了 `lib/client.js` 一定要先跑 §8 那 9 个检查脚本再装。**
> 尤其是 `check-hooks.mjs` 和 `check-hooks-per-component.mjs` ——
> 它们防的是 React #310，那个错误在浏览器里**只有一个 error code、没有任何可读信息**，
> 而且一旦发生那棵 React 树就废了。这一轮已经栽过两次。

---

## 1. 装上

```powershell
# 1) 离线自检（不需要浏览器）
node skin\tools\check-client.mjs

# 2) 不重启 DSH 先看一眼效果（可选，但推荐）
node skin\tools\preview-server.mjs
#    → 浏览器打开 http://127.0.0.1:8123/preview/index.html

# 3) 安装到 DSH web profile
pwsh -File skin\tools\install.ps1

# 4) 刷新浏览器页面
#    （改 lib/client.js 只需刷新页面；只有改 lib/index.js 或包配置才需要重启 DSH）
```

> ⛔ **`tools/assemble-assets.mjs` 永远不要再跑。** 它读的是旧立绘管线，会重写
> `data/manifest.json` 的 12 个景、抹掉 `stageSource`、并往 `assets/sprite/` 塞进
> 157 个旧命名立绘（30.3 MB 死重量）。脚本已加硬拦截，误跑会直接拒绝执行。
> 要重算词表请用 `tools/rebuild-lexicon.mjs`（安全，不碰素材）。详见 §12.1。

卸载 / 临时停用：

```powershell
pwsh -File skin\tools\install.ps1 -Disable     # 只停用（保留文件）
pwsh -File skin\tools\install.ps1 -Enable      # 重新启用
pwsh -File skin\tools\install.ps1 -Uninstall   # 彻底卸载
```

装完在 `$DSH_HOME/settings.yaml` 会出现 `moye-skin` 段；也可以直接改它：

```yaml
moye-skin:
  character: aoko        # aoko | alice | kumari
  enabled: true
  showSprite: true
  showDialogue: true
  hideTabs: true
  bgm: true
  bgmVolume: 0.35
  sfx: true
  sfxVolume: 0.5
  persona: true
  easterEgg: true
  edThreshold: 0.78
  assetRoot: ""          # 留空 = 用包内 assets/
```

---

## 2. 怎么用

| 操作 | 效果 |
|---|---|
| **点画面空白处** | 唤出 / 收回菜单（满高侧板） |
| **右键**（阅读态空白处） | 唤出菜单 |
| **左键点菜单项 / 空白处** | **逐层退回**（子菜单→主列表→关闭；设置页→L1）。还原原作操作逻辑 |
| **Enter / 右键点菜单项** | 确认进入 / 操作该项（设置页的开关也这样切） |
| **↑ ↓** | 移动菜单焦点 |
| **Esc** | 返回上一层 |
| **`Ctrl+Shift+M`** | **紧急关闭皮肤**（就地生效，不用重启 —— 见 §11） |
| **`Ctrl+Shift+U`** | **恢复皮肤**（见 §11） |
| `/mahoyo-character` | 斜杠命令切换角色 |

菜单四项（L1）：

| 项 | 英文 | 作用 |
|---|---|---|
| 皮肤设置 | SKIN | 这个皮肤的全屏设置页（`conf_frame` 面板语言） |
| 新建工作区 | NEW | 选一个目录，建一个 DSH 工作区 |
| 打开工作区 | OPEN | 进入一个已有的工作区 |
| 返回对话 | BACK | 关闭 L1，回到会话界面 |

### 关于侧栏

`ctx.layout` **只暴露 `toggleSidebar()`（翻转），没有读取态、也没有 `collapseSidebar()`**。
而 `shell.overlay` 上的皮肤根会因为会话/主题切换而重挂载 —— 每次挂载都 toggle 一次的话，
侧栏会莫名其妙地自己开合。所以：

- **收起动作交给 DSH 自己的侧栏按钮**（那个按钮调的就是同一个官方服务），皮肤不抢这个活。
- 皮肤启动时**只做一次有保护的收起**：先实测左列宽度，**确认它当前是展开的**才调一次
  `toggleSidebar()`；侧栏本来就收着就什么都不做。你之后手动展开，皮肤不会跟它对着干。
- 不想要这一步就在 `皮肤设置` 里关掉「进入时收起侧栏」。
- 全程**没有用 CSS 隐藏侧栏**（红线 6）。

---

## 3. 三个人物 × 昼夜

角色决定「立绘 + 表情表 + 人格注入」；**明暗决定景与 BGM**（浅色 = 昼 / 深色 = 夜），
跟随 DSH 的 `ui-theme` 设置，不读时钟。

| 角色 | 昼景 | 夜景 | 服装行 | 人格注入 |
|---|---|---|---|---|
| 蒼崎青子 `aoko` | A3 教室·白天 | A4 夜·灯饰通学路 | `12` / `03` | `personas/aoko-skill/soul/injection.md` |
| 久遠寺有珠 `alice` | A1 洋房客厅·白天 | A2 洋房客厅·夜晚 | `01` | `personas/alice-skill/soul/injection.md` |
| 久万梨金鹿 `kumari` | A5 公园步道·秋 | A6 洋馆客室·夜 | `00` / `01` | `personas/kumari-skill/soul/injection.md` |

> ⚠️ **"可用槽位"那一栏已删除**（2026-09-23）。原值 `11/12 · 6/12 · 4/12·5/12` 是旧口径，
> 且**"12"这个分母的含义不清**（是 12 个情绪槽？还是 12 个景？），无法从当前产物反推确证。
> 需要这一数据时请**直接从产物算**，别信本表：
>
> ```bash
> # 每个角色有自身词表的情绪槽（注意这是"词表"口径，不是"立绘差分"口径）
> node -e "const m=require('./data/manifest.json');for(const[k,v]of Object.entries(m.lexiconByCharacter))console.log(k,Object.keys(v).length)"
> # 立绘总数（按景分布：a1/a3/a4/a5/a6）
> ls assets/sprite/ | wc -l
> ```
>
> **缺的槽位不是遗漏，是原作就没给这套衣服画。** 一律走 `spec-switching.md` §6 的 fallback 表，
> **不造图补**。金鹿只有 2 个槽位有自身差分（`neutral` / `serious`），
> 72 个景×槽位组合实测**全部都能取到图**（见自检 §6）。

BGM（表见下；`bgm/` 下只有 16 个 `.ogg`，**没有** `bgm_mapping.tsv` —— 映射在 `manifest.bgm` 里）：

| 用途 | 曲目 |
|---|---|
| 表紙 · 浅色 | `m01s` |
| 表紙 · 深色 | `m56` |
| 日常 · 浅色循环 | `m02 m08 m09 m17 m27 m29 m37 m49` |
| 日常 · 深色循环 | `m06 m18 m46 m47 m63` |
| ED | `m53` |

> 浏览器 autoplay 策略要求首次用户手势，所以**第一次点击界面之后** BGM 才会响。

---

## 4. ED 彩蛋

上下文用量到达阈值（**固定 78%**，不可配置）→ 切到 ED 背景（`img2073` 夜空柔焦版）+ 播放 `m53`。

- 触发源：DSH 的 **`contextPressure` 会话投影**（`useProjection('contextPressure')`），
  与 GUI 自己那个上下文环用的是同一个数：`projectedTokens ?? pressureTokens` ÷ `contextWindow`。
- 退出方式：**放完自动回**（用户 2026-09-16 决议），也带一个「跳过 / Skip」按钮。
- 每个会话只触发一次；`contextWindow` 未知时不触发（不猜）。

> ⚠ **0.78 与 DSH 的压缩线只差 2 个点，窗口很窄 —— 这是已知代价。**
> DSH 的自动压缩阈值默认 **0.8**（`dsh-compaction-basic` 的 `DEFAULT_THRESHOLD_RATIO = .8`），
> 所以皮肤把彩蛋阈值**写死在 0.78**：只有在「单步把用量从 78% 以下推过 78%、且没越到 80%」时才响。
> **这个值不可修改**（用户 2026-09-19 决议：「这是不可修改项」），设置面板里没有「触发阈值」这一行。
> 想更可靠地看到彩蛋，改的是 `dsh-base` 的 `compaction-basic` 里的 `thresholdRatio`，**不是皮肤**。
> **这是 DSH 的行为，不是皮肤的问题**，所以写在这里而不是偷偷改你的配置。

---

## 5. 素材与版权

- 原作美术／音频版权归 **TYPE-MOON / 奈须蘑菇 / 小山广和**。
- **本包按你的决定「原大小随包分发」**（2026-09-16），素材**未压缩、未重编码**，
  装在 `assets/` 下，约 **263.2 MB / 380 个文件**（2026-09-22 实测；含 `ui/conf/` 那 80 个设置页切片）。
  > 这是 `docs/15` §9.3 的 Q4「素材分发边界」，原定"实现时确认"。
  > 若日后要发布到公共渠道，社区统一做法是**代码 MIT + 美术 CC BY-NC-SA 4.0 + 素材不随包**——
  > 那时把 `assets/` 抽出去、把 `assetRoot` 指向本地素材目录即可，代码不用改。
- 皮肤**不批量保留原文台词**：`data/personas/*.md` 是人格注入切片，
  `data/manifest.json` 的词典只由短谓词构成。

### 素材装配产物

```
skin/assets/
├── ui/      208 个 UI 构件（顶层 128 + conf/ 80；语言中立 + 简体中文 _zc 变体）
│   └── conf/    80 个切片 —— 原著「環境設定」那一屏拆出来的零件
│                （五横页签 5×4 / OFF・ON 4×4 / 恢复按钮 4 态 / 旋钮 2 态 /
│                 两端标签 2 组×2 标×2 态 / 箭头 8 / 轨 2 / 分隔线 / 色带）⚠ 其中**旋钮 2 态与两端标签 4 态当前无代码引用** —— 音量已改成纯 CSS 的五档方块（见 §12.3）
├── bg/       13 张背景（12 个景 + ED）
├── sprite/  136 张立绘（`stage_<景>_c<通道>_<帧>.png`，**身体层合成**）
└── bgm/      16 首 OGG
skin/data/
├── manifest.json      皮肤运行时清单（景 / 表情表 / 词典 / 曲目 / UI 表）
├── assets-index.json  素材索引（供排查缺失）
│                      ⚠️ 2026-09-23 已移出到 `.tmp/skin-data-backups/`：它过期两个月，
│                         记了 444 条而磁盘只有 380 个文件（157 条是误跑残留的旧命名立绘），
│                         且**没有任何运行时消费者**（宿主路由直接 `stat` 真实路径）。
│                         要重建索引别跑 assemble-assets.mjs —— 它已被硬拦截。
│                         **不进分发包**（pack-dist.mjs 会拦）。
└── personas/*.md      三个人格注入切片（宿主半边读这个）
```

**装配时发现的三处原作素材缺失**（不是脚本查漏，是 `data00000` 全目录确实没有）：

| 缺的 | 替代 |
|---|---|
| `conf_stxt` | 实际叫 `conf_stxt01` / `conf_stxt2`，已改用这两个 |
| `alphagradation_inv` | 只有 `alphagradation` 与 `alphagradation{020..512}` |
| `archive_bookbutton02` / `archive_bookshadow01` / `archive_bookshadow10` | 书脊组本身就缺这几档（**書庫页已按用户决定删除**，这几张素材现在无引用） |

---

## 6. 已知限制（诚实清单）

| 项 | 现状 | 原因 |
|---|---|---|
| **UI 音效** | **已启用** | 7 个 `.hw` 已从 `data00300.hfa` 导出到 `assets/se/`，`SFX` 表 7 键全填，`playSfx` 不再静默降级。⚠ 别用 `data03100.hfa`（906 个 `.hw` / 94 MB，那是音效 + 环境音那条）。 |
| 对话内容读取 | 多路兜底 + 失败静默 | `ChatSnapshot` 的形状在不同 DSH 版本间有差异，代码里试了 4 种已知形状；全失败时对话框留空但皮肤照常工作。 |
| ~~「付箋」内容~~ | **该页已按用户决定删除**（2026-09-21）。原先的实现思路留档：轨迹 DOM 快照 + `data-trajectory-row-key` / `data-record-index` 两个稳定钩子 |
| L1「返回对话」 | 只关闭 L1，回到会话界面 | L1 不做工作区管理器 —— 那是 DSH 侧栏的活；皮肤自己那套只是调用官方 `remote.workspace` 面 |
| 侧栏 | 只做**一次有保护的**官方 `toggleSidebar()` | 见 §2「关于侧栏」；`ctx.layout` 无读取态，乱 toggle 会自己开合。 |
| `menu_btn` | 用 CSS 重绘，没有当贴图 | 它是**灰度遮罩表**（实测填充 `#B4BAC1`），必须 mask + tint（`docs/09` §9.2 的坑）。 |
| 素材体积 | **263.2 MiB / 380 个文件** | 你的「原大小、不压缩」决定。压缩成 JPEG 可降到约 40 MB，但会损失细节。 |
| 端帽 / 名字分隔纹 | 用 `mu_bar` 近似 | `menu_window` 里没有可直接切的缠枝纹小图；`mu_bar` 是同一母题的 1920×20 细青条，本来就是"页边细线"。想更精确就自己切一张 `cap.png` 放进 `assets/ui/`。 |

---

## 7. UI 音效（**已导出，2026-09-22**）

界面提示音在 `WITCH ON THE HOLY NIGHT.7z/WITCH ON THE HOLY NIGHT/data00300.hfa`
（该归档**只有 7 个** `.hw`，恰好就是界面音；**不是** `data03100.hfa` —— 那是 906 个 `.hw` / 94 MB
的音效 + 环境音，别一起拖进来）。`.hw` = 64 字节头 + 完整 OGG Vorbis，切掉头就是合法 ogg。

已导出到 `skin/assets/se/`（7 个 `.ogg`，共约 1 MB）。`client.js` 的 `SFX` 表：

```js
const SFX = {
  menu:     'se/SSETurnedPage.ogg',   // 唤出 / 收回菜单
  decide:   'se/SSEDecided.ogg',      // 确认进入（右键 / Enter）
  move:     'se/SSEChoiced.ogg',      // 移动焦点（悬停）
  book:     'se/SSEBookDecided.ogg',  // 書庫确认
  bookMove: 'se/SSEBookChoiced.ogg',  // 書庫移动焦点
  cancel:   'se/SSECancelled.ogg',    // 逐层退回（左键 / Esc）
  unable:   'se/SSEUnable.ogg',       // 禁用项
}
```

专用导出器：`persona_work/tools/export_ui_sfx.py`（**默认试跑、不写盘**，加参数才落文件）。
`hfa_tools/hw_to_ogg.py` 那条是给 BGM 用的，能用但它会把整个归档一起过。
## 8. 代码结构

```
skin/
├── package.json          dsh.bundle.patch + dsh.client{platform:web}
├── cordis.patch.yml      insert 一行：id: skin-mahoyo
├── lib/
│   ├── index.js          宿主半边：素材静态路由 / 设置持久化 / 人格注入
│   └── client.js         浏览器半边：手工编写 __ModuleLoader__ bundle（无构建步骤）
├── data/                 manifest + 人格切片（装配产物）
├── assets/               原作素材（装配产物）
├── preview/index.html    离线预览（不装 DSH 也能先看规格）
└── tools/
    ├── assemble-assets.mjs        素材装配 + manifest 生成（⚠ 见 §12：与线上 manifest 不同源）
    ├── crop_alpha.py              ★ 按 alpha 边界裁掉素材透明外框（见 §13）
    ├── crop_conf.py               ★ 切原著「環境設定」的五页签 / 选项 / 滑条两端标签（见 §12.3）
    ├── check-client.mjs           离线自检（**282 项断言**）
    ├── check-hooks.mjs            hooks 规则扫描（React #310 成因，启发式）
    ├── check-hooks-per-component.mjs  逐组件 hook 核算（独立第二双眼睛）
    ├── render-selftest.mjs        真跑渲染树 + hooks 齐次性 + enabled 切换回归
    ├── audit-render.mjs           渲染守卫链完整性
    ├── lint-identifiers.mjs       裸标识符扫描（抓 ReferenceError）
    ├── verify-bundles.mjs         与 DSH 的 bundle 解析口径对照
    ├── preview-server.mjs         预览用的极简静态服务器
    └── install.ps1                安装 / 卸载 / 启停
```

> **没有构建步骤。** `lib/client.js` 就是手写的 `__ModuleLoader__` bundle，
> 只用外壳播种的 9 个静态模块（本包只用到 `react` / `react/jsx-runtime`）。
> 因此不需要 tsdown / esbuild / pnpm install，改完直接 `install.ps1` 再重启。

### 两个半边各自做什么

**宿主半边**（`lib/index.js`，跑在 Node 里）

| 事 | API |
|---|---|
| 素材静态路由 | `ctx.webServer.register({kind:'prefix', path:'/moye-skin/assets'})`（自带目录穿越防护、MIME、缓存头） |
| 读写设置 | `ctx.settings.register('moye-skin', schema)` + `/moye-skin/settings` 桥（loopback-only） |
| 人格注入 | `ctx.systemPrompt.section({name:'skin:mahoyo:persona', text:()=>…})` |

> **人格段的 `name` 固定不变**，切换角色只改函数读到的值 ——
> 所以**旧角色永远不会残留**（验收项：「切换角色时旧的注入段被正确替换，不残留」）。

**浏览器半边**（`lib/client.js`，跑在浏览器里）

| 事 | 做法 |
|---|---|
| 整屏新 UI | **自建容器挂在 `document.body`**（`#myh-skin-root`，**`z-index:900`**），自己 `createRoot` 渲染；不使用 `shell.overlay`（原因见下方警示框） |
| 读会话与上下文 | 注册进 **`conversation.input.right`**（session 作用域才有 `useChat`/`useSession`/`useProjection`），渲染 `null`，只写共享 store |
| 原生 chrome 让位 | CSS 把侧栏 / 右栏 / 页签条 / **原生消息列表**隐藏，正文由皮肤自己画（`Transcript` 直接读 `ChatSnapshot`） |
| 主题跟随 | 监听 `document.body[data-ds-dark-theme]` |
| 图片自适应 | 一律 `object-fit: cover`（`docs/15` §5.4），不用 JS 算裁切框 |
| 装饰件 | 端帽/落叶固定像素 —— **永不拉伸**（`docs/08` §2.4）。**木框已于 2026-09-22 删除**（用户第 4 条） |

> ⚠ **为什么不用 `shell.overlay`**（实测两次踩坑，别改回去）：
> ① `shell.overlay` 上任何一次 render 抛错，DSH 的 `SlotErrorBoundary` 会**永久**把
>    整个 overlay 槽变成崩溃占位 —— 逃生门和被救的对象一起死，那正是它最不该失效的场合。
> ② 自建容器与 DSH 的插槽系统完全解耦：皮肤崩了只影响皮肤。
>
> ⚠ **绝不能注册进 `root` 槽**：它是 single 槽，第二个注册者会**顶掉整个 AppFrame**。

### ★ hooks 排布铁律（React #310 的坑，2026-09-17 实测炸过）

`SkinRoot` 里**所有 hook 必须集中在函数上半段，排在任何 `return` 之前**。

原因是 `settings` 是**异步到达**的瞬时状态：

```
首渲染  设置还没回来  → 用内置默认（enabled 缺省 true）→ 不拦 → 25 个 hook
设置到达 enabled:false → 守卫拦住 → 提前返回              →  0 个 hook
enabled 又被打开       → 不再拦                          → 25 个 hook  ← 抛 #310
```

React 只会说一句 `Minified React error #310`（Rendered more hooks than during the
previous render），**没有任何可读信息**，而且一旦发生这棵 React 树就废了。

所以有**两道离线防线**，改完 `client.js` 一定要跑：

```powershell
node skin\tools\check-hooks.mjs                  # 启发式：条件/循环/三元/早退内的 hook
node skin\tools\check-hooks-per-component.mjs    # 独立核算：逐个组件列出 hook 与 return 行号
node skin\tools\render-selftest.mjs              # 真跑渲染，并模拟 enabled false→true 的切换
```

> `render-selftest.mjs` 里的扰动序列是**照着真实崩溃现场写的**（4 次渲染，
> 中间让 `enabled` 在 false↔true 之间过界一次）。同状态连渲染三次**抓不到**这个 bug。

---

## 9. 验收对照（`docs/15` §11）

> **状态列的含义**：✅ = 代码已实现；⚠️ = **尚未经过人眼确认**（见 `docs/16` §1 / §8.1）。
> 代码"写完了"和"确实能看到"是两件事 —— 这一轮已经吃过一次亏。

| # | 验收项 | 状态 |
|---|---|---|
| 1 | 界面显示为魔夜的样子，UI 元素全部来自原作资源 | ⚠️ **128** 个 UI 构件（+ `ui/conf/` 80 个切片）+ 13 张背景全部原作原图；**DOM 已实测画出来**，待人眼确认 |
| 2 | 阅读态无 chrome，点击空白唤出/收回菜单 | ⚠️ **自建容器挂 `document.body`**（不走 `shell.overlay`，理由见 §8）+ 空白热区 + 右键/Esc |
| 3 | 菜单：**L1 四项**（皮肤设置 / 新建工作区 / 打开工作区 / 返回对话）、**L2 三项**（新建对话 / 会话列表 / 返回起始页）；**書庫 / 付箋 / 表紙 三页已按用户决定删除**，「界面设置」也已删（2026-09-22）。L1 与 L2 走**同一套行样式**（`.myh-srow`），L2 会话列表另用 `.myh-mrow`（乐曲行条形态）；**设置页另成一套**：标题「环境设置」+ **五横页签**（声音设置 / 语音设置 / 文本设置 / 操作设置 / 操作说明），页内 OFF・ON 单选按钮与滑条，底部「恢复初始设置」；焦点表 = **5 页签 + 本页各项（展开到选项级）+ 恢复按钮**（`t:` / `c:` 两个前缀；行内的 OFF/ON 与角色名各成一个焦点项，id 形如 `c:bgm#on` / `c:character#alice`）；**背景 = L1 的壳景**（`SHELL_OF[角色][昼夜]`）+ 一层暗底 `.myh-confScrim`；几何上**面板盒锁 `aspect-ratio:1820/936`**（= `conf_frame` 原图比例）并水平居中 —— 外框是装饰件，**永不随视口拉伸**（红线 3；实测未锁前 1600×900 下被拉到 +8.1%，锁后各视口偏差均为 0%）。**下内距按页收窄**：设置页把输入框让位收回（`.myh-pageInner:has(.myh-conf){padding-bottom:24px}`）—— 该页皮肤根 z-index **950** > composer 座位 **901**，输入框本就被整片盖住，留那 148px 只会撑出滚动条（实测 sbW **8 → 0**、面板 1476×759 → **1484×763**、比例仍 0%）。⚠ **视口宽/高 < 1820/936 或高度 ≤600px** 时改宽度驱动（实测页签 **1–2 行**、页体内滚动；八个高度实测 **滚到底都能到页脚**、整页不漏滚动、比例偏差全 0%）。高度那一侧是 2026-09-22 补的：只判宽高比时，1600×420 下 `.myh-confBody` 被压到 **2px**、页脚（恢复初始设置）跑到视口外 | ⚠️ 左右键语义：悬停 = 移焦点、右键 / Enter 进入、左键 / Esc 逐层退回，**两层与设置页的空白处点击也逐层退回**；**待人眼确认能点** |
| 4 | 底部对话框按选项条语言，三档色阶随 agent 状态 | ⚠️ `H = 86 + 44×(行数−1)`；深/中/浅 = 空闲/生成中/等待你 |
| 5 | 立绘可切换表情，只用特写，切换不跳位；**一次回复最多换一次** | ⚠️ 136 张特写（0 张 `_b`）；尺寸由 CSS `76vh` 决定，与图无关 → 理论上不可能跳位；换表情的次数上限由 `turnChangedRef` 控制（同槽换帧不受限） |
| 6 | BGM 按 §5.2 生效 | ⚠️ 表紙浅/深各一首；日常浅 8 / 深 5 循环。**需先点一下界面解锁 autoplay** |
| 7 | 彩蛋：上下文 **78%**（固定值）触发 ED + `m53`；可退出 | ⚠️ 用 DSH 的 `contextPressure`；放完自动回 + 「跳过」。**阈值写死 0.78，只比 DSH 压缩线 0.8 低 2 点，窗口窄是已知代价**；设置面板里没有这一行（不可修改项），见 §4 |
| 8 | 图片全部 cover 自适应，无拉伸、裁切随视口 | ✅ 所有 `<img>` 均 `object-fit: cover`（静态可判） |
| 9 | 人格 skill 默认生效，可关闭 | ✅ 三角色各一套注入切片，默认开，设置里可关（**已实测：系统提示词里确实有注入段**） |
| 10 | 切换角色时旧注入段被替换，不残留 | ✅ 固定 section name |
| 11 | 设置面板可用；可打包安装 | ⚠️ 皮肤设置子页已按原著重做成**五横页签**（标题「环境设置」+ 声音/语音/文本/操作/操作说明 + OFF・ON + 滑条 + 恢复初始设置）；`settings.yaml` + `install.ps1`；`files` 白名单已就绪 |
| 12 | **全程未引入任何数值系统** | ✅ 无好感度/等级/进度/解锁 —— 三档色阶只表达"现在是什么状态" |

---

## 10. 排错

| 症状 | 检查 |
|---|---|
| 界面完全没变化 | DSH 重启了吗？`$DSH_HOME/profiles/web/package.json` 的 `dsh.profile.bundles` 里有 `dsh-skin-mahoyo` 吗？ |
| 浏览器 console 报 `Cannot find module '@deepseek-ai/schemastery'` | `install.ps1` 的 junction 没建上；把 `profiles/web/node_modules/@deepseek-ai/schemastery` 拷进 `node_modules/dsh-skin-mahoyo/node_modules/@deepseek-ai/` |
| `manifest HTTP 404` | 插件没加载（同上）；或先跑 `assemble-assets.mjs` |
| 只有背景没有立绘/对话框 | 那个会话还没有 assistant 消息（传感器读不到文本），发一条就会出来 |
| BGM 不响 | 先点一下界面（autoplay 策略）；再看 `皮肤设置 → BGM` |
| 彩蛋一直不触发 | 读 §4 —— 阈值固定 0.78，只有"单步跨过 78% 但没到 80%"时才响，窗口很窄是设计如此 |
| 想回到 DSH 原样 | `皮肤设置 → 启用皮肤` 关掉，或 `install.ps1 -Disable` |

### ★ 不问任何人，自己看现场：`/moye-skin/health`

浏览器半边每次挂载后都会把**渲染实况**回传给宿主，直接开这个地址就行
（不需要控制台、不需要截图、不需要用户复述）：

```powershell
(Invoke-WebRequest http://127.0.0.1:3080/moye-skin/health -UseBasicParsing).Content |
  ConvertFrom-Json | Select-Object -ExpandProperty diag
```

| 字段 | 看什么 |
|---|---|
| `clientSeen` | 客户端 bundle 到底跑没跑 |
| `clientInfo.build` | **跑的是哪一份代码**。和磁盘上 `node_modules/dsh-skin-mahoyo/lib/client.js` 里的 `BUILD_ID` 对照 |
| `probes[]` | 挂载后 200ms / 1400ms 两次 DOM 采样：`domNodes`（真实节点序列）、`hasTitlebar`/`hasColumn`/`hasTranscript`、`guard`（四个开关）、`blockReason`、`backdropChain`（祖先链背景色） |
| `probes[].hookFrames` | hooks 取证：每轮渲染数到几个 hook |
| `clientErrors[]` | 渲染/挂载异常全文（含 `componentStack`） |

> **探针必须能过 `JSON.stringify`** —— 曾经把 DOM 节点本体塞进上报体，
> `onmessage` 转发时静默抛错，于是探针**一次都没上报成功**，
> 而我一直在根据"没有探针数据"猜界面为什么没反应。现在任何 DOM 一律转成字符串/计数。

> **服务器会把 bundle 字节钉在启动时的快照里**（`rev` 就是启动时生成的 nonce）。
> 所以改完代码光 `install.ps1` 不够，**必须重新加载页面**；DSH 进程本身不用重启。

### 先别重启，也能看效果

```powershell
node skin\tools\preview-server.mjs        # 默认 127.0.0.1:8123
```

打开 `http://127.0.0.1:8123/preview/index.html` —— 那是一个**自包含的静态预览页**，
用同一份 `manifest.json` 和同一套规格渲染：背景 cover、立绘换表情（走的是同一个分类器）、
三档色阶切换、菜单板。截图/核对完再决定要不要装进 DSH。

> 预览页是**规格对照用的静态实现**，不是运行时；正式皮肤是 `lib/client.js`。
> 两者共用 `manifest.json`，所以表情表/景/BGM 的对应关系完全一致。

---

## 11. ★ 出事了怎么办（**先读这一节**）

### 为什么这事必须严肃对待

我实测了本机 DSH（0.1.5-rc.1）的故障行为：

| 坏法 | 后果 |
|---|---|
| profile 的 bundle **解析不到**（包名错、目录被删、package.json 坏） | **整个 profile 起不来**。`dsh web --dump-config` → exit 1：`cannot resolve profile bundle "…"`。**报错发生在加载任何插件之前 —— 代码层面兜不住** |
| `insert.name` 解析不到 | 只影响那一条，不 abort |
| 插件 `apply()` 抛错 | 已用 try/catch + 逐项降级兜住 |
| 浏览器端渲染崩 | 已用错误边界 + 紧急开关兜住 |

皮肤一旦进了 `bundles`，它就从"一个插件"变成了"**启动链路的一部分**"。
所以对策不是"写得更小心"，而是三层彼此独立的保险：

### 第一层 · 启动前预检（不需要 DSH 起来）

```powershell
pwsh -File skin\tools\guard.ps1 -PreflightOnly
```

`dsh web --dump-config` 会**组合 profile 但不启动应用**。
`exit 0` = 组合是好的；`exit 1` = 坏了 —— **它只是把 `rollback.ps1` 的命令打给你，不会自己摘皮肤**（详见 §11 第二层的说明与 `recovery\README.md`）。

### 第二层 · 安全重启（推荐日常用这个）

```powershell
pwsh -File skin\tools\guard.ps1              # 预检 + 备份 + 生成一键撤回脚本
pwsh -File skin\tools\guard.ps1 -Watch       # 再盯一会儿，DSH 起来了报平安
```

它**不替你启动 DSH** —— 启动由你用平时的方式做，脚本只管安全前置与事后兜底：

1. 预检 `dsh web --dump-config`（组合 profile 但不启动应用）
2. 备份 `profile/package.json`、`cordis.yml`、`settings.yaml`
3. 生成一份**一键撤回脚本**放进备份目录（起不来时直接跑它）
4. 打印当前端口状态与下一步指引

```powershell
pwsh -File skin\tools\guard.ps1 -PreflightOnly   # 只预检
pwsh -File skin\tools\guard.ps1 -SafeBoot        # 预检后建 SAFE_MODE（皮肤静默）
pwsh -File skin\tools\guard.ps1 -NormalBoot      # 删 SAFE_MODE（皮肤生效）
```

> **为什么不让它自动启动**（第一版这么做过，踩了坑）：
> 自动启动要 `Start-Process pwsh` + 轮询端口，而
> **`Get-NetTCPConnection` 在非管理员下会抛「拒绝访问」**，
> 加上脚本开头是 `$ErrorActionPreference='Stop'` → 一进去就崩，
> 表现就是"guard.ps1 根本打不开"。
> 现在改成只用 `Invoke-WebRequest` 探测（401/403 也算服务在），
> 并且全程 `Continue` 模式 —— 任何一步失败都继续走完并给明确报告。

### 第三层 · 浏览器里的逃生门

| 快捷键 | 作用 |
|---|---|
| **`Ctrl+Shift+M`** | **紧急关闭皮肤**（就地生效，不用重启） |
| **`Ctrl+Shift+U`** | **恢复皮肤**（把两道闸一次清干净，然后自动刷新） |

关闭时会删掉属性、样式标签、以及 DSH 错误边界留下的崩溃占位，并写入 localStorage（刷新也不回来）。

**恢复**（三选一，都不用控制台）：

1. 点右下角横幅上的 **「恢复皮肤」** 按钮
2. 按 **`Ctrl+Shift+U`**
3. 地址栏加 **`?mahoyo=on`** 回车一次

> ★ **2026-09-17 修正**：原来只有"关"没有"开"（只能靠横幅按钮或控制台），
> 而且**处于关闭态时刷新完全不弹提示** —— 用户看到的就是"皮肤莫名其妙失效，
> 一条错都没有"，和"没装"一模一样。
> 一个只能关不能开的开关本身就是故障源。现在：
> · 恢复按钮会把 **localStorage 标记 + `settings.enabled` 两道闸一起打开**
>   （只清一道的话，用户点完刷新还是默认界面，非常挫败）；
> · **每次加载只要处于关闭态就自动弹横幅**，不用等用户记起快捷键；
> · 横幅做得更大更显眼，并直接写明怎么恢复。
>
> 关闭态有两个**独立且静默**的来源，排查时两个都要看：
> ① `localStorage['moye-skin:kill']` ② 宿主设置 `settings.enabled`
> —— 只看一个会得出"已经开了但还是不行"的错误结论。

### 最坏情况：DSH 已经起不来

```powershell
pwsh -File recovery\rollback.ps1
```

**它不依赖 DSH、不依赖网络**，只做文件操作。依次做：

1. 把皮肤从 `bundles` 摘掉
2. 建 `skin/SAFE_MODE`
3. 清理 `settings.yaml` 的 `moye-skin:` 段
4. 跑预检；**还失败就从最新的备份倒着试，找到最后一份能组合的配置并还原**；
   再不行就**按报错逐个剔除解析不到的 bundle**

详见 `recovery\README.md`。

### 安全模式（SAFE_MODE）

`skin/SAFE_MODE` 这个文件存在时，宿主半边**什么都不注册**（不路由、不注入、不写设置），
浏览器半边也不注入 CSS、不注册组件 —— **皮肤等同于没装，但包还在**。

想验证"DSH 起不来到底是不是皮肤的锅"时：开安全模式启动一次，起来了 = 是皮肤，还是起不来 = 不是。



---

## 12. ⚠ 素材的三条硬规矩（2026-09-20 新增；12.3 于 2026-09-22 补）

### 12.1 永远不要重跑 `assemble-assets.mjs`

它读的是 `persona_work/stage/expressions.json`（**旧立绘管线**，文件名形如
`aok_n_12_02_01.mzp.png`），而线上 manifest 用的是 `stage_a3_c02_01.png`
（来自 `build_stage_sprites.py` + `apply_stage_manifest.py`）。**两者不同源。**

2026-09-20 实跑一次的后果：**67 处差异** —— 12 景 `slots` 全被重写、
12 景 `stageSource` 全部消失、`spriteBases` 5→157，
并且把 157 个旧命名立绘拷进 `assets/sprite/`（30.3 MB 死重量）。

**改 manifest 只有两条路**：手改，或 `persona_work/tools/restore-expressions.mjs`。

### 12.2 素材必须裁到 alpha 边界（`crop_alpha.py`）

解包出来的原作素材**自带宽窄不一的透明外框**。`object-fit:cover` 把透明区
也算进缩放比例 → 有效画面被推偏，**出现贴边黑缝**，立绘底部还会固定多出一条空缝。

实测：A3 背景 3572×2042，有效内容只有 3285×1972（**左 14 / 右 273**，差 19 倍）；
136/136 张立绘**底部全是 11px** 透明边。

```bash
python skin/tools/crop_alpha.py                  # 试跑：只打印会裁什么
python skin/tools/crop_alpha.py --write          # 就地裁切（bg + sprite）
python skin/tools/crop_alpha.py --write --dir bg # 只裁一类
```

PNG 裁切**无损、不重采样**。判据 `alpha > 8`，与离线核查脚本同一口径。

> **任何时候重新解包素材，都要再跑一次这个脚本。** 否则黑边会回来。
> 完整根因、实测数据、修法见 `docs/25-背景黑边与模糊-根因与修复.md`。

### 12.3 设置页切片由 `crop_conf.py` 重现（`assemble-assets.mjs` **不生成**它）

原著環境設定是**横排五页签 + 页内选项组 + 滑条 + 底部恢复按钮**，而且
（★ 2026-09-23：本皮肤的**音量**已不照抄那根滑条，改成**五档方块** —— 用户「只能调整一次性变得最大，按小就会一次性变得最小。你要不改成与其他一样的小方块，然后多给几个档位的选项得了」。滑条素材仍切好留在 `ui/conf/`，只是暂时不用）
**文字全部烧在 PNG 上** —— 250 个 `.chs` 编译脚本里没有任何设置页文案
（只有 `test_script.chs` 出现过「音量」），所以**搜索是死路、切图才是正解**。

图集**不能按百分比定位**（行高 71/71/79/79 不均匀），所以几何表逐格写死在
`skin/tools/crop_conf.py` 里，产出 `skin/assets/ui/conf/` 那 80 个切片：
页签 5×4 / 选项 2 组×4×4 / 恢复按钮 4 态 / 旋钮 2 态 / 滑条两端 2 组×2 标×2 态
/ 箭头 8 / 轨 2 / 分隔线 / 色带。

```bash
python skin/tools/crop_conf.py --check    # 校验现役 80 个切片与几何表逐字节一致
python skin/tools/crop_conf.py            # 试跑：只报告会写什么
python skin/tools/crop_conf.py --write    # 落盘（先备份 skin/assets/ui/conf/）
```

> ⚠ `assemble-assets.mjs` 里只有 `mkdirSync` / `copyFileSync` / `writeFileSync`，
> **没有** `rmSync`/清空 —— 所以重跑它**不会删** `conf/`，但也**不会重建**它。
> 这个目录的唯一来源就是 `crop_conf.py`。

---

## 13. 复现与取证（无头浏览器）

肉眼看不准的时候，用无头 Edge + CDP 直接量像素：

```bash
node skin/tools/preview-server.mjs 8123
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --remote-debugging-port=9223 --remote-allow-origins=* \
  --user-data-dir=.tmp/edge-probe about:blank
node .tmp/cdp-shot.mjs http://127.0.0.1:8123/preview/repro.html 1800 1113 .tmp/shot.png
python .tmp/edge-scan.py .tmp/shot.png     # 逐像素扫黑边
```

复现页（`skin/preview/`，**仅供取证，不参与发布**）：
`repro.html` 背景单层 / `repro3.html` 背景+立绘 / `repro5.html` 容器小于视口的错位。

> **一条写死的经验**：「图铺不满」的第一嫌疑**永远是素材自带的透明外框**，
> 不是 CSS。先量 alpha bbox，别先怀疑 `object-fit` / `100vw` / `dpr` ——
> 这两轮排错都栽在"先怀疑视口单位"上。

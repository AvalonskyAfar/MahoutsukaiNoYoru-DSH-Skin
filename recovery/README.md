# 抢救包 · dsh-skin-mahoyo

> **DSH 起不来的时候，从这里开始。**
> 这个目录里的东西**不依赖 DSH、不依赖网络**，只做文件操作，所以一定能跑。

---

## 0. 三十秒版

打开一个 **PowerShell 窗口**（不是 DSH 里，是系统的），任选一行粘进去：

```powershell
# 首选：从工作区跑
pwsh -File "D:\QuickLook插件包\moye\recovery\rollback.ps1"

# 工作区丢了/被移动了：从独立备份跑（install.ps1 每次都会更新它）
pwsh -File "$env:USERPROFILE\moye-skin-backup\tools\rollback.ps1"
```

然后正常启动 DSH。就完了。

> **独立备份**：`%USERPROFILE%\moye-skin-backup\`（**约 886 KB**（随安装浮动），**代码 + 数据 + 全套工具 + 抢救脚本**，
> 不含 **263.2 MiB** 素材 —— 素材可用 `tools\assemble-assets.mjs` 幂等重建）。
> 它**自己就是完整的急救包**，里面的 `tools\rollback.ps1` 和 `tools\guard.ps1` 就地可跑。
> 工作区要是哪天没了，用 `tools\restore-from-backup.ps1` 就能把皮肤装回去。

---

## 1. 为什么需要这个

我实测了本机 DSH（0.1.5-rc.1）的故障行为，结论是**必须**有这套东西：

| 坏法 | 后果 | 能不能用代码兜住 |
|---|---|---|
| profile 的 bundle **解析不到**<br>（包名写错、文件被删、`package.json` 坏了） | **整个 profile 起不来**<br>`dsh web --dump-config` → exit 1<br>`cannot resolve profile bundle "…" from the dsh installation or <profileDir>` | ❌ **兜不住**<br>报错发生在加载任何插件之前 |
| `insert.name` 解析不到 | 只影响那一条，不 abort（`dump-config` 仍 exit 0） | ✅ 影响有限 |
| 插件 `apply()` 抛错 | 由 cordis loader 处理，**不能假设不致命** | ✅ 已用 try/catch + 逐项降级兜住 |
| 浏览器端渲染崩 | 只影响那一个插槽（DSH 有 `SlotErrorBoundary`），但会留下一块空的 `<div data-slot-error>` | ✅ 自带错误边界 + `Ctrl+Shift+M` 可清掉 |

**所以第一行是硬伤**：皮肤一旦进了 `bundles`，它就从"一个插件"变成了"启动链路的一部分"。
这就是你上次"装着皮肤 DSH 再也进不去，只能从终端卸"的成因。

对策不是"写得更小心"（那不可靠），而是**三层彼此独立的保险**。

---

## 2. 三层保险

### 第一层 · 启动前预检（最有用）

`dsh web --dump-config` 会**组合 profile 但不启动应用**。
皮肤若能正常参与组合，这一步就 `exit 0`。

```powershell
pwsh -File "D:\QuickLook插件包\moye\skin\tools\guard.ps1" -PreflightOnly
```

- **`exit 0`** → 组合是好的，可以放心启动
- **`exit 1`** → 组合坏了；**它只是把 `rollback.ps1` 的命令打给你，不会自己摘皮肤**

### 第二层 · 启动前预检 + 备份（推荐日常用这个）

```powershell
pwsh -File "D:\QuickLook插件包\moye\skin\tools\guard.ps1"
```

⚠ **它不替你启动 DSH，也不回滚。** 逐条说清它到底做什么（2026-09-22 按脚本原文核对）：

| 它做的 | 它**不做**的 |
|---|---|
| 跑 `dsh web --dump-config` 预检组合 | ❌ **不启动 DSH**（原文："用你平时的方式关掉再打开 —— 本脚本不替你启动，避免猜错启动方式"） |
| 备份 `profile/package.json`、`profile/cordis.yml`、`settings.yaml` 到 `recovery/backups/<时间戳>/` | ❌ **不轮询端口**（除非加 `-Watch`，见下） |
| 在备份目录生成一份**撤回脚本**：`UNDO-如果起不来就跑我.ps1` | ❌ **不杀进程** |
| 预检失败时**打印一句**"先跑 `recovery\rollback.ps1` 再重启"，然后 `exit 1` | ❌ **不自动回滚**（文件里所有 `rollback` 命中都是 `Say` 打印） |

所以流程是：**跑 guard → 它预检并备份 → 你自己重启 DSH**。预检失败就是让你**手动**去跑 `rollback.ps1`。

常用变体（这几个参数**确实存在**，取自脚本 `param()` 块）：

```powershell
# 只预检，不备份、不提示重启
pwsh -File skin\tools\guard.ps1 -PreflightOnly

# 第一次装先零风险试一次（皮肤静默，只验证"是不是它把 DSH 弄挂了"）
pwsh -File skin\tools\guard.ps1 -SafeBoot

# 确认没问题后让皮肤生效
pwsh -File skin\tools\guard.ps1 -NormalBoot

# 盯一会儿：每 2 秒探一次，探到 DSH 下线又上线就报平安（默认最多 90 秒）
pwsh -File skin\tools\guard.ps1 -Watch
pwsh -File skin\tools\guard.ps1 -Watch -TimeoutSec 120

# 另一个 profile / 别的端口
pwsh -File skin\tools\guard.ps1 -Profile tui -Port 3081
```

> ⚠ 曾经这里写着"guard 会自动回滚、轮询端口、60 秒没起来就杀进程重启一次" ——
> 那是**一个已不存在的旧版本**的行为。现役脚本没有这些，2026-09-22 逐行核对后改正如上。

### 第三层 · 浏览器里的逃生门

**不用重启、不用终端**，在 DSH 界面里直接按：

| 快捷键 | 效果 |
|---|---|
| **`Ctrl+Shift+M`** | **就地关闭皮肤**：删掉属性、样式标签、以及崩溃占位；写入 localStorage，刷新后也不回来 |

恢复：

- 地址栏加 `?mahoyo=on` → 立即恢复并清除标记
- 或控制台执行 `localStorage.removeItem('moye-skin:kill')` 后刷新

> 这个开关**和皮肤根分开注册**（`mahoyo-killswitch`），所以**皮肤本身崩了它照样有效**。
> 皮肤根外面还有一层 React 错误边界，捕获到渲染异常时会自动调用它。

---

## 3. 抢救脚本都能干什么

```powershell
cd D:\QuickLook插件包\moye

# 抢救（默认 profile = web）
pwsh -File recovery\rollback.ps1

# 抢救，但保留 settings.yaml 里的皮肤设置
pwsh -File recovery\rollback.ps1 -KeepSettings

# 看看有哪些备份
pwsh -File recovery\rollback.ps1 -ListBackups

# 反向：从最近的备份还原（抢救后悔了）
pwsh -File recovery\rollback.ps1 -Restore

# 另一个 profile
pwsh -File recovery\rollback.ps1 -Profile tui
```

抢救脚本做四件事（**全部幂等**，跑几遍都一样）：

1. 把 `dsh-skin-mahoyo` 从 `profiles/web/package.json` 的 `dsh.profile.bundles` 里摘掉
2. 建 `skin/SAFE_MODE` —— 以后即使又被启用，皮肤也只静默加载
3. 删掉 `settings.yaml` 里的 `moye-skin:` 段
4. 跑一次 `--dump-config` 验证组合已恢复

**它不需要 DSH 起来**，因为它只碰文件。

---

## 4. 安全模式（SAFE_MODE）

`skin/SAFE_MODE` 这个文件存在时，宿主半边**什么都不注册**（不路由、不注入、不写设置），
浏览器半边也不注入 CSS、不注册组件。**皮肤等同于没装，但包还在。**

三个入口，任一命中即可：

| 入口 | 怎么开 |
|---|---|
| 文件 | 新建 `skin/SAFE_MODE`（内容随意） |
| 环境变量 | `MAHOYO_SAFE=1` |
| JSON | `skin/data/safe-mode.json` 里写 `{"enabled": true}` |

关掉就恢复：删掉那个文件，或 `guard.ps1 -NormalBoot`。

**用途**：想验证"DSH 起不来到底是不是皮肤的锅"时，开安全模式启动一次 ——
启动了 → 是皮肤；还是起不来 → 不是皮肤。一次实验就定性。

---

## 5. 完整排错流程

```
DSH 起不来了
│
├─ 先在终端跑：dsh web --dump-config
│   │
│   ├─ 报 cannot resolve profile bundle "…"
│   │   → 就是 bundle 问题
│   │   → pwsh -File recovery\rollback.ps1
│   │
│   └─ exit 0（组合是好的）
│       → bundle 没问题，可能是端口占用 / 别的原因
│       → pwsh -File skin\tools\guard.ps1 -TimeoutSec 120，它会打印日志尾部
│
└─ 进去了，但界面被抠掉一块
    → 浏览器按 Ctrl+Shift+M（就地关闭皮肤）
    → 或者看看 console 里 "[moye-skin]" 开头的报错，发给我
```

---

## 6. 备份在哪

```
recovery/backups/
└── 20260916-213000/
    ├── package.json      profile 的 bundle 列表
    ├── cordis.yml        profile 的 entry 列表
    ├── settings.yaml     DSH 用户设置（含 moye-skin 段）
    └── dsh-boot.log      guard.ps1 启动时的完整输出（排错要看这个）
```

`guard.ps1` 每次启动前都会新建一个，`install.ps1` 每次改 profile 前也会。
`rollback.ps1 -Restore` 会用**最新**的那一份还原。

---

## 7. 卸载（回到完全没装过的样子）

```powershell
# 1) 从 profile 摘掉 + 删除安装目录 + 清理 settings.yaml
pwsh -File skin\tools\install.ps1 -Uninstall

# 2) 重启 DSH
```

`assets/`（**263.2 MiB** 素材）留在工作区里，想彻底删就删 `skin\assets\`。

---

## 8. 文件清单

| 文件 | 作用 |
|---|---|
| `recovery/rollback.ps1` | **一键抢救** / 列出备份 / 从备份还原；三级降级修复 |
| `recovery/restore-from-backup.ps1` | 从独立备份把皮肤装回去（工作区丢了时用） |
| `recovery/README.md` | 本文件 |
| `recovery/backups/` | 备份（自动生成） |
| `skin/tools/guard.ps1` | **预检 + 备份 + 生成撤回脚本**（不启动 DSH、不回滚；见 §2 第二层的表格） |
| `skin/tools/install.ps1` | 安装 / 卸载 / 启停 / `-SafeBoot` / 顺带写独立备份 |
| `skin/SAFE_MODE` | 安全模式标记（手动或 guard 生成） |
| `%USERPROFILE%\moye-skin-backup\` | **独立备份**（**约 886 KB**（随安装浮动），自带全套工具与抢救脚本） |

### 两个位置都能跑

`rollback.ps1` 和 `guard.ps1` 都会**自己判断布局**：

| 跑在哪 | SAFE_MODE | 备份目录 |
|---|---|---|
| `<工作区>\recovery\` 或 `<工作区>\skin\tools\` | `<工作区>\skin\SAFE_MODE` | `<工作区>\recovery\backups\` |
| `<备份>\tools\` | `<备份>\SAFE_MODE` | `<备份>\backups\` |

所以工作区在不在，都不影响抢救。

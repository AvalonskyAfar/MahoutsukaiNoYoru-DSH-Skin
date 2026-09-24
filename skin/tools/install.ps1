# 安装 dsh-skin-mahoyo 到 DSH web profile
#
# 用法：
#   pwsh -File skin\tools\install.ps1                 # 安装 / 更新
#   pwsh -File skin\tools\install.ps1 -Uninstall      # 卸载
#   pwsh -File skin\tools\install.ps1 -Enable         # 只启用
#   pwsh -File skin\tools\install.ps1 -Disable        # 只停用
#
# 做三件事：
#   1. 把 skin/ 整个复制到 $DSH_HOME\profiles\web\node_modules\dsh-skin-mahoyo\
#   2. 在 $DSH_HOME\profiles\web\package.json 的 dsh.profile.bundles 里加上本插件
#   3. 给 profile 装一个 node_modules 转发（pnpm 布局下插件自己 import 不到 schemastery）
#
# 装完需要重启 DSH（bundle 层变化不会热加载）。

[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$Enable,
  [switch]$Disable,
  [switch]$SafeBoot,
  [string]$DshHome = $env:DSH_HOME
)

$ErrorActionPreference = 'Stop'
$PkgName = 'dsh-skin-mahoyo'

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $DshHome)) { throw "找不到 DSH_HOME：$DshHome" }

$ProfileDir = Join-Path $DshHome 'profiles\web'
$ProfilePkg = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $ProfilePkg)) { throw "找不到 web profile：$ProfilePkg" }

$Target = Join-Path $ProfileDir "node_modules\$PkgName"
$Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$WorkspaceRoot = (Resolve-Path (Join-Path $Source '..')).Path
$BackupRoot = Join-Path $WorkspaceRoot 'recovery\backups'
$SettingsYml = Join-Path $DshHome 'settings.yaml'
$SafeFlag = Join-Path $Source 'SAFE_MODE'

function Write-Step($m) { Write-Host "== $m" -ForegroundColor Cyan }

# ------------------------------------------------------------------
# 改 profile 之前先备份（guard.ps1 的回滚靠这个目录）
# ------------------------------------------------------------------
function Backup-ProfileConfigs {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dir = Join-Path $BackupRoot $stamp
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  foreach ($f in @($ProfilePkg, (Join-Path $ProfileDir 'cordis.yml'), $SettingsYml)) {
    if (Test-Path $f) { Copy-Item $f (Join-Path $dir ([IO.Path]::GetFileName($f))) -Force }
  }
  Write-Host "   已备份 profile 配置 -> $dir" -ForegroundColor DarkGray
}

# ------------------------------------------------------------------
# 只启用 / 只停用
# ------------------------------------------------------------------
function Set-BundleEnabled([bool]$On) {
  Backup-ProfileConfigs
  $json = Get-Content $ProfilePkg -Raw | ConvertFrom-Json
  $list = @($json.dsh.profile.bundles)
  $has = $list -contains $PkgName
  if ($On -and -not $has) { $list += $PkgName }
  if (-not $On -and $has) { $list = $list | Where-Object { $_ -ne $PkgName } }
  $json.dsh.profile.bundles = $list
  ($json | ConvertTo-Json -Depth 10) | Set-Content -Path $ProfilePkg -Encoding UTF8
  Write-Host "   bundles: $($list -join ', ')"
}

if ($Enable)  { Write-Step 'enable'; Set-BundleEnabled $true;  Write-Host '重启 DSH 后生效。建议用 guard.ps1 启动（带自动回滚）。' -ForegroundColor Yellow; return }
if ($Disable) { Write-Step 'disable'; Set-BundleEnabled $false; Write-Host '重启 DSH 后生效。' -ForegroundColor Yellow; return }

# ------------------------------------------------------------------
# 卸载
# ------------------------------------------------------------------
if ($Uninstall) {
  Write-Step '卸载'
  Set-BundleEnabled $false
  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force; Write-Host "   已删除 $Target" }
  # 顺手清掉 settings.yaml 里的 moye-skin 段，避免留下孤儿配置
  if (Test-Path $SettingsYml) {
    $lines = Get-Content $SettingsYml
    $out = New-Object System.Collections.Generic.List[string]
    $skipping = $false
    foreach ($line in $lines) {
      if ($line -match '^moye-skin\s*:') { $skipping = $true; continue }
      if ($skipping) {
        if ($line -match '^\S') { $skipping = $false } else { continue }
      }
      if (-not $skipping) { $out.Add($line) }
    }
    $out -join "`n" | Set-Content -Path $SettingsYml -Encoding UTF8
    Write-Host '   已清理 settings.yaml 的 moye-skin 段'
  }
  Write-Host '重启 DSH 后生效。' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------------
# 安装 / 更新
# ------------------------------------------------------------------
Write-Step "安装到 $Target"
Backup-ProfileConfigs
if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
New-Item -ItemType Directory -Path $Target -Force | Out-Null

# 只复制运行期需要的东西（不要把 tools/ 与整棵源码树带进去）
foreach ($item in @('package.json', 'cordis.patch.yml', 'lib', 'data', 'assets', 'README.md')) {
  $src = Join-Path $Source $item
  if (-not (Test-Path $src)) { Write-Host "   跳过（不存在）：$item" -ForegroundColor DarkYellow; continue }
  Copy-Item $src -Destination $Target -Recurse -Force
  Write-Host "   复制 $item"
}

# ------------------------------------------------------------------
# ★ 构建指纹：把源码哈希注入已安装的 lib/client.js。
#
# 为什么必须做：这十几轮反复卡在"浏览器跑的到底是哪一份代码"上 ——
# 浏览器缓存、HMR 重注册、DSH 启动时的 combo 快照，三处都可能给旧字节，
# 而我一直没有可靠手段判断是哪一份。现在把 BUILD_ID 写进包里，
# 浏览器跑起来后探针会把它报回来，一眼就能对齐"源码 / 安装 / 运行"三者。
# ------------------------------------------------------------------
$sha = [BitConverter]::ToString(
  [Security.Cryptography.SHA256]::Create().ComputeHash(
    [IO.File]::ReadAllBytes((Join-Path $Source 'lib\client.js'))
  )
).Replace('-', '').Substring(0, 10)
$buildId = "$sha-$(Get-Date -Format 'MMdd-HHmmss')"
$installed = Join-Path $Target 'lib\client.js'
try {
  $text = [IO.File]::ReadAllText($installed)
  $marker = 'const BUILD_ID = '
  if ($text.Contains($marker)) {
    $text = [regex]::Replace($text, [regex]::Escape($marker) + "'[^']*'", $marker + "'" + $buildId + "'", 1)
  } else {
    $anchor = 'const ROUTE = '
    $text = $text.Replace($anchor, $marker + "'" + $buildId + "'`r`n    " + $anchor)
  }
  [IO.File]::WriteAllText($installed, $text)
  Write-Host "   构建指纹 BUILD_ID = $buildId" -ForegroundColor Cyan
} catch {
  Write-Host "   注入指纹失败：$($_.Exception.Message)" -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# schemastery：本插件在宿主半边 import 它，而 pnpm 布局下 profile 根
# node_modules 里已有一份（@deepseek-ai/schemastery），这里做一个转发目录，
# 让 `import z from '@deepseek-ai/schemastery'` 能解析到。
# ------------------------------------------------------------------
Write-Step '解析 @deepseek-ai/schemastery'
$schemaLink = Join-Path $Target 'node_modules\@deepseek-ai'
$schemaReal = Join-Path $ProfileDir 'node_modules\@deepseek-ai\schemastery'
if (Test-Path $schemaReal) {
  New-Item -ItemType Directory -Path $schemaLink -Force | Out-Null
  $dest = Join-Path $schemaLink 'schemastery'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  try {
    New-Item -ItemType Junction -Path $dest -Target $schemaReal -ErrorAction Stop | Out-Null
    Write-Host "   junction -> $schemaReal"
  } catch {
    Copy-Item $schemaReal -Destination $dest -Recurse -Force
    Write-Host "   复制（junction 失败，已改为拷贝）"
  }
} else {
  Write-Host "   ⚠ 没找到 $schemaReal；插件可能在加载时报 'Cannot find module'" -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# 独立备份：把「代码 + 数据」拷到 $DSH_HOME 外面（默认 %USERPROFILE%）
# ------------------------------------------------------------------
# 为什么不带 assets：素材有 263.2 MiB，而**发出去的 .tgz 里已经带了全套素材**。
# 代码+数据只有几百 KB，所以这里分开：
#   · 这份小备份保证「DSH 起不来时，你手上永远有一份能重装的代码」
#   · 素材从分发包 dsh-skin-mahoyo-*.tgz 里取（解包即有 assets/）
#     ⛔ 不要用 tools\assemble-assets.mjs 重建 —— 它已作废，会毁 manifest（见 README §12.1）
Write-Step '独立备份（代码 + 数据）'
$MirrorRoot = if ($env:MAHOYO_BACKUP_DIR) { $env:MAHOYO_BACKUP_DIR } else { Join-Path $env:USERPROFILE 'moye-skin-backup' }
try {
  New-Item -ItemType Directory -Path $MirrorRoot -Force | Out-Null
  foreach ($item in @('package.json', 'cordis.patch.yml', 'lib', 'data', 'README.md')) {
    $src = Join-Path $Source $item
    if (Test-Path $src) { Copy-Item $src -Destination $MirrorRoot -Recurse -Force }
  }
  $toolsDst = Join-Path $MirrorRoot 'tools'
  New-Item -ItemType Directory -Path $toolsDst -Force | Out-Null
  Copy-Item (Join-Path $Source 'tools\*.ps1') $toolsDst -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Source 'tools\*.mjs') $toolsDst -Force -ErrorAction SilentlyContinue
  # ★ 2026-09-22 补：**.py 也要收**。原来只收 .ps1/.mjs，于是 crop_alpha.py
  #   与 crop_conf.py 都不在急救包里 —— 而 crop_conf.py 是设置页那 80 个切片的
  #   **唯一来源**（assemble-assets.mjs 不生成 conf/），漏了它就说不清怎么重建。
  Copy-Item (Join-Path $Source 'tools\*.py') $toolsDst -Force -ErrorAction SilentlyContinue
  # 抢救脚本也放一份，这样**这个备份目录自己就是完整的急救包**
  $recoverySrc = Join-Path $WorkspaceRoot 'recovery'
  if (Test-Path $recoverySrc) {
    Copy-Item (Join-Path $recoverySrc 'rollback.ps1') $toolsDst -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $recoverySrc 'restore-from-backup.ps1') $toolsDst -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $recoverySrc 'README.md') (Join-Path $MirrorRoot 'RECOVERY.md') -Force -ErrorAction SilentlyContinue
  }
  Write-Host "   已备份到 $MirrorRoot" -ForegroundColor Green
  Write-Host '   （不含 assets：素材在分发包 .tgz 里，解包即得）'
} catch {
  Write-Host "   独立备份失败（不影响安装）：$($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Step '注册到 profile bundles'
Set-BundleEnabled $true

# ------------------------------------------------------------------
# 安全模式标记
# ------------------------------------------------------------------
Write-Step '安全模式标记'
if ($SafeBoot) {
  'safe' | Set-Content -Path $SafeFlag -Encoding ASCII
  Write-Host "   已创建 $SafeFlag —— 皮肤会被加载但什么都不注册、什么都不渲染。" -ForegroundColor Green
  Write-Host '   这样第一次启动可以先把"是不是它把 DSH 弄挂了"这件事排掉。' -ForegroundColor Green
} elseif (Test-Path $SafeFlag) {
  Write-Host "   SAFE_MODE 仍然存在（皮肤处于静默状态）。要生效请删掉它，或用 -NormalBoot：" -ForegroundColor Yellow
  Write-Host "     Remove-Item `"$SafeFlag`"" -ForegroundColor Yellow
  Write-Host "     pwsh -File skin\tools\guard.ps1 -NormalBoot" -ForegroundColor Yellow
} else {
  Write-Host '   未设置（皮肤正常生效）。'
}

# ------------------------------------------------------------------
# 素材自检
# ------------------------------------------------------------------
Write-Step '素材自检'
$manifest = Join-Path $Target 'data\manifest.json'
if (Test-Path $manifest) {
  $files = Get-ChildItem (Join-Path $Target 'assets') -Recurse -File -ErrorAction SilentlyContinue
  $sizeMB = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 1)
  # ⚠ `PSObject.Properties` 是**集合**，直接取 `.Count` 会被 PowerShell 逐元素展开，
  #    于是每个景各返回一个 1、拼成 "1 1 1 1 …"（实测踩过）。
  #    必须先 `@(...)` 物化成数组，`.Count` 才是条数。
  $sceneCount = @((Get-Content $manifest -Raw | ConvertFrom-Json).scenes.PSObject.Properties).Count
  $slotCount = @((Get-Content $manifest -Raw | ConvertFrom-Json).expressions.PSObject.Properties).Count
  $roleCount = @((Get-Content $manifest -Raw | ConvertFrom-Json).lexiconByCharacter.PSObject.Properties).Count
  Write-Host "   manifest: $sceneCount 个景 / $slotCount 个情绪槽 / $roleCount 个角色"
  Write-Host "   assets  : $($files.Count) 个文件，$sizeMB MB"
} else {
  Write-Host '   ⚠ data/manifest.json 缺失：从分发包 dsh-skin-mahoyo-*.tgz 重新解一份。' -ForegroundColor Yellow
  Write-Host '     ⛔ 不要跑 assemble-assets.mjs —— 它已作废，会毁 manifest。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '★ 下一步请用「守卫」启动，它会先预检、起不来就自动回滚：' -ForegroundColor Cyan
Write-Host "     pwsh -File `"$PSScriptRoot\guard.ps1`"" -ForegroundColor Cyan
Write-Host ''
Write-Host '   万一 DSH 真的起不来（终端里跑抢救，不依赖 DSH）：' -ForegroundColor Gray
Write-Host "     pwsh -File `"$WorkspaceRoot\recovery\rollback.ps1`"" -ForegroundColor Gray
Write-Host ''
Write-Host '   浏览器里的一键逃生门：Ctrl+Shift+M（就地关闭皮肤，立即生效）' -ForegroundColor Gray
Write-Host "   想先零风险试一次：pwsh -File `"$PSScriptRoot\install.ps1`" -SafeBoot" -ForegroundColor Gray

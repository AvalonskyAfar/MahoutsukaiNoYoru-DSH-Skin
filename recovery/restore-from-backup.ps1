# =============================================================================
# dsh-skin-mahoyo · 从独立备份重装（restore-from-backup.ps1）
# =============================================================================
#
# 用途：**工作区丢了 / 被移动了 / DSH 起不来了** 的时候，
#       用 %USERPROFILE%\moye-skin-backup 里那份「代码 + 数据」把皮肤装回去。
#
# 为什么不备份 assets：素材有 263.2 MiB，而且可以从 hfa_png/out + bgm/ 用
#   `node skin/tools/assemble-assets.mjs` 幂等重建。代码+数据只有几百 KB，
#   所以分成两件事：小备份保证"永远有一份能重装的代码"，
#   素材按需从工作区重新装配。
#
# 用法：
#   pwsh -File restore-from-backup.ps1                       # 装回 DSH profile
#   pwsh -File restore-from-backup.ps1 -Source "D:\..."      # 指定备份目录
#   pwsh -File restore-from-backup.ps1 -WithAssets           # 连素材一起装（备份里有才有效）
#
# =============================================================================

[CmdletBinding()]
param(
  [string]$Source,
  [string]$DshHome = $env:DSH_HOME,
  [string]$Profile = 'web',
  [switch]$WithAssets
)

$ErrorActionPreference = 'Stop'
$PkgName = 'dsh-skin-mahoyo'

if (-not $Source) { $Source = Join-Path $env:USERPROFILE 'moye-skin-backup' }
if (-not (Test-Path $Source)) { throw "找不到备份目录：$Source" }
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }

$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$ProfilePkg = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $ProfilePkg)) { throw "找不到 profile：$ProfilePkg" }

$Target = Join-Path $ProfileDir "node_modules\$PkgName"

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Head($m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }

Say ''
Say '魔法使之夜皮肤 · 从独立备份重装' Cyan
Say "   备份 : $Source"
Say "   目标 : $Target"

Head '1/3 复制代码与数据'
if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
New-Item -ItemType Directory -Path $Target -Force | Out-Null
foreach ($item in @('package.json', 'cordis.patch.yml', 'lib', 'data', 'README.md')) {
  $src = Join-Path $Source $item
  if (-not (Test-Path $src)) { Say "   跳过（备份里没有）：$item" DarkYellow; continue }
  Copy-Item $src -Destination $Target -Recurse -Force
  Say "   复制 $item"
}

if ($WithAssets) {
  $assets = Join-Path $Source 'assets'
  if (Test-Path $assets) {
    Copy-Item $assets -Destination $Target -Recurse -Force
    Say '   复制 assets/'
  } else {
    Say '   备份里没有 assets/（这符合预期：素材不随小备份走）' Yellow
  }
}

Head '2/3 schemastery 转发'
$schemaLink = Join-Path $Target 'node_modules\@deepseek-ai'
$schemaReal = Join-Path $ProfileDir 'node_modules\@deepseek-ai\schemastery'
if (Test-Path $schemaReal) {
  New-Item -ItemType Directory -Path $schemaLink -Force | Out-Null
  $dest = Join-Path $schemaLink 'schemastery'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  try { New-Item -ItemType Junction -Path $dest -Target $schemaReal -ErrorAction Stop | Out-Null; Say '   junction OK' }
  catch { Copy-Item $schemaReal -Destination $dest -Recurse -Force; Say '   已改为拷贝' }
} else {
  Say "   ⚠ 找不到 $schemaReal" Yellow
}

Head '3/3 注册到 profile bundles'
$j = Get-Content $ProfilePkg -Raw | ConvertFrom-Json
$list = @($j.dsh.profile.bundles)
if ($list -notcontains $PkgName) { $list += $PkgName }
$j.dsh.profile.bundles = $list
($j | ConvertTo-Json -Depth 10) | Set-Content -Path $ProfilePkg -Encoding UTF8
Say "   bundles: $($list -join ', ')"

Write-Host ''
if (-not (Test-Path (Join-Path $Target 'data\manifest.json'))) {
  Say '⚠ data/manifest.json 不在 —— 皮肤会起来但什么都不显示。' Yellow
  Say '  需要素材：在原始工作区跑 node skin\tools\assemble-assets.mjs 再重装。' Yellow
}
if (-not (Test-Path (Join-Path $Target 'assets'))) {
  Say '⚠ assets/ 不在 —— 皮肤会起来但图都是空的（背景/立绘/BGM 全缺）。' Yellow
  Say '  在原始工作区跑 node skin\tools\assemble-assets.mjs，然后重跑本脚本并加 -WithAssets。' Yellow
}
Say '重装完成。' Green
Say '下一步用守卫启动（它会先预检、起不来就回滚）：' Gray
Say "   pwsh -File `"$Source\tools\guard.ps1`"" Gray

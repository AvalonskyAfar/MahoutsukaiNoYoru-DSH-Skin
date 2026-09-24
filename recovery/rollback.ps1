# =============================================================================
# dsh-skin-mahoyo · 一键抢救（rollback.ps1）
# =============================================================================
#
# **DSH 起不来的时候跑这个。** 它不依赖 DSH、不依赖网络，只做文件操作。
#
# 做四件事（全部幂等，跑多少遍都一样）：
#   1. 把 `dsh-skin-mahoyo` 从 profile 的 `dsh.profile.bundles` 里摘掉
#   2. 建 `skin/SAFE_MODE`（下次即使又被启用，皮肤也只静默不渲染）
#   3. 删掉 settings.yaml 里的 `moye-skin:` 段（可选，-KeepSettings 跳过）
#   4. 打印验证命令和后续步骤
#
# 用法：
#   pwsh -File recovery\rollback.ps1                # 抢救（默认 profile = web）
#   pwsh -File recovery\rollback.ps1 -Profile tui
#   pwsh -File recovery\rollback.ps1 -KeepSettings  # 保留 settings.yaml 里的皮肤段
#   pwsh -File recovery\rollback.ps1 -Restore       # 反向：从最近的备份还原
#   pwsh -File recovery\rollback.ps1 -ListBackups
#
# =============================================================================

[CmdletBinding()]
param(
  [string]$DshHome = $env:DSH_HOME,
  [string]$Profile = 'web',
  [switch]$KeepSettings,
  [switch]$Restore,
  [switch]$ListBackups
)

$ErrorActionPreference = 'Stop'
$PkgName = 'dsh-skin-mahoyo'

# -----------------------------------------------------------------------------
# 路径解析：让这份脚本在**两个位置**都能跑
#   A) 工作区   <workspace>\recovery\rollback.ps1      → SAFE_MODE 在 <workspace>\skin\，备份在 <workspace>\recovery\backups\
#   B) 独立备份 %USERPROFILE%\moye-skin-backup\tools\rollback.ps1 → 两者都在备份根下
# -----------------------------------------------------------------------------
$Here = $PSScriptRoot
$Parent = (Resolve-Path (Join-Path $Here '..')).Path
if (Test-Path (Join-Path $Parent 'skin\lib\client.js')) {
  # A) 工作区布局
  $WorkspaceRoot = $Parent
  $SkinDir = Join-Path $Parent 'skin'
  $BackupRoot = Join-Path $Here 'backups'
} else {
  # B) 独立备份布局（tools/ 的上一级就是皮肤根）
  $SkinDir = $Parent
  $WorkspaceRoot = $Parent
  $BackupRoot = Join-Path $Parent 'backups'
}
$SafeFlag = Join-Path $SkinDir 'SAFE_MODE'

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$ProfilePkg = Join-Path $ProfileDir 'package.json'
$SettingsYml = Join-Path $DshHome 'settings.yaml'

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Head($m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }

Say ''
Say '魔法使之夜皮肤 · 一键抢救' Cyan
Say "   DSH_HOME : $DshHome"
Say "   profile  : $Profile"
Say "   包        : $ProfileDir\node_modules\$PkgName"

# -----------------------------------------------------------------------------
# 列出备份
# -----------------------------------------------------------------------------
if ($ListBackups) {
  Head '备份列表'
  if (-not (Test-Path $BackupRoot)) { Say '   （还没有备份）' Yellow; exit 0 }
  Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending | ForEach-Object {
    $files = (Get-ChildItem $_.FullName -File | Select-Object -ExpandProperty Name) -join ', '
    Say ("   {0}  {1}" -f $_.Name, $files)
  }
  exit 0
}

# -----------------------------------------------------------------------------
# 反向：从最近备份还原
# -----------------------------------------------------------------------------
if ($Restore) {
  Head '从备份还原'
  if (-not (Test-Path $BackupRoot)) { Say '   没有备份可还原。' Red; exit 1 }
  $latest = Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { Say '   没有备份可还原。' Red; exit 1 }
  Say "   使用备份：$($latest.Name)"
  foreach ($name in @('package.json', 'cordis.yml', 'settings.yaml')) {
    $src = Join-Path $latest.FullName $name
    if (-not (Test-Path $src)) { continue }
    $dst = switch ($name) {
      'package.json'  { $ProfilePkg }
      'cordis.yml'    { Join-Path $ProfileDir 'cordis.yml' }
      'settings.yaml' { $SettingsYml }
    }
    Copy-Item $src $dst -Force
    Say "   还原 $name -> $dst" Green
  }
  if (Test-Path $SafeFlag) { Remove-Item $SafeFlag -Force; Say '   已删除 SAFE_MODE' Green }
  Say ''
  Say '完成。现在可以启动 DSH 了。' Green
  exit 0
}

# -----------------------------------------------------------------------------
# 抢救
# -----------------------------------------------------------------------------
Head '1/4 从 profile bundles 里摘掉皮肤'
if (Test-Path $ProfilePkg) {
  $j = Get-Content $ProfilePkg -Raw | ConvertFrom-Json
  $before = @($j.dsh.profile.bundles)
  if ($before -contains $PkgName) {
    # 先备份再改
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $BackupRoot $stamp
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item $ProfilePkg (Join-Path $dir 'package.json') -Force
    if (Test-Path $SettingsYml) { Copy-Item $SettingsYml (Join-Path $dir 'settings.yaml') -Force }

    $j.dsh.profile.bundles = @($before | Where-Object { $_ -ne $PkgName })
    ($j | ConvertTo-Json -Depth 10) | Set-Content -Path $ProfilePkg -Encoding UTF8
    Say "   已摘掉。bundles 现在是：" Green
    @($j.dsh.profile.bundles) | ForEach-Object { Say "     - $_" }
    Say "   备份：$dir"
  } else {
    Say '   皮肤本来就不在 bundles 里，无需处理。'
  }
} else {
  Say "   ⚠ 找不到 $ProfilePkg" Yellow
}

Head '2/4 建立 SAFE_MODE'
New-Item -ItemType Directory -Path $SkinDir -Force | Out-Null
'safe' | Set-Content -Path $SafeFlag -Encoding ASCII
Say "   已创建 $SafeFlag" Green
Say '   含义：即使皮肤以后又被启用，它也只会静默加载，不注册、不渲染。'

Head '3/4 处理 settings.yaml 里的 moye-skin 段'
if ($KeepSettings) {
  Say '   -KeepSettings：保留原样。'
} elseif (Test-Path $SettingsYml) {
  $lines = Get-Content $SettingsYml
  $out = New-Object System.Collections.Generic.List[string]
  $skipping = $false
  foreach ($line in $lines) {
    if ($line -match '^moye-skin\s*:') { $skipping = $true; continue }
    if ($skipping) {
      if ($line -match '^\S' -and $line -notmatch '^\s') { $skipping = $false }
      else { continue }
    }
    if (-not $skipping) { $out.Add($line) }
  }
  $out -join "`n" | Set-Content -Path $SettingsYml -Encoding UTF8
  Say '   已移除 moye-skin 段。' Green
} else {
  Say '   settings.yaml 不存在，跳过。'
}

Head '4/4 验证并修复'
$dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
$env:DSH_HOME = $DshHome

function Invoke-DumpConfig {
  if (-not $dshCmd) { return @{ ok = $false; out = @('找不到 dsh 命令') } }
  try {
    if ($dshCmd.Source -like '*.ps1') { $o = & $dshCmd.Source $Profile '--dump-config' 2>&1 }
    elseif ($dshCmd.Source -like '*.cmd') { $o = & $dshCmd.Source $Profile '--dump-config' 2>&1 }
    else { $o = & $dshCmd.Source $Profile '--dump-config' 2>&1 }
    return @{ ok = ($LASTEXITCODE -eq 0); out = @($o) }
  } catch { return @{ ok = $false; out = @($_.Exception.Message) } }
}

function Get-BundleNames { 
  if (-not (Test-Path $ProfilePkg)) { return @() }
  return @((Get-Content $ProfilePkg -Raw | ConvertFrom-Json).dsh.profile.bundles)
}
function Set-BundleNames($names) {
  $j = Get-Content $ProfilePkg -Raw | ConvertFrom-Json
  $j.dsh.profile.bundles = @($names)
  ($j | ConvertTo-Json -Depth 10) | Set-Content -Path $ProfilePkg -Encoding UTF8
}

$r = Invoke-DumpConfig
if ($r.ok) {
  Say '   ✓ 组合成功（exit 0）—— DSH 应该能正常启动了。' Green
  Write-Host ''
  Say '抢救完成。' Green
  Say '   · 现在正常启动 DSH（应该能进了）' Gray
  Say '   · 想再试皮肤：删掉 skin\SAFE_MODE，再跑 pwsh -File skin\tools\guard.ps1' Gray
  Say '   · 想彻底卸载：pwsh -File skin\tools\install.ps1 -Uninstall' Gray
  exit 0
}

Say '   ✗ 组合仍然失败 —— 说明坏的不只是皮肤。启动降级修复：' Yellow

# ---- 降级修复 A：逐份备份倒序试，找到"最后一个能组合的配置" --------------
$fixed = $false
if (Test-Path $BackupRoot) {
  $backups = Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending
  Say ''
  Say "   尝试 $($backups.Count) 份备份（新→旧）：" 
  foreach ($b in $backups) {
    $cand = Join-Path $b.FullName 'package.json'
    if (-not (Test-Path $cand)) { continue }
    Copy-Item $cand $ProfilePkg -Force
    $chk = Invoke-DumpConfig
    if ($chk.ok) {
      Say "   ✓ 备份 $($b.Name) 可以组合 —— 已还原到它。" Green
      $yml = Join-Path $b.FullName 'cordis.yml'
      if (Test-Path $yml) { Copy-Item $yml (Join-Path $ProfileDir 'cordis.yml') -Force }
      $fixed = $true
      break
    }
    Say "     $($b.Name) 也不行，继续往前找…" DarkYellow
  }
}

# ---- 降级修复 B：按报错逐个剔除"解析不到"的 bundle --------------------------
if (-not $fixed) {
  Say ''
  Say '   所有备份都不行 —— 改为按报错自动剔除无法解析的 bundle：' 
  for ($round = 1; $round -le 12; $round++) {
    $chk = Invoke-DumpConfig
    if ($chk.ok) {
      Say "   ✓ 第 $($round - 1) 轮剔除后组合成功。" Green
      $fixed = $true
      break
    }
    $text = ($chk.out -join "`n")
    $m = [regex]::Match($text, 'cannot resolve profile bundle "([^"]+)"')
    if (-not $m.Success) {
      Say '     报错里没有"解析不到 bundle"的信息，自动剔除到此为止。' DarkYellow
      Say '     请把下面这段发给我：' DarkYellow
      $chk.out | Select-Object -First 12 | ForEach-Object { Say "       $_" DarkRed }
      break
    }
    $bad = $m.Groups[1].Value
    $names = Get-BundleNames
    if ($names -notcontains $bad) { Say "     找不到 $bad 在 bundles 里的位置，停止。" DarkYellow; break }
    $names = @($names | Where-Object { $_ -ne $bad })
    Set-BundleNames $names
    Say "     已剔除 '$bad'（第 $round 轮）" Yellow
  }
}

Write-Host ''
if ($fixed) {
  Say '抢救完成 —— 组合已恢复，DSH 现在应该能启动了。' Green
  Say "   · 当前 bundles：$((Get-BundleNames) -join ', ')" Gray
  Say '   · 被剔除的条目可能还需要重新安装：dsh plugin --profile web install' Gray
  Say '   · 想还原到抢救前：pwsh -File recovery\rollback.ps1 -Restore' Gray
  exit 0
}
Say '自动修复没能让它起来。请把上面的报错发给我。' Red
Say "   profile 配置：$ProfilePkg" Gray
Say "   备份目录：$BackupRoot" Gray
exit 1

# =============================================================================
# dsh-skin-mahoyo · 安全重启（guard.ps1）
# =============================================================================
#
# 实测结论（本机 DSH 0.1.5-rc.1）：
#   profile 的 bundle **解析不到** → **整个 profile 起不来**，报错是
#     cannot resolve profile bundle "<name>" from the dsh installation or <profileDir>
#   这条路径代码层面兜不住，只能"启动前先验证、起不来就撤"。
#
# -----------------------------------------------------------------------------
# 设计原则（第一版踩过的坑，全部修掉）：
#
#   · **不自己启动 DSH**。
#     第一版用 Start-Process 拉起 dsh 再轮询端口，依赖太多：
#       - `Get-NetTCPConnection` 在非管理员下抛「拒绝访问」，
#         而脚本开头是 `$ErrorActionPreference = 'Stop'` → 一进去就崩
#       - 拉起的新进程未必带得上你平时用的环境变量与启动方式
#       - DSH 已经在跑的时候行为含糊
#     现在改成：**脚本只做预检 + 备份 + 生成一键撤回脚本，启动由你自己来**。
#     简单、可预测、不猜你的启动方式。
#
#   · **端口探测只用 Invoke-WebRequest**（不需要管理员权限），401/403 也算"服务在"。
#
#   · **`$ErrorActionPreference = 'Continue'`**：任何一步失败都继续走完，
#     最后给一份明确的状态报告，而不是中途抛个看不懂的异常就死。
#
# -----------------------------------------------------------------------------
# 用法：
#   pwsh -File skin\tools\guard.ps1                 # 预检 + 备份 + 生成撤回脚本
#   pwsh -File skin\tools\guard.ps1 -PreflightOnly  # 只预检
#   pwsh -File skin\tools\guard.ps1 -SafeBoot       # 预检后建 SAFE_MODE（皮肤静默）
#   pwsh -File skin\tools\guard.ps1 -NormalBoot     # 删 SAFE_MODE（皮肤生效）
#   pwsh -File skin\tools\guard.ps1 -Watch          # 预检后盯着，起来了报平安
# =============================================================================

[CmdletBinding()]
param(
  [string]$DshHome = $env:DSH_HOME,
  [string]$Profile = 'web',
  [int]$Port = 3080,
  [int]$TimeoutSec = 90,
  [switch]$PreflightOnly,
  [switch]$SafeBoot,
  [switch]$NormalBoot,
  [switch]$Watch
)

$ErrorActionPreference = 'Continue'

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Head($m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }

# -----------------------------------------------------------------------------
# 路径（工作区布局 与 独立备份布局 都能跑）
# -----------------------------------------------------------------------------
$Here = $PSScriptRoot
$Parent = (Resolve-Path (Join-Path $Here '..')).Path
if (Test-Path (Join-Path $Parent 'lib\client.js')) {
  $SkinDir = $Parent
  $WorkspaceRoot = (Resolve-Path (Join-Path $Parent '..')).Path
  $RecoveryDir = Join-Path $WorkspaceRoot 'recovery'
} else {
  $SkinDir = $Parent
  $WorkspaceRoot = $Parent
  $RecoveryDir = $Parent
}
$BackupRoot = Join-Path $RecoveryDir 'backups'
$SafeFlag = Join-Path $SkinDir 'SAFE_MODE'
$PkgName = 'dsh-skin-mahoyo'

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$ProfilePkg = Join-Path $ProfileDir 'package.json'
$ProfileYml = Join-Path $ProfileDir 'cordis.yml'
$SettingsYml = Join-Path $DshHome 'settings.yaml'
$LogFile = Join-Path $BackupRoot 'guard.log'

New-Item -ItemType Directory -Path $BackupRoot -Force -ErrorAction SilentlyContinue | Out-Null
try { Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue | Out-Null } catch { }

Say ''
Say '魔法使之夜皮肤 · 安全重启' Cyan
Say "   DSH_HOME  : $DshHome"
Say "   profile   : $Profile"
Say "   skin      : $SkinDir"
Say "   PowerShell: $($PSVersionTable.PSVersion)"

# -----------------------------------------------------------------------------
# 找 dsh（找不到也不致命，只是不能预检）
# -----------------------------------------------------------------------------
function Resolve-Dsh {
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $npx = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
  if (Test-Path $npx) {
    $hit = Get-ChildItem $npx -Recurse -Filter 'bin.js' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -like '*@deepseek-ai\dsh\lib\bin.js' } |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}
$DshExe = Resolve-Dsh
if ($DshExe) { Say "   dsh       : $DshExe" } else { Say '   dsh       : **找不到**（预检会跳过）' Yellow }

# -----------------------------------------------------------------------------
# 端口探测（只用 Invoke-WebRequest —— 不需要管理员）
# -----------------------------------------------------------------------------
function Test-Up {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop
    return ($r.StatusCode -ge 200)
  } catch {
    # 401/403 也表示服务在（只是要鉴权）
    $code = $null
    try { $code = $_.Exception.Response.StatusCode.value__ } catch { }
    if ($code -eq 401 -or $code -eq 403 -or $code -eq 200) { return $true }
    return $false
  }
}

# -----------------------------------------------------------------------------
# 安全模式开关
# -----------------------------------------------------------------------------
if ($SafeBoot) {
  Head '安全模式：开'
  'safe' | Set-Content -Path $SafeFlag -Encoding ASCII -ErrorAction SilentlyContinue
  Say '   已创建 SAFE_MODE —— 皮肤会被加载但什么都不注册、什么都不渲染。' Green
  Say '   用途：一次实验就能定性「DSH 起不来到底是不是皮肤的锅」。'
}
if ($NormalBoot) {
  Head '安全模式：关'
  if (Test-Path $SafeFlag) { Remove-Item $SafeFlag -Force -ErrorAction SilentlyContinue }
  Say '   已删除 SAFE_MODE —— 皮肤生效。' Green
}

# -----------------------------------------------------------------------------
# 备份
# -----------------------------------------------------------------------------
Head '备份'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $BackupRoot $stamp
try {
  New-Item -ItemType Directory -Path $BackupDir -Force -ErrorAction Stop | Out-Null
  foreach ($f in @($ProfilePkg, $ProfileYml, $SettingsYml)) {
    if (Test-Path $f) {
      Copy-Item $f (Join-Path $BackupDir ([IO.Path]::GetFileName($f))) -Force -ErrorAction SilentlyContinue
    }
  }
  Say "   -> $BackupDir" Green
} catch {
  Say "   备份失败（不致命，继续）：$($_.Exception.Message)" Yellow
}

# -----------------------------------------------------------------------------
# 预检
# -----------------------------------------------------------------------------
$preflightOk = $null
Head '预检：组合 profile（--dump-config）'
if (-not $DshExe) {
  Say '   跳过（找不到 dsh 命令）。' Yellow
} elseif (-not (Test-Path $ProfilePkg)) {
  Say "   跳过（找不到 $ProfilePkg）" Yellow
} else {
  $env:DSH_HOME = $DshHome
  $out = $null
  if ($DshExe -like '*.ps1') { $out = & $DshExe $Profile '--dump-config' 2>&1 }
  elseif ($DshExe -like '*.cmd') { $out = & $DshExe $Profile '--dump-config' 2>&1 }
  else { $out = & node $DshExe $Profile '--dump-config' 2>&1 }
  $code = $LASTEXITCODE
  $hasSkin = ($out | Select-String -Pattern $PkgName -Quiet)
  if ($code -eq 0) {
    $preflightOk = $true
    Say '   组合成功（exit 0）' Green
    Say "   皮肤在组合树里：$(if ($hasSkin) { '是' } else { '否' })"
  } else {
    $preflightOk = $false
    Say "   组合失败（exit $code）：" Red
    $out | Select-Object -First 8 | ForEach-Object { Say "     $_" DarkRed }
  }
}

# -----------------------------------------------------------------------------
# 生成一键撤回脚本（无论预检结果都给 —— 起不来时有它就不慌）
# -----------------------------------------------------------------------------
Head '生成一键撤回脚本'
if (Test-Path $ProfilePkg) {
  Copy-Item $ProfilePkg (Join-Path $BackupDir 'package.json.good') -Force -ErrorAction SilentlyContinue
}
$UndoPs1 = Join-Path $BackupDir 'UNDO-如果起不来就跑我.ps1'
$nl = [Environment]::NewLine
$undoBody = @(
  '# 一键撤回：把 profile 配置还原到 ' + $stamp + ' 这一份，并停用皮肤'
  '$ErrorActionPreference = ''Continue'''
  '$Pkg = ''' + $ProfilePkg + ''''
  '$PkgName = ''' + $PkgName + ''''
  'Write-Host ''正在撤回 dsh-skin-mahoyo ...'' -ForegroundColor Cyan'
  'if (Test-Path ''' + $BackupDir + '\package.json.good'') {'
  '  Copy-Item ''' + $BackupDir + '\package.json.good'' $Pkg -Force'
  '  Write-Host ''  已从备份还原 profile/package.json'' -ForegroundColor Green'
  '}'
  'try {'
  '  $j = Get-Content $Pkg -Raw | ConvertFrom-Json'
  '  $j.dsh.profile.bundles = @($j.dsh.profile.bundles | Where-Object { $_ -ne $PkgName })'
  '  ($j | ConvertTo-Json -Depth 10) | Set-Content $Pkg -Encoding UTF8'
  '  Write-Host ''  已确保皮肤不在 bundles 里'' -ForegroundColor Green'
  '} catch { Write-Host "  清理 bundles 失败：$($_.Exception.Message)" -ForegroundColor Yellow }'
  '''safe'' | Set-Content ''' + $SafeFlag + ''' -Encoding ASCII -ErrorAction SilentlyContinue'
  'Write-Host ''  已建立 SAFE_MODE'' -ForegroundColor Green'
  'Write-Host '''''
  'Write-Host ''现在正常启动 DSH 即可。'' -ForegroundColor Green'
  'Read-Host ''按回车关闭'''
) -join $nl
try {
  $undoBody | Set-Content -Path $UndoPs1 -Encoding UTF8
  Say "   $UndoPs1" Green
} catch { Say "   生成失败：$($_.Exception.Message)" Yellow }

if ($PreflightOnly) {
  Head '只预检：到此为止'
  if ($preflightOk -eq $true) { Say '预检通过。可以放心重启。' Green; exit 0 }
  if ($preflightOk -eq $false) { Say '预检失败 —— 先跑 recovery\rollback.ps1 再重启。' Red; exit 1 }
  Say '没能预检（缺 dsh 命令或 profile）。' Yellow
  exit 2
}

# -----------------------------------------------------------------------------
# 结论
# -----------------------------------------------------------------------------
Head '结论'
$up = Test-Up
Say "   http://127.0.0.1:$Port : $(if ($up) { '**在响应**（DSH 正在跑）' } else { '没有响应（DSH 没在跑）' })"

if ($preflightOk -eq $false) {
  Write-Host ''
  Say '⚠ 预检失败：现在重启会起不来。' Red
  Say '  先跑这个（不依赖 DSH）：' Yellow
  Say "     pwsh -File `"$RecoveryDir\rollback.ps1`"" Yellow
  Say '  然后再重启 DSH。' Yellow
  try { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null } catch { }
  exit 1
}

Write-Host ''
Say '★ 现在可以重启 DSH 了。' Green
Say '   用你平时的方式关掉再打开 —— 本脚本不替你启动，避免猜错启动方式。' Gray
Write-Host ''
Say '   重启后如果界面没变化，浏览器按 F12 → Console 粘这一行，把结果发我：' Gray
Say '     fetch("/moye-skin/health").then(r=>r.json()).then(j=>console.log(JSON.stringify(j.diag,null,1),JSON.stringify(j.loader,null,1)))' Cyan
Write-Host ''
Say '   万一 DSH 起不来：' Gray
Say "     pwsh -File `"$RecoveryDir\rollback.ps1`"" Gray
Say "     或直接跑：$UndoPs1" Gray
Write-Host ''
Say "   本次日志：$LogFile" DarkGray

# -----------------------------------------------------------------------------
# -Watch：盯一会儿，起来了报平安
# -----------------------------------------------------------------------------
if ($Watch) {
  Head "盯着看（最多 ${TimeoutSec}s）—— 现在去重启 DSH"
  Say '   （每 2 秒探一次；DSH 一起来就报平安）'
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $sawDown = $false
  $ok = $false
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $now = Test-Up
    if (-not $now) { $sawDown = $true }
    if ($sawDown -and $now) { $ok = $true; break }
  }
  Write-Host ''
  if ($ok) {
    Say '✓ DSH 已经重新起来了。' Green
    Say '  看界面：应该变成魔夜的样子（背景 + 立绘 + 底部对话框，无侧栏无页签条）。' Gray
    Say '  点画面空白处唤出菜单；BGM 需要先点一下界面才会响。' Gray
  } elseif (-not $sawDown) {
    Say '⚠ 全程没探到 DSH 下线 —— 你还没重启，或者重启太快没抓到。' Yellow
  } else {
    Say '✗ 探到 DSH 下线了，但一直没起来。' Red
    Say '  现在跑抢救：' Yellow
    Say "     pwsh -File `"$RecoveryDir\rollback.ps1`"" Yellow
  }
}

try { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null } catch { }

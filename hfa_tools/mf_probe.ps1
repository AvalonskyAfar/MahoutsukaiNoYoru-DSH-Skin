# 探测系统是否具备 Vorbis 解码能力（Media Foundation）
# 思路：如果系统能解 Vorbis，就能用它把 bgm/*.ogg 转成 PCM/WAV，
#       进而做「m01s 是不是 m01 的缩短版」这类**声学层面**的验证，
#       而不必手写一个完整的 Vorbis 解码器。

Add-Type -AssemblyName PresentationCore -ErrorAction SilentlyContinue

$w = Join-Path $env:TEMP "mf_probe.wav"
$k = Join-Path $env:TEMP "mf_probe_key"

# --- 测试 1: MediaPlayer 能否打开 ogg 并读出时长 ---
try {
    $mp = New-Object System.Windows.Media.MediaPlayer
    $mp.Open([Uri]"D:\QuickLook插件包\moye\bgm\m01.ogg")
    Start-Sleep -Milliseconds 1500
    Write-Output ("MediaPlayer: HasAudio=" + $mp.HasAudio + "  Duration=" + $mp.NaturalDuration)
    $mp.Close()
} catch {
    Write-Output ("MediaPlayer 失败: " + $_.Exception.Message)
}

# --- 测试 2: 系统是否注册了 Vorbis 解码器（MF Transform） ---
Write-Output "`n=== 已注册的 Media Foundation Transform（含 vorbis/ogg 关键字）==="
$roots = @(
  "HKLM:\SOFTWARE\Classes\MediaFoundation\Transforms",
  "HKLM:\SOFTWARE\Classes\CLSID"
)
try {
    $found = 0
    Get-ChildItem "HKLM:\SOFTWARE\Classes\CLSID" -ErrorAction SilentlyContinue | ForEach-Object {
        $n = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).'(default)'
        if ($n -match 'vorbis|ogg') {
            Write-Output ("  " + $_.PSChildName + "  " + $n)
            $found++
        }
    }
    Write-Output "  命中 $found 个"
} catch {
    Write-Output ("  枚举失败: " + $_.Exception.Message)
}

# --- 测试 3: 有没有装 Edge/Chrome（都自带 Vorbis 解码，可用于转码）---
Write-Output "`n=== 浏览器（自带 Vorbis 解码器）==="
foreach ($p in @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")) {
    if (Test-Path $p) { Write-Output "  FOUND $p" }
}

# --- 测试 4: 有没有 node（可跑 WASM 版 Vorbis 解码器）---
Write-Output "`n=== 运行时 ==="
foreach ($c in @("node","npm","dotnet","java")) {
    $x = Get-Command $c -ErrorAction SilentlyContinue
    if ($x) { Write-Output ("  " + $c + " -> " + $x.Source) } else { Write-Output "  no $c" }
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinProbe {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowTextLengthW(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$browsers = 'Chrome_WidgetWin_1','MozillaWindowClass','Chrome_WidgetWin_0'
$rows = New-Object System.Collections.ArrayList

$cb = [WinProbe+EnumProc]{
  param($h, $l)
  if (-not [WinProbe]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][WinProbe]::GetClassNameW($h, $cn, 256)
  $cls = $cn.ToString()
  if ($browsers -notcontains $cls) { return $true }
  $len = [WinProbe]::GetWindowTextLengthW($h)
  $sb = New-Object System.Text.StringBuilder ($len + 2)
  [void][WinProbe]::GetWindowTextW($h, $sb, $sb.Capacity)
  $title = $sb.ToString()
  $cr = New-Object WinProbe+RECT; [void][WinProbe]::GetClientRect($h, [ref]$cr)
  $wr = New-Object WinProbe+RECT; [void][WinProbe]::GetWindowRect($h, [ref]$wr)
  $dpi = [WinProbe]::GetDpiForWindow($h)
  [void]$rows.Add([pscustomobject]@{
    Title    = if ($title.Length -gt 46) { $title.Substring(0,46) } else { $title }
    Class    = $cls
    Client   = "$($cr.Right)x$($cr.Bottom)"
    Window   = "$($wr.Right-$wr.Left)x$($wr.Bottom-$wr.Top)"
    DPI      = $dpi
    Scale    = [math]::Round($dpi/96.0, 2)
    CSSpx    = "$([math]::Round($cr.Right*96.0/$dpi))x$([math]::Round($cr.Bottom*96.0/$dpi))"
    Fore     = ($h -eq [WinProbe]::GetForegroundWindow())
  })
  return $true
}
[void][WinProbe]::EnumWindows($cb, [IntPtr]::Zero)

Write-Host "=== 可见的浏览器窗口 ==="
$rows | Sort-Object -Property Fore -Descending | Format-Table -AutoSize

Write-Host "=== 结论提示 ==="
Write-Host "  CSSpx 列 = 客户区换算成 CSS 像素（= 浏览器 innerWidth/Height 的近似值）"
Write-Host "  把它和探针的 rootBox 比：若 rootBox.w/h 明显小于 CSSpx，说明皮肤根没铺满。"
Write-Host ""
Write-Host "=== 探针最近一次报的视口 ==="
try {
  $h = (Invoke-WebRequest http://127.0.0.1:3080/moye-skin/health -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
  $p = $h.diag.probes[0].data
  "  rootBox  : $($p.rootBox | ConvertTo-Json -Compress)"
  "  nodes.bg : $($p.nodes.bg -join ',')"
  "  probe 时刻: $($h.diag.probes[0].at)"
  "  clientLastSeen: $($h.diag.clientLastSeen)"
} catch { "  health 失败: $_" }

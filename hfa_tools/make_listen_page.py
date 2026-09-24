"""生成试听页 bgm/listen.html —— 让用户能直接点开听、勾选、记录

产物是**单文件 HTML**，用浏览器原生 Ogg Vorbis 解码播放（Chrome/Edge 都支持）。
用户勾选后点"导出选择"，得到一段 JSON，可直接回贴给执行方。
"""
import json, os

BGM = r"D:\QuickLook插件包\moye\bgm"
A = json.load(open(os.path.join(BGM, "bgm_analysis.json"), encoding="utf-8"))
names = sorted(A)

# 每个文件的补充标注（来自结构分析的客观事实，不含主观曲名猜测）
def facts(n):
    d = A[n]
    f = []
    if d["duration"] < 75:
        f.append("短")
    if d["rms"] < 0.05:
        f.append("极安静")
    elif d["rms"] < 0.07:
        f.append("安静")
    elif d["rms"] > 0.14:
        f.append("响亮")
    if d["peak"] < 0.30:
        f.append("电平很低")
    if d["leadInSeconds"] < 0.15:
        f.append("无前奏")
    elif d["leadInSeconds"] > 1.5:
        f.append("长前奏")
    if d["tailOutSeconds"] > 8:
        f.append("长淡出")
    elif d["tailOutSeconds"] < 0.5:
        f.append("无淡出")
    if d["loopCorr"] > 0.7:
        f.append(f"强循环(~{d['loopSeconds']:.0f}s)")
    if d["clippedSamples"] > 0:
        f.append(f"削顶{d['clippedSamples']}")
    return f


rows = []
for n in names:
    d = A[n]
    rows.append(dict(
        id=n, dur=d["duration"], rms=d["rms"], peak=d["peak"],
        lead=d["leadInSeconds"], tail=d["tailOutSeconds"],
        loopc=d["loopCorr"], loops=d["loopSeconds"],
        facts=", ".join(facts(n)),
    ))

# ---- 用户已确认的用途（2026-09-16 用户逐首试听后标注）----
INIT_LIGHT = ["m01s"]
INIT_DARK = ["m56"]
DAILY_LIGHT = ["m02", "m08", "m09", "m17", "m27", "m29", "m37", "m49"]
DAILY_DARK = ["m06", "m18", "m46", "m47", "m63"]
ED = ["m53"]
FAVORITE = ["m01", "m03", "m41"]


def role(n):
    t = []
    if n in INIT_LIGHT: t.append("初始界面·浅色")
    if n in INIT_DARK: t.append("初始界面·深色")
    if n in DAILY_LIGHT: t.append("日常·浅色")
    if n in DAILY_DARK: t.append("日常·深色")
    if n in ED: t.append("ED")
    if n in FAVORITE: t.append("个人收藏")
    return " + ".join(t) if t else "未采用"


for r in rows:
    r["role"] = role(r["id"])

data_js = json.dumps(rows, ensure_ascii=False)

HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>魔夜 BGM 试听台 —— 64 首</title>
<style>
  :root { --bg:#12161c; --panel:#1a2029; --line:#2b3444; --fg:#dfe7f2; --dim:#8b9bb4; --acc:#5cc8ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:14px/1.6 "Segoe UI","Microsoft YaHei",system-ui,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:#0e1218;
           border-bottom:1px solid var(--line); padding:14px 20px; }
  h1 { margin:0 0 4px; font-size:17px; font-weight:600; }
  .sub { color:var(--dim); font-size:12.5px; }
  .wrap { padding:16px 20px 90px; }
  table { width:100%; border-collapse:collapse; }
  th,td { padding:7px 10px; border-bottom:1px solid var(--line); text-align:left;
          vertical-align:middle; }
  th { position:sticky; top:74px; background:#161c25; font-size:12px;
       color:var(--dim); font-weight:600; z-index:4; }
  tr:hover td { background:#1c2431; }
  tr.playing td { background:#12303f; }
  .id { font-family:Consolas,monospace; font-weight:700; color:var(--acc); }
  .num { font-family:Consolas,monospace; text-align:right; color:var(--dim); }
  .facts { color:var(--dim); font-size:12px; }
  button { background:#25303f; color:var(--fg); border:1px solid var(--line);
           border-radius:6px; padding:4px 11px; cursor:pointer; font-size:12.5px; }
  button:hover { background:#31404f; border-color:var(--acc); }
  audio { width:250px; height:30px; vertical-align:middle; }
  input[type=checkbox], input[type=radio] { width:16px; height:16px; cursor:pointer; }
  .bar { position:fixed; bottom:0; left:0; right:0; background:#0e1218;
         border-top:1px solid var(--line); padding:11px 20px; display:flex;
         gap:14px; align-items:center; flex-wrap:wrap; }
  .legend { color:var(--dim); font-size:12px; }
  .legend b { color:var(--fg); }
  textarea { width:100%; height:70px; background:#0b0f14; color:var(--fg);
             border:1px solid var(--line); border-radius:6px; padding:8px;
             font-family:Consolas,monospace; font-size:12px; }
  .pill { display:inline-block; padding:1px 7px; border-radius:9px;
          background:#22303f; color:var(--dim); font-size:11px; margin-left:5px; }
  .role { font-size:12.5px; font-weight:600; }
  .role.dim { color:#5c6b80; font-weight:400; }
  .role.init { color:#7ee787; }
  .role.daily { color:#5cc8ff; }
  .role.ed { color:#ffb454; }
  .role.fav { color:#d2a8ff; }
  tr.used td { background:#161e28; }
</style>
</head>
<body>
<header>
  <h1>魔夜 BGM 试听台 — 64 首　<span class="pill">用途已由用户确认</span></h1>
  <div class="sub">
    这些是从 <code>data03000.hfa</code> 提取、已逐页 CRC 校验通过的 Ogg Vorbis。
    浏览器直接播放（Chrome / Edge 原生支持）。<b>编号是游戏内部资源号，不等于曲名。</b>
    「已定用途」列 = 2026-09-16 用户逐首试听后的确认结果（见 <code>docs/14b-BGM选曲-执行结果.md</code>）。
  </div>
</header>

<div class="wrap">
<table>
  <thead><tr>
    <th style="width:34px">选</th>
    <th style="width:74px">编号</th>
    <th style="width:62px">时长</th>
    <th style="width:230px">播放</th>
    <th style="width:150px">已定用途</th>
    <th style="width:70px">RMS</th>
    <th style="width:60px">峰值</th>
    <th>客观特征</th>
  </tr></thead>
  <tbody id="tb"></tbody>
</table>
</div>

<div class="bar">
  <span class="legend">
    勾选 = 我认为这首适合：<b>在下面文本框写用途</b>（如 <code>初始界面</code> / <code>日常</code> / <code>ED</code>）
  </span>
  <button onclick="exportSel()">导出选择（JSON）</button>
  <button onclick="copySel()">复制到剪贴板</button>
  <button onclick="clearSel()">清空</button>
  <span id="cnt" class="legend"></span>
</div>
<div style="position:fixed;bottom:56px;left:0;right:0;padding:0 20px 8px;background:#0e1218">
  <textarea id="out" placeholder="勾选后点『导出选择』，把这里的内容回贴给我即可。"></textarea>
</div>

<script>
const DATA = __DATA__;
const tb = document.getElementById('tb');
let cur = null;

DATA.forEach(r => {
  const tr = document.createElement('tr');
  tr.dataset.id = r.id;
  if (r.role !== '未采用') tr.classList.add('used');
  const rc = r.role === '未采用' ? 'dim' :
             r.role.includes('ED') ? 'ed' :
             r.role.includes('初始界面') ? 'init' :
             r.role.includes('日常') ? 'daily' : 'fav';
  tr.innerHTML = `
    <td><input type="checkbox" data-id="${r.id}"></td>
    <td class="id">${r.id}</td>
    <td class="num">${Math.floor(r.dur/60)}:${String((r.dur%60).toFixed(0)).padStart(2,'0')}</td>
    <td><button onclick="play('${r.id}', this)">▶ 播放</button></td>
    <td class="role ${rc}">${r.role}</td>
    <td class="num">${r.rms.toFixed(3)}</td>
    <td class="num">${r.peak.toFixed(2)}</td>
    <td class="facts">${r.facts}</td>`;
  tb.appendChild(tr);
});

const audio = new Audio();
audio.volume = 0.85;
audio.addEventListener('ended', () => {
  document.querySelectorAll('tr.playing').forEach(e => e.classList.remove('playing'));
});
function play(id, btn) {
  document.querySelectorAll('tr.playing').forEach(e => e.classList.remove('playing'));
  if (cur === id) { audio.pause(); cur = null; return; }
  audio.src = '../bgm/wav/' + id + '.wav';
  audio.play();
  cur = id;
  btn.closest('tr').classList.add('playing');
}
function sel() {
  const o = {};
  document.querySelectorAll('input[type=checkbox]:checked').forEach(c => { o[c.dataset.id] = true; });
  return o;
}
function exportSel() {
  const o = sel();
  const lines = Object.keys(o).map(id => {
    const r = DATA.find(x => x.id === id);
    return { id, duration: +r.dur.toFixed(2), rms: r.rms, peak: r.peak, facts: r.facts };
  });
  document.getElementById('out').value = JSON.stringify(lines, null, 2);
}
function copySel() {
  exportSel();
  navigator.clipboard.writeText(document.getElementById('out').value);
}
function clearSel() {
  document.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
  document.getElementById('out').value = '';
  upd();
}
document.addEventListener('change', upd);
function upd() {
  document.getElementById('cnt').textContent = '已选 ' + Object.keys(sel()).length + ' 首';
}
upd();
</script>
</body>
</html>
"""

out = os.path.join(r"D:\QuickLook插件包\moye\docs", "14a-试听-bgm-player.html")
open(out, "w", encoding="utf-8").write(HTML.replace("__DATA__", data_js))
print("-> ", out)

# 同时产出一份 TSV 便于在 Excel 里看
tsv = os.path.join(BGM, "bgm_table.tsv")
with open(tsv, "w", encoding="utf-8") as f:
    f.write("编号\t时长s\t时长\tMB\tRMS\t峰值\t前导s\t尾出s\t循环相关\t循环s\t客观特征\n")
    for n in names:
        d = A[n]
        mb = os.path.getsize(os.path.join(BGM, n + ".ogg")) / 1048576
        f.write(f"{n}\t{d['duration']:.2f}\t{int(d['duration']//60)}:{d['duration']%60:04.1f}\t"
                f"{mb:.2f}\t{d['rms']:.5f}\t{d['peak']:.4f}\t{d['leadInSeconds']:.2f}\t"
                f"{d['tailOutSeconds']:.2f}\t{d['loopCorr']:.3f}\t{d['loopSeconds']:.1f}\t"
                f"{', '.join(facts(n))}\n")
print("-> ", tsv)

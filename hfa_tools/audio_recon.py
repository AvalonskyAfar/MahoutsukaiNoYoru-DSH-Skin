"""音频素材侦察 —— .hw 分布与命名"""
import sys, os, collections, re
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### AUDIO-RECON-START ###")
arch = [Hfa(os.path.join(GAME, n))
        for n in sorted(os.listdir(GAME)) if n.lower().endswith(".hfa")]

rows = []
tot = totb = 0
for a in arch:
    hw = [e for e in a.entries if e.ext == ".hw"]
    if not hw:
        continue
    b = sum(e.length for e in hw)
    tot += len(hw); totb += b
    mx = max(hw, key=lambda e: e.length)
    rows.append((a.filename, len(hw), b / 1048576, mx.name, mx.length / 1048576))

print("=== .hw 在各归档的分布 ===")
for r in sorted(rows, key=lambda x: -x[2]):
    print(f"  {r[0]:<14} {r[1]:>6} 个  {r[2]:>8.1f} MB   最大: {r[3]} ({r[4]:.1f} MB)")
print(f"\n合计 {tot:,} 个 .hw，{totb/1048576:.1f} MB")

names = [e.name for a in arch for e in a.entries if e.ext == ".hw"]
print("\n=== 命名前缀统计 ===")
pref = collections.Counter()
for n in names:
    m = re.match(r"^([A-Za-z_]+?)(?=\d|$)", n)
    pref[m.group(1) if m else "(纯数字)"] += 1
for k, v in pref.most_common(25):
    print(f"  {k:<18} {v:>6}")

print("\n=== 体积最大的 15 个 .hw（疑似 BGM）===")
allhw = sorted(((e.length, a.filename, e.name) for a in arch for e in a.entries if e.ext == ".hw"),
               reverse=True)
for L, af, nm in allhw[:15]:
    print(f"  {L/1048576:>6.2f} MB  {af:<14} {nm}")

print("\n=== 抽样：SSE*/BGM*/bgm* 之类有意义的命名 ===")
for kw in ("SSE", "BGM", "bgm", "Bgm", "ME", "bg", "theme", "Theme", "OP", "ED"):
    hit = [n for n in names if n.startswith(kw)]
    if hit:
        print(f"  {kw:<8} {len(hit):>5} 个  例: {hit[:4]}")
print("### AUDIO-RECON-END ###")

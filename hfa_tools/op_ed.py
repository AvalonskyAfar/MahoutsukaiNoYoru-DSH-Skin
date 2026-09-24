"""定位 OP 影片 与 片尾名单脚本的引用"""
import sys, os, re, glob
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### OP-ED-START ###")
arch = [Hfa(os.path.join(GAME, n))
        for n in sorted(os.listdir(GAME)) if n.lower().endswith(".hfa")]

print("=== .mp4 影片 ===")
for a in arch:
    for e in a.entries:
        if e.ext == ".mp4":
            print(f"  {a.filename:<14} {e.name:<20} {e.length:>12,} B ({e.length/1048576:.1f} MB)")

print("\n=== staffroll.chs 的全部字符串 ===")
p = glob.glob(r"D:\QuickLook插件包\moye\game_scripts\chs\**\staffroll.chs", recursive=True)
if p:
    d = open(p[0], "rb").read()
    print(f"  大小 {len(d):,} 字节")
    ss = list(dict.fromkeys(s.decode("ascii") for s in re.findall(rb"[\x20-\x7e]{3,}", d)))
    for s in ss: print(f"    {s}")
else:
    print("  未找到")

print("\n=== 哪些归档含 mp4（顺便看归档规模）===")
for a in arch:
    exts = {}
    for e in a.entries:
        exts[e.ext] = exts.get(e.ext, 0) + 1
    if ".mp4" in exts or a.filename in ("data02900.hfa", "data04000.hfa"):
        print(f"  {a.filename:<14} {exts}")
print("### OP-ED-END ###")

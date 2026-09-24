"""列出「后期章专用 + 大画布（满屏背景）」的编号，供逐个目视。

一次性把 hfa_png/out 全树扫进内存索引，避免逐 ID 反复 listdir。
"""
import os, re, sys, struct
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import chapters

OUT = r"D:\QuickLook插件包\moye\hfa_png\out"
LATE = ("9_", "a_", "b_", "c_", "d_")
EARLY = ("1_", "1dot5", "2_", "3_", "4_", "5", "6_", "7_", "8")
MINW = int(sys.argv[1]) if len(sys.argv) > 1 else 2500

# 一次扫全树
idx = defaultdict(list)          # id -> [(arch, filesize)]
for d in sorted(os.listdir(OUT)):
    dp = os.path.join(OUT, d)
    if not os.path.isdir(dp):
        continue
    for f in os.listdir(dp):
        m = re.match(r"img0*(\d+)(?![0-9])", f)
        if m:
            idx[int(m.group(1))].append((d, f))


def png_size(arch, fn):
    with open(os.path.join(OUT, arch, fn), "rb") as fh:
        h = fh.read(26)
    return struct.unpack(">II", h[16:24])


ch = chapters()
early = set()
for n, v in ch.items():
    if n.startswith(EARLY):
        early |= v

only = defaultdict(list)
for n, v in ch.items():
    if n.startswith(LATE):
        for i in v:
            if i not in early:
                only[i].append(n)

rows = []
for i in sorted(only):
    for arch, fn in idx.get(i, []):
        w, h = png_size(arch, fn)
        if w >= MINW:
            rows.append((i, w, h, arch, sorted(only[i])))
            break

print(f"后期专用 + 宽>={MINW} 的编号：{len(rows)} 个")
for i, w, h, arch, ns in rows:
    print(f"  img{i:04d}  {w}x{h:<6} {arch}  章={','.join(ns)}")

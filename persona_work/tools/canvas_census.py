# -*- coding: utf-8 -*-
"""canvas_census.py —— 统计各层素材的画布尺寸分布（只看 PNG 头，不读像素）。"""
import collections
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = r"D:\QuickLook插件包\moye\hfa_png\out"


def census(pred, label):
    sizes = collections.Counter()
    n = 0
    for d in sorted(os.listdir(OUT)):
        dd = os.path.join(OUT, d)
        if not os.path.isdir(dd):
            continue
        for f in os.listdir(dd):
            if not f.endswith(".mzp.png"):
                continue
            if pred(d, f):
                n += 1
                with Image.open(os.path.join(dd, f)) as im:
                    sizes[im.size] += 1
    print(f"{label}: {n} 个")
    for s, c in sizes.most_common(8):
        print(f"    {s[0]}x{s[1]}  x{c}")


census(lambda d, f: f.endswith("_b.mzp.png"), "_b 身体层")
census(lambda d, f: d == "data02105", "data02105 合成图")
census(lambda d, f: d == "data02100" and not f.endswith("_b.mzp.png"), "data02100 脸层")
census(lambda d, f: d == "data02020", "data02020 s_ 缩略")

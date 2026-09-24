# -*- coding: utf-8 -*-
"""comp_top_rows.py —— 本家合成图顶部每行的内容分布，看"圆头顶"是从第几行、哪个 x 范围长出来的。"""
import glob
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = r"D:\QuickLook插件包\moye\hfa_png\out"


def profile(path, rows, tag):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    px = a.load()
    print(f"\n== {tag}  ({im.size}) ==")
    for y in range(rows):
        xs = [x for x in range(im.width) if px[x, y] > 8]
        if xs:
            print(f"  y={y:<3} 内容 x={xs[0]}..{xs[-1]}  宽度={xs[-1]-xs[0]+1}  行内最大alpha="
                  f"{max(px[x, y] for x in xs)}")
        else:
            print(f"  y={y:<3} （空行）")


c = sorted(glob.glob(os.path.join(OUT, "data02105", "aok_n_03_02_00_*.mzp.png")))[0]
profile(c, 30, "本家合成图 " + os.path.basename(c))
profile(os.path.join(OUT, "data02100", "aok_n_03_02_00.mzp.png"), 12, "脸层 aok_n_03_02_00")
profile(os.path.join(OUT, "data02100", "aok_n_03_02_00_b.mzp.png"), 12, "身体层 _b（顶部应全空）")

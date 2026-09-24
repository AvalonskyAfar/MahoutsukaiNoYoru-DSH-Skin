# -*- coding: utf-8 -*-
"""frame_heads.py —— 一个通道里各帧的头顶是否完整（内容 bbox 上边是否留白）。"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
D = r"D:\QuickLook插件包\moye\hfa_png\out\data02100"
PREFIX = sys.argv[1] if len(sys.argv) > 1 else "aok_n_03_02_"

print(f"{'文件':<26}{'画布':<13}{'内容bbox':<28}{'上边maxAlpha':<13}说明")
for f in sorted(os.listdir(D)):
    if f.startswith(PREFIX) and f.endswith(".mzp.png") and not f.endswith("_b.mzp.png"):
        im = Image.open(os.path.join(D, f)).convert("RGBA")
        a = im.getchannel("A")
        bb = a.getbbox()
        top = max(a.getpixel((x, 0)) for x in range(im.width))
        note = "头顶有留白" if bb[1] > 6 else "内容贴到上边"
        print(f"{f[:-8]:<26}{str(im.size):<13}{str(bb):<28}{top:<13}{note}")

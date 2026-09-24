# -*- coding: utf-8 -*-
"""
alpha_haze.py —— 量立绘图上有没有"极低透明度的雾"。

有雾的话：`filter:drop-shadow()` 会把整张画布认成轮廓 → 画面上出现**一个方框**
（用户实测："头明显不 ok"，且能看到矩形边界）。

判据：统计 alpha 落在 (0, T] 的像素数，以及它们是否铺满画布四边。
"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"


def probe(path, label, T=32):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    hist = a.histogram()
    n = im.width * im.height
    zero = hist[0]
    haze = sum(hist[1:T + 1])
    solid = sum(hist[200:])
    # 四边 2px 边框上的 alpha 最大值
    edge_max = 0
    w, h = im.size
    px = a.load()
    for x in range(w):
        for y in list(range(0, 2)) + list(range(h - 2, h)):
            edge_max = max(edge_max, px[x, y])
    for y in range(h):
        for x in list(range(0, 2)) + list(range(w - 2, w)):
            edge_max = max(edge_max, px[x, y])
    print(f"{label:<44} {w}x{h}  全透明={zero/n*100:5.1f}%  "
          f"雾(1..{T})={haze/n*100:5.2f}%  实心={solid/n*100:5.1f}%  "
          f"边框最大 alpha={edge_max}")


targets = [
    (r"skin\assets\sprite\stage_a4_neutral_0.png", "烘焙立绘 A4 neutral"),
    (r"hfa_png\out\data02100\aok_n_03_02_00_b.mzp.png", "身体层 aok_n_03_02_00_b"),
    (r"hfa_png\out\data02100\aok_n_03_02_00.mzp.png", "脸层 aok_n_03_02_00"),
    (r"hfa_png\out\data02105\aok_a_03_02_00_02_02.mzp.png", "本家合成图 aok_a_03_02_00_02_02"),
    (r"skin\assets\bg\A4_img0296.mzp.png", "背景 A4"),
]
for rel, label in targets:
    p = os.path.join(ROOT, rel)
    if os.path.isfile(p):
        probe(p, label)
    else:
        print(f"{label}: 文件不存在 {p}")

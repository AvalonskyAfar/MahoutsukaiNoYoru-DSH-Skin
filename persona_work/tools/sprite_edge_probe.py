# -*- coding: utf-8 -*-
"""
sprite_edge_probe.py —— 立绘为什么看起来是个"方框"：量脸的裁切边 + 把实际画面顶边裁出来看。

判据：
  1. 脸层内容 bbox —— 是否顶到自己的画布边界（顶到就说明"美术在那里被裁断"）
  2. 烘焙立绘的四边 alpha —— 哪条边上有实心像素
  3. 把立绘顶部 260 行裁出来存图，直接看头发是不是被切平
"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
TMP = os.path.join(ROOT, "persona_work", "tmp")
OUT = os.path.join(ROOT, "hfa_png", "out")


def edge_alpha(im, tag):
    a = im.getchannel("A")
    px = a.load()
    w, h = im.size
    print(f"  {tag}: 画布 {w}x{h}  内容bbox={a.getbbox()}")
    for name, pts in (
        ("上", [(x, 0) for x in range(w)]),
        ("下", [(x, h - 1) for x in range(w)]),
        ("左", [(0, y) for y in range(h)]),
        ("右", [(w - 1, y) for y in range(h)]),
    ):
        mx = max(px[p] for p in pts)
        n = sum(1 for p in pts if px[p] > 200)
        print(f"     {name}边: 最大alpha={mx:<4} 实心像素={n}")


print("== 脸层（批量 n，A4 用的那张）==")
f = Image.open(os.path.join(OUT, "data02100", "aok_n_03_02_00.mzp.png")).convert("RGBA")
edge_alpha(f, "aok_n_03_02_00")
print("\n== 脸层（批量 a 对照）==")
f2 = Image.open(os.path.join(OUT, "data02100", "aok_a_03_02_00.mzp.png")).convert("RGBA")
edge_alpha(f2, "aok_a_03_02_00")

print("\n== 身体层（批量 n）==")
b = Image.open(os.path.join(OUT, "data02100", "aok_n_03_02_00_b.mzp.png")).convert("RGBA")
edge_alpha(b, "aok_n_03_02_00_b")

print("\n== 我烘焙的立绘 ==")
s = Image.open(os.path.join(ROOT, "skin", "assets", "sprite", "stage_a4_neutral_0.png")).convert("RGBA")
edge_alpha(s, "stage_a4_neutral_0")

print("\n== 本家合成图（批量 n 那张）==")
import glob
cands = glob.glob(os.path.join(OUT, "data02105", "aok_n_03_02_00_*.mzp.png"))
if cands:
    c = Image.open(sorted(cands)[0]).convert("RGBA")
    edge_alpha(c, os.path.basename(sorted(cands)[0]))

# 出图：我的立绘顶部 vs 本家合成图顶部
strip = s.crop((0, 0, s.width, 300)).convert("RGB")
bg = Image.new("RGB", strip.size, (40, 40, 60))
out = Image.blend(bg, strip, 0.0)
out = Image.alpha_composite(bg.convert("RGBA"), s.crop((0, 0, s.width, 300))).convert("RGB")
p1 = os.path.join(TMP, "edge_mine.png")
out.resize((out.width // 2, out.height // 2), Image.LANCZOS).save(p1)
print(f"\n我的立绘顶部 300 行 -> {p1}")
if cands:
    c = Image.open(sorted(cands)[0]).convert("RGBA")
    bb = c.getchannel("A").getbbox()
    crop = c.crop((bb[0], bb[1], bb[2], bb[1] + 600))
    bg2 = Image.new("RGBA", crop.size, (40, 40, 60, 255))
    o2 = Image.alpha_composite(bg2, crop).convert("RGB")
    p2 = os.path.join(TMP, "edge_orig.png")
    o2.resize((max(1, o2.width // 2), max(1, o2.height // 2)), Image.LANCZOS).save(p2)
    print(f"本家合成图顶部 600 行 -> {p2}")

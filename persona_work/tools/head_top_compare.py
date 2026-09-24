# -*- coding: utf-8 -*-
"""
head_top_compare.py —— 三方对齐看头顶：脸层原图 / 我的合成 / 本家合成图。

只在**同一个尺度**下比，避免又看错。
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
TMP = os.path.join(ROOT, "persona_work", "tmp")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def head_crop(im, scale=1.0, pad_top=0):
    bb = mask(im).getbbox()
    x0 = bb[0]
    y0 = max(0, bb[1] - pad_top)
    w = min(im.width - x0, int(900 * scale))
    h = int(240 * scale)
    return im.crop((x0, y0, x0 + w, min(im.height, y0 + h)))


face = Image.open(os.path.join(OUT, "data02100", "aok_n_03_02_00.mzp.png")).convert("RGBA")
mine = Image.open(os.path.join(ROOT, "skin", "assets", "sprite", "stage_a4_neutral_0.png")).convert("RGBA")
cands = sorted(glob.glob(os.path.join(OUT, "data02105", "aok_n_03_02_00_*.mzp.png")))
orig = Image.open(cands[0]).convert("RGBA") if cands else None

items = [("脸层原图 aok_n_03_02_00", face)]
items.append(("我的合成", mine))
if orig is not None:
    items.append((os.path.basename(cands[0]), orig))

H = 200
cells = []
for tag, im in items:
    bb = mask(im).getbbox()
    c = im.crop((bb[0], bb[1], min(im.width, bb[0] + 900), min(im.height, bb[1] + 200)))
    cells.append((tag, c, bb))
W = 900
sheet = Image.new("RGB", (W, (H + 20) * len(cells)), (16, 16, 22))
dr = ImageDraw.Draw(sheet)
for i, (tag, c, bb) in enumerate(cells):
    bg = Image.new("RGBA", c.size, (70, 40, 90, 255))
    o = Image.alpha_composite(bg, c).convert("RGB")
    sheet.paste(o, (0, i * (H + 20) + 18))
    dr.text((4, i * (H + 20) + 4), f"{tag}  内容bbox={bb}", fill=(200, 230, 255))
p = os.path.join(TMP, "head_top_compare.png")
sheet.save(p)
print(f"-> {p} {sheet.size}")

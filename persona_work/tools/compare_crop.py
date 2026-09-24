# -*- coding: utf-8 -*-
"""
compare_crop.py —— 把"紧裁版"和"整画布版"并排放，直观看头顶有没有被削平。

紧裁版 = 现在这张立绘按内容 bbox 裁一刀（= 第一版烘出来的样子）
整画布版 = 现在这张立绘原样
"""
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
TMP = os.path.join(ROOT, "persona_work", "tmp")
SP = os.path.join(ROOT, "skin", "assets", "sprite", "stage_a4_neutral_0.png")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


src = Image.open(SP).convert("RGBA")
bb = mask(src).getbbox()
tight = src.crop(bb)
H = 760
out = []
for im, tag in ((tight, "紧裁版（旧：头顶被画布边缘切平）"), (src, "整画布版（新：留白回来了）")):
    w = max(1, round(im.width * H / im.height))
    r = im.resize((w, H), Image.LANCZOS)
    bg = Image.new("RGBA", r.size, (36, 36, 50, 255))
    out.append((Image.alpha_composite(bg, r).convert("RGB"), tag, r.size))

pad = 16
W = sum(o[0].width for o in out) + pad * 3
sheet = Image.new("RGB", (W, H + 46), (16, 16, 22))
dr = ImageDraw.Draw(sheet)
x = pad
for im, tag, size in out:
    dr.text((x, 8), tag, fill=(210, 230, 255))
    sheet.paste(im, (x, 34))
    # 画布边界用亮线标出来
    dr.rectangle([x, 34, x + im.width - 1, 33 + H], outline=(90, 200, 220))
    x += im.width + pad
p = os.path.join(TMP, "compare_crop.png")
sheet.save(p)
print(f"内容 bbox = {bb}  整画布 = {src.size}  -> {p}  {sheet.size}")

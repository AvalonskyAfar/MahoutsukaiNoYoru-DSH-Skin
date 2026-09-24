# -*- coding: utf-8 -*-
"""
face_offset_test.py —— 脸的贴图点到底该是多少？渲两种贴法，1:1 看头。

脸层 aok_n_03_02_00 的头顶在它自己画布第 1 行就被切断；
身体层 aok_n_03_02_00_b 的头顶在 y=123。
  A：画布原点对齐（我原来的做法）= 脸的断头压在身体头顶上方 122px
  B：**头顶对齐**（dy = 身体内容上边 - 脸内容上边）
"""
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
TMP = os.path.join(ROOT, "persona_work", "tmp")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


body = Image.open(os.path.join(OUT, "data02100", "aok_n_03_02_00_b.mzp.png")).convert("RGBA")
face = Image.open(os.path.join(OUT, "data02100", "aok_n_03_02_00.mzp.png")).convert("RGBA")
bbb = mask(body).getbbox()
fbb = mask(face).getbbox()
print("身体内容 bbox =", bbb)
print("脸内容   bbox =", fbb)

variants = [
    ("A 画布原点对齐（当前）", (0, 0)),
    ("B 头顶对齐 dy=%d" % (bbb[1] - fbb[1]), (0, bbb[1] - fbb[1])),
    ("C 头顶对齐的一半", (0, (bbb[1] - fbb[1]) // 2)),
]

cells = []
for tag, (dx, dy) in variants:
    c = Image.new("RGBA", (body.width + 200, body.height + 200), (0, 0, 0, 0))
    c.alpha_composite(body, (100, 100))
    c.alpha_composite(face, (100 + dx, 100 + dy))
    crop = c.crop((100, 100, 100 + body.width, 100 + 700))
    bg = Image.new("RGBA", crop.size, (70, 40, 90, 255))
    cells.append((tag, Image.alpha_composite(bg, crop).convert("RGB")))

H = cells[0][1].height
sheet = Image.new("RGB", (1262, (H + 22) * len(cells)), (16, 16, 22))
dr = ImageDraw.Draw(sheet)
for i, (tag, im) in enumerate(cells):
    dr.text((6, i * (H + 22) + 4), tag, fill=(200, 230, 255))
    sheet.paste(im, (0, i * (H + 22) + 18))
p = os.path.join(TMP, "face_offset_test.png")
sheet.save(p)
print("->", p, sheet.size)

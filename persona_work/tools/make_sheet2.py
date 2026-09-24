#!/usr/bin/env python3
"""Build a supplementary sheet for pose families the first pass never saw.

Usage: python make_sheet2.py <out.jpg> <char> <outfit> <i3,i3,...>
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
CW, CH = 300, 440


def all_pngs():
    out = []
    for dp, _d, fs in os.walk(ROOT):
        for f in fs:
            if f.endswith(".mzp.png") and not f.endswith("_b.mzp.png"):
                out.append(os.path.join(dp, f))
    return out


def main():
    out, ch, of = sys.argv[1], sys.argv[2], sys.argv[3]
    wanted = [int(x) for x in sys.argv[4].split(",")]
    idx = {}
    for p in all_pngs():
        parts = os.path.basename(p)[: -len(".mzp.png")].split("_")
        if len(parts) != 5 or parts[0] != ch or parts[1] != of:
            continue
        i3, i4 = int(parts[2]), int(parts[3])
        if i3 in wanted:
            idx.setdefault(i3, {}).setdefault(i4, p)
    rows = [i3 for i3 in wanted if i3 in idx]
    cols = sorted({c for m in idx.values() for c in m})[:6]
    if not rows or not cols:
        print("nothing to draw")
        return
    canvas = Image.new("RGB", (CW * len(cols), CH * len(rows)), (250, 250, 252))
    dr = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 15)
    for ri, i3 in enumerate(rows):
        for ci, i4 in enumerate(cols):
            x0, y0 = ci * CW, ri * CH
            dr.rectangle([x0 + 1, y0 + 1, x0 + CW - 2, y0 + CH - 2], outline=(255, 180, 180))
            dr.text((x0 + 4, y0 + 4), "i3=%02d i4=%02d" % (i3, i4), fill=(200, 0, 0), font=f)
            p = idx[i3].get(i4)
            if not p:
                continue
            im = Image.open(p).convert("RGBA")
            sc = min((CW - 8) / im.width, (CH - 28) / im.height)
            w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
            im = im.resize((w, h), Image.LANCZOS)
            bg = Image.new("RGB", (w, h), (250, 250, 252))
            bg.paste(im, (0, 0), im)
            canvas.paste(bg, (x0 + (CW - w) // 2, y0 + CH - h))
    canvas.save(out, quality=88)
    print("saved", out, canvas.size, "rows", rows, "cols", cols)


if __name__ == "__main__":
    main()

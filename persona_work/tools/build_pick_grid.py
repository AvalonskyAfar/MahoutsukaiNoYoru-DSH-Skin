#!/usr/bin/env python3
"""Build a verification grid for a specific list of sprite filenames.

Usage: python build_pick_grid.py out.jpg <name1> <name2> ...
Prints the column order so the labels can be read back.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
CW, CH = 300, 440


def find(stem):
    for dirpath, _d, files in os.walk(ROOT):
        for fn in files:
            if fn == stem + ".mzp.png":
                return os.path.join(dirpath, fn)
    return None


def font(sz):
    return ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", sz)


def main():
    out = sys.argv[1]
    names = sys.argv[2:]
    cols = min(6, len(names))
    rows = (len(names) + cols - 1) // cols
    canvas = Image.new("RGB", (CW * cols, CH * rows), (250, 250, 252))
    dr = ImageDraw.Draw(canvas)
    f = font(15)
    for i, nm in enumerate(names):
        r, c = divmod(i, cols)
        x0, y0 = c * CW, r * CH
        p = find(nm)
        dr.rectangle([x0 + 1, y0 + 1, x0 + CW - 2, y0 + CH - 2], outline=(255, 180, 180))
        dr.text((x0 + 4, y0 + 4), nm, fill=(200, 0, 0), font=f)
        if not p:
            dr.text((x0 + 4, y0 + 30), "MISSING", fill=(0, 0, 0), font=f)
            continue
        im = Image.open(p).convert("RGBA")
        sc = min((CW - 8) / im.width, (CH - 28) / im.height)
        w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        im = im.resize((w, h), Image.LANCZOS)
        bg = Image.new("RGB", (w, h), (250, 250, 252))
        bg.paste(im, (0, 0), im)
        canvas.paste(bg, (x0 + (CW - w) // 2, y0 + CH - h))
    canvas.save(out, quality=88)
    print("saved", out, canvas.size)
    for i, nm in enumerate(names):
        r, c = divmod(i, cols)
        print("row%d col%d = %s" % (r + 1, c + 1, nm))


if __name__ == "__main__":
    main()

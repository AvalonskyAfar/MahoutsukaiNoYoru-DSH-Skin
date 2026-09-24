#!/usr/bin/env python3
"""Build a contact sheet for the REAL Kojika (koj) sprite set.

Usage: python make_koj_sheets.py
Writes persona_work/catalog/koj_sheet_<outfit>.jpg
Rows = i3 pose families, cols = the i4 values present for that outfit.
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\catalog"
CW, CH = 320, 470


def collect(ch="koj"):
    d = {}
    for dp, _dd, fs in os.walk(ROOT):
        for f in fs:
            if not f.endswith(".mzp.png") or f.endswith("_b.mzp.png"):
                continue
            p = f[: -len(".mzp.png")].split("_")
            if len(p) != 5 or p[0] != ch:
                continue
            d.setdefault(p[1], {}).setdefault(int(p[2]), {}).setdefault(int(p[3]), []).append(
                os.path.join(dp, f))
    return d


def main():
    d = collect()
    f_big = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 17)
    f_sm = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 14)
    for of in sorted(d):
        rows = sorted(d[of])
        cols = sorted({c for m in d[of].values() for c in m})
        canvas = Image.new("RGB", (CW * max(len(cols), 1), CH * len(rows)), (250, 250, 252))
        dr = ImageDraw.Draw(canvas)
        for ri, i3 in enumerate(rows):
            for ci, i4 in enumerate(cols):
                x0, y0 = ci * CW, ri * CH
                dr.rectangle([x0 + 1, y0 + 1, x0 + CW - 2, y0 + CH - 2], outline=(230, 150, 150))
                dr.text((x0 + 5, y0 + 5), "i3=%02d i4=%02d" % (i3, i4), fill=(190, 0, 0), font=f_sm)
                files = d[of].get(i3, {}).get(i4)
                if not files:
                    continue
                p = sorted(files)[0]
                im = Image.open(p).convert("RGBA")
                sc = min((CW - 10) / im.width, (CH - 30) / im.height)
                w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
                im = im.resize((w, h), Image.LANCZOS)
                bg = Image.new("RGB", (w, h), (250, 250, 252))
                bg.paste(im, (0, 0), im)
                canvas.paste(bg, (x0 + (CW - w) // 2, y0 + CH - h))
                dr.text((x0 + 5, y0 + CH - 20), "x%d" % len(files), fill=(90, 90, 90), font=f_sm)
        dr.text((6, 6), "koj_%s" % of, fill=(190, 0, 0), font=f_big)
        p = os.path.join(OUT, "koj_sheet_%s.jpg" % of)
        canvas.save(p, quality=88)
        print("saved", p, canvas.size, "rows", rows, "cols", cols)


if __name__ == "__main__":
    main()

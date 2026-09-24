#!/usr/bin/env python3
"""Step 1 (part): build labeled contact sheets of character face variations.

Sheet layout: rows = pose/body index (i3), columns = expression index (i4).
Only "simple" sprites (exactly 4 underscore fields, no assembled _a_b_c tail,
no _b variant) are used, so each cell is one standalone face cut.
"""
import os, re, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\catalog\sheets"
os.makedirs(OUT, exist_ok=True)

CELL_W, CELL_H = 300, 440
MAX_COLS = 6

CHARS = ["aok", "ari", "kin"]
OUTFITS = ["n", "a", "l", "m", "s"]
OUTC = {"n": "uniform", "a": "casual_a", "l": "casual_l", "m": "casual_m", "s": "suit"}


def font(sz):
    for p in (r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


_ALL = None


def all_pngs():
    global _ALL
    if _ALL is None:
        _ALL = []
        for dirpath, _dirs, files in os.walk(ROOT):
            for fn in files:
                if fn.endswith(".mzp.png"):
                    _ALL.append(os.path.join(dirpath, fn))
    return _ALL


def collect(ch, of):
    """{i3: {i4: path}} for standalone face-cut sprites only.

    Real name shape is  <ch>_<outfit>_<i3>_<i4>_<variant>  (5 fields, e.g.
    aok_n_02_02_00).  Assembled composites carry a trailing _ee_mm pair and are
    skipped; the _b alternate layer is skipped too.
    """
    d = {}
    for f in all_pngs():
        n = os.path.basename(f)[: -len(".mzp.png")]
        if n.endswith("_b"):
            continue
        parts = n.split("_")
        if len(parts) != 5:
            continue
        if parts[0] != ch or parts[1] != of:
            continue
        if not (parts[2].isdigit() and parts[3].isdigit() and parts[4].isdigit()):
            continue
        d.setdefault(int(parts[2]), {})[int(parts[3])] = f
    return d


def build(ch, of):
    d = collect(ch, of)
    if not d:
        return None, 0
    rows = sorted(d)
    cols = sorted({c for m in d.values() for c in m})
    # cap: 5 rows x 6 cols per sheet
    rows_used = rows[:5]
    cols_used = cols[:MAX_COLS]
    W, H = CELL_W * max(len(cols_used), 1), CELL_H * max(len(rows_used), 1)
    canvas = Image.new("RGB", (W, H), (246, 246, 250))
    dr = ImageDraw.Draw(canvas)
    f_small, f_big = font(13), font(17)
    for ri, i3 in enumerate(rows_used):
        for ci, i4 in enumerate(cols_used):
            p = d[i3].get(i4)
            x0, y0 = ci * CELL_W, ri * CELL_H
            dr.text((x0 + 4, y0 + 4), f"i3={i3:02d} i4={i4:02d}", fill=(0, 0, 0), font=f_small)
            if not p:
                dr.rectangle([x0 + 2, y0 + 2, x0 + CELL_W - 4, y0 + CELL_H - 4], outline=(220, 200, 200))
                continue
            im = Image.open(p).convert("RGBA")
            sc = min((CELL_W - 8) / im.width, (CELL_H - 26) / im.height)
            w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
            im = im.resize((w, h), Image.LANCZOS)
            bg = Image.new("RGB", (w, h), (246, 246, 250))
            bg.paste(im, (0, 0), im)
            canvas.paste(bg, (x0 + (CELL_W - w) // 2, y0 + CELL_H - h))
    dr.text((6, 6), f"{ch}_{of}", fill=(200, 0, 0), font=f_big)
    name = f"{ch}_{OUTC[of]}.jpg"
    canvas.save(os.path.join(OUT, name), quality=85)
    return name, len(rows) * len(cols)


if __name__ == "__main__":
    for ch in CHARS:
        for of in OUTFITS:
            n, c = build(ch, of)
            print(f"{ch}\t{of}\t{n}\tcells={c}")

"""跨通道同帧号一致性检测。

若「帧号 v」是语义表情号，那么同一 v 在不同姿态通道 i4 里应当是**同一张脸**
（姿态可能不同，但面部一致）。本工具量化这一点：
  - 对 (i4, v) 的图，取 alpha bbox 后缩放到统一高度，比较两两差异
  - 输出：每个 v 的「通道间两两差异」中位数；越小越说明 v 是语义表情号
  - 附带：每个 v 在所有通道里的代表图拼成一行，便于肉眼确认

用法: python frame_consistency.py aok 12
"""
import os, re, sys, statistics
from collections import defaultdict
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")
FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        FONT = ImageFont.truetype(_p, 18)
        break


def load(p, h=200):
    im = Image.open(p).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)
    w = max(1, int(im.width * h / im.height))
    im = im.resize((w, h), Image.LANCZOS)
    bg = Image.new("RGB", im.size, (18, 18, 22))
    bg.paste(im, (0, 0), im)
    return bg


def diff(a, b):
    w = min(a.width, b.width)
    h = min(a.height, b.height)
    a2, b2 = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
    d = ImageChops.difference(a2, b2)
    px = list(d.getdata())
    return sum(sum(p) for p in px) / (len(px) * 3) / 255


def main():
    who, i3 = sys.argv[1], sys.argv[2]
    d = defaultdict(dict)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if m and m.group(1) == who and m.group(3) == i3 and not m.group(6):
                d[m.group(5)].setdefault(m.group(4), (m.group(2), os.path.join(dp, f)))
    rows = []
    for v in sorted(d):
        cache = {e: load(p) for e, (b, p) in d[v].items()}
        es = sorted(cache)
        ds = [diff(cache[a], cache[b]) for i, a in enumerate(es) for b in es[i + 1:]]
        med = statistics.median(ds) if ds else float("nan")
        rows.append((v, len(es), med, cache))
        print(f"  v{v}: {len(es)} 通道  通道间差异中位数 {med:.3f}")
    # 行图：每个 v 一行，通道并排
    cell = 200
    width = max(len(r[3]) for r in rows)
    W = 150 + width * cell
    H = 40 + len(rows) * (cell + 26)
    sheet = Image.new("RGB", (W, H), (236, 236, 241))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 8), f"{who} i3={i3} 帧号行图（每行一个帧号，列=通道）", fill=(150, 0, 0), font=FONT)
    for r, (v, n, med, cache) in enumerate(rows):
        y = 40 + r * (cell + 26)
        dr.rectangle([0, y, W, y + 24], fill=(210, 210, 222))
        dr.text((8, y + 2), f"v{v}  ({n}通道, 差异{med:.2f})", fill=(20, 20, 90), font=FONT)
        for c, e in enumerate(sorted(cache)):
            im = cache[e]
            sheet.paste(im, (150 + c * cell + (cell - im.width) // 2, y + 26))
            dr.text((150 + c * cell + 3, y + 26), f"e{e}", fill=(255, 220, 80), font=FONT)
    out = os.path.join(OUTDIR, f"fcons_{who}_{i3}.jpg")
    sheet.save(out, quality=90)
    print(out, sheet.size)
    for i in range(0, len(rows), 5):
        c = sheet.crop((0, 40 + i * (cell + 26), W, min(H, 40 + (i + 5) * (cell + 26))))
        o = os.path.join(OUTDIR, f"fcons_{who}_{i3}_{i // 5 + 1}.jpg")
        c.save(o, quality=90)
        print("  ", o, c.size)


if __name__ == "__main__":
    main()

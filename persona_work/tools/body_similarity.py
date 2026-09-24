# -*- coding: utf-8 -*-
"""
body_similarity.py —— 同批次内不同通道的身体层是不是同一个姿势？

如果近似相同 -> 表情列表可以跨通道取脸（身体不变，不会跳位）
如果差很多   -> 必须锁定一个通道，否则切表情会连着身体一起换

判据：把两张 `_b` 对齐后用 alpha 交并比 + 交集内 RGB 平均绝对差。
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
PAIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150",
         "sou": "data02180"}


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m):
    return m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0


def cmp_pair(pa, pb, label):
    a = Image.open(pa).convert("RGBA")
    b = Image.open(pb).convert("RGBA")
    best = None
    # 小画布上做平移对齐搜索
    S = 2
    as_ = a.resize((max(1, a.width // S), max(1, a.height // S)), Image.BOX)
    bs_ = b.resize((max(1, b.width // S), max(1, b.height // S)), Image.BOX)
    ma, mb = mask(as_), mask(bs_)
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            c = Image.new("L", mb.size, 0)
            c.paste(ma, (dx, dy))
            u = frac(ImageChops.lighter(c, mb))
            v = (frac(c) + frac(mb) - u) / u if u else 0
            if best is None or v > best[0]:
                best = (v, dx * S, dy * S)
    iou, dx, dy = best
    # 全分辨率 RGB 差
    aa = a.resize((a.width, a.height))
    canvas = Image.new("RGBA", b.size, (0, 0, 0, 0))
    canvas.alpha_composite(a, (dx, dy))
    inter = ImageChops.multiply(mask(b), mask(canvas))
    d = ImageChops.difference(b.convert("RGB"), canvas.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, inter)
    mi = frac(inter)
    mad = (d.resize((1, 1), Image.BOX).getpixel((0, 0)) / mi) if mi else 999
    print(f"{label:<40} 画布 {a.size} vs {b.size}  对齐={dx},{dy}  "
          f"alphaIoU={iou:.4f}  RGB-MAD={mad:7.2f}")
    return iou, mad


def group(ch, batch, i3):
    d = os.path.join(OUT, PAIRS[ch], "")
    hits = []
    for f in sorted(os.listdir(d)):
        if f.startswith(f"{ch}_{batch}_{i3}_") and f.endswith("_b.mzp.png"):
            hits.append(os.path.join(d, f))
    return hits


def main():
    for ch, batch, i3 in [("aok", "a", "03"), ("aok", "a", "12"),
                          ("aok", "l", "03"), ("ari", "a", "01"),
                          ("koj", "a", "00")]:
        files = group(ch, batch, i3)
        print(f"\n=== {ch} batch={batch} i3={i3}  共 {len(files)} 个身体层 ===")
        if len(files) < 2:
            continue
        base = files[0]
        for f in files[1:]:
            cmp_pair(base, f, f"{os.path.basename(base)[:-8]} vs {os.path.basename(f)[:-8]}")


if __name__ == "__main__":
    main()

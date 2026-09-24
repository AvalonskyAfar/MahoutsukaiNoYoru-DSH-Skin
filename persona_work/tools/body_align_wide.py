# -*- coding: utf-8 -*-
"""
body_align_wide.py —— 同批次不同通道的身体层，到底是"同一个姿势被裁成不同画布"，
还是"真的不同姿势"？

上一版只搜 ±16px，而画布宽度差可达 504px —— 那个结论无效。
本版：在 1/4 分辨率上做**全范围**平移搜索，取 alpha 交并比峰值 + 交集内 RGB 差。
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m):
    return m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0


def align(a, b, S=4):
    """把 a 放进 b 的画布里，全范围搜索最佳平移。"""
    as_ = a.resize((max(1, a.width // S), max(1, a.height // S)), Image.BOX)
    bs_ = b.resize((max(1, b.width // S), max(1, b.height // S)), Image.BOX)
    ma, mb = mask(as_), mask(bs_)
    fb = frac(mb)
    best = None
    W = bs_.width - ma.width
    H = bs_.height - ma.height
    for dy in range(0, max(0, H) + 1):
        for dx in range(0, max(0, W) + 1):
            c = Image.new("L", mb.size, 0)
            c.paste(ma, (dx, dy))
            u = frac(ImageChops.lighter(c, mb))
            v = (frac(c) + fb - u) / u if u else 0
            if best is None or v > best[0]:
                best = (v, dx * S, dy * S)
    return best


def report(ch, i3, batch="a"):
    d = os.path.join(OUT, DIRS[ch])
    files = sorted(f for f in os.listdir(d)
                   if f.startswith(f"{ch}_{batch}_{i3}_") and f.endswith("_b.mzp.png"))
    if len(files) < 2:
        print(f"-- {ch} {batch} i3={i3}: 只有 {len(files)} 个身体层")
        return
    print(f"\n=== {ch} {batch} i3={i3}：以 {files[0][:-8]} 为基准，全范围对齐 ===")
    base = Image.open(os.path.join(d, files[0])).convert("RGBA")
    bm = mask(base)
    bbb = bm.getbbox()
    print(f"    基准画布 {base.size} 内容bbox={bbb} 内容尺寸="
          f"{bbb[2]-bbb[0]}x{bbb[3]-bbb[1]}")
    for f in files[1:]:
        other = Image.open(os.path.join(d, f)).convert("RGBA")
        oi = mask(other).getbbox()
        iou, dx, dy = align(other, base)
        # 用内容 bbox 对齐做对照
        cdx, cdy = bbb[0] - oi[0], bbb[1] - oi[1]
        print(f"    {f[:-8]:<22} 画布{other.size} 内容{oi[2]-oi[0]}x{oi[3]-oi[1]}  "
              f"全搜最佳IoU={iou:.4f}@{dx},{dy}   内容bbox对齐=({cdx},{cdy})")


if __name__ == "__main__":
    for ch, i3 in [("aok", "03"), ("aok", "12"), ("ari", "01")]:
        for batch in ("a", "l", "n"):
            report(ch, i3, batch)

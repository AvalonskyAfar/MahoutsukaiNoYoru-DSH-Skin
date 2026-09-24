# -*- coding: utf-8 -*-
"""
probe_face_hole.py —— 量身体层(_b)上那个"脸洞"的精确位置与尺寸。

思路：`_b` 的脸是一块**内部透明**区域。用洪水填充从四角灌满"外部透明"，
      剩下的透明像素就是**内部洞**（脸洞 + 两腿之间的缝隙）。
      -> 得到洞的 bbox；再用它和脸层内容 bbox 比，直接得出脸的缩放比与贴图点。
      这条路径**绕开**了"身体层贴进合成图的偏移"这个难点。

用法:
  python persona_work/tools/probe_face_hole.py aok_a_03_02_00 ari_a_01_02_00 koj_a_00_01_00
"""
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "hfa_png", "out")


def find(name):
    for d in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, d, name)
        if os.path.isfile(p):
            return p
    return None


def hole_bbox(mask_img):
    """mask_img: mode L, 255=不透明。返回 (洞bbox列表, 合并bbox)"""
    m = mask_img.copy()
    d = ImageDraw.Draw(m)
    w, h = m.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                 (0, h // 2), (w - 1, h // 2)]:
        if m.getpixel(seed) == 0:
            ImageDraw.floodfill(m, seed, 128, thresh=8)
    # 剩下的 0 = 内部洞；按连通块切出来（用 8x8 栅格简易聚类）
    inv = m.point(lambda v: 255 if v == 0 else 0)
    blobs = {}
    px = inv.load()
    for y in range(h):
        for x in range(w):
            if px[x, y]:
                key = (x // 64, y // 64)
                b = blobs.get(key)
                if b is None:
                    blobs[key] = [x, y, x, y]
                else:
                    b[0] = min(b[0], x)
                    b[1] = min(b[1], y)
                    b[2] = max(b[2], x)
                    b[3] = max(b[3], y)
    return sorted(blobs.values(), key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))


def report(base):
    bp = find(base + "_b.mzp.png")
    fp = find(base + ".mzp.png")
    if not (bp and fp):
        print(f"== {base} == 缺文件 body={bp} face={fp}")
        return
    body = Image.open(bp).convert("RGBA")
    face = Image.open(fp).convert("RGBA")
    bm = body.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    fm = face.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    print(f"== {base} ==")
    print(f"  身体层 {body.size} 内容bbox={bm.getbbox()}")
    print(f"  脸层   {face.size} 内容bbox={fm.getbbox()}")
    blobs = hole_bbox(bm)
    if not blobs:
        print("  没找到内部洞")
        return
    print(f"  内部洞（按面积降序，取前 3）:")
    for b in blobs[:3]:
        print(f"    bbox={tuple(b)}  尺寸 {b[2]-b[0]}x{b[3]-b[1]}")
    hb = blobs[0]
    fbb = fm.getbbox()
    fw, fh = fbb[2] - fbb[0], fbb[3] - fbb[1]
    hw, hh = hb[2] - hb[0], hb[3] - hb[1]
    print(f"  脸洞 {hw}x{hh}   脸层内容 {fw}x{fh}")
    print(f"  -> 缩放比: x {hw/fw:.4f}   y {hh/fh:.4f}")
    kx, ky = hw / fw, hh / fh
    print(f"  -> 若脸 1:1 贴，则贴图点 = ({hb[0]-fbb[0]}, {hb[1]-fbb[1]})")
    print(f"     若脸按 {kx:.3f}x 缩放，则贴图点 = "
          f"({hb[0]-round(fbb[0]*kx)}, {hb[1]-round(fbb[1]*ky)})")


if __name__ == "__main__":
    for b in (sys.argv[1:] or ["aok_a_03_02_00"]):
        report(b)
        print()

# -*- coding: utf-8 -*-
"""
compare_hypotheses.py —— 用**整图评分**裁决"脸的贴图点"到底是多少。

做法：在 1/3 分辨率上把候选 (身体偏移, 脸偏移) 全扫一遍排名，再把前几名拿到
全分辨率复核。评分 = alpha 交并比（越大越好）+ 交集内 RGB 平均绝对差（越小越好）。

用法:
  python persona_work/tools/compare_hypotheses.py aok_a_03_02_00
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
PAIRS = {
    "aok": ("data02100", "data02105"), "ari": ("data02110", "data02115"),
    "koj": ("data02150", "data02155"), "sou": ("data02180", "data02185"),
}
S = 3  # 评估用降采样倍率


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m):
    return m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0


def evaluate(comp, body, face, b_off, f_off):
    canvas = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    canvas.alpha_composite(body, b_off)
    canvas.alpha_composite(face, f_off)
    cm, nm = mask(comp), mask(canvas)
    inter = ImageChops.multiply(cm, nm)
    union = ImageChops.lighter(cm, nm)
    u = frac(union)
    iou = frac(inter) / u if u else 0
    d = ImageChops.difference(comp.convert("RGB"), canvas.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, inter)
    mi = frac(inter)
    mad = (d.resize((1, 1), Image.BOX).getpixel((0, 0)) / mi) if mi else 999
    return iou, mad


def shrink(im):
    return im.resize((max(1, im.width // S), max(1, im.height // S)), Image.BOX)


def run(base):
    parts_dir, comp_dir = PAIRS[base.split("_")[0]]
    body = Image.open(os.path.join(OUT, parts_dir, base + "_b.mzp.png")).convert("RGBA")
    face = Image.open(os.path.join(OUT, parts_dir, base + ".mzp.png")).convert("RGBA")
    cdir = os.path.join(OUT, comp_dir)
    cands = sorted(f for f in os.listdir(cdir) if f.startswith(base + "_"))
    comp = Image.open(os.path.join(cdir, cands[0])).convert("RGBA")
    print(f"== {base} == comp={cands[0]}  body={body.size} face={face.size}")

    cs, bs, fs = shrink(comp), shrink(body), shrink(face)
    rows = []
    for bx in range(0, 20):
        for by in range(0, 20):
            bos = (bx, by)
            for rx in range(-2, 10):
                for ry in range(-2, 10):
                    fo = ((bos[0] + rx) // 1, (bos[1] + ry) // 1)
                    iou, mad = evaluate(cs, bs, fs,
                                        (bos[0] // 1, bos[1] // 1),
                                        (fo[0] // 1, fo[1] // 1))
                    rows.append((iou, mad, bos, (rx, ry)))
    rows.sort(key=lambda r: (-r[0], r[1]))
    print(f"  1/{S} 扫描前 6 名（身体偏移为降采样坐标，×{S} 得原图坐标）")
    for iou, mad, bo, rel in rows[:6]:
        print(f"    IoU={iou:.5f} MAD={mad:.2f}  身体={bo} 相对脸={rel}")
    print("  全分辨率复核:")
    seen = set()
    out = []
    for iou, mad, bo, rel in rows[:40]:
        key = (bo[0] * S, bo[1] * S, rel[0] * S, rel[1] * S)
        if key in seen:
            continue
        seen.add(key)
        if len(seen) > 6:
            break
        bof = (bo[0] * S, bo[1] * S)
        fof = (bof[0] + rel[0] * S, bof[1] + rel[1] * S)
        i2, m2 = evaluate(comp, body, face, bof, fof)
        out.append((i2, m2, bof, (rel[0] * S, rel[1] * S)))
    out.sort(key=lambda r: (-r[0], r[1]))
    for i2, m2, bof, rel in out:
        print(f"    IoU={i2:.5f} MAD={m2:.2f}  身体={bof} 脸相对身体={rel}")


if __name__ == "__main__":
    for b in (sys.argv[1:] or ["aok_a_03_02_00"]):
        run(b)
        print()

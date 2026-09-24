# -*- coding: utf-8 -*-
"""
pick_rel.py —— 交叉验证：用**有本家合成图**的样本，反推"脸相对身体的贴图点"。

对每个样本：
  1. 在 1/2 分辨率上扫身体偏移（用下半身，脸够不到），不做事后 1:1 微调（上次就是它跑飞了）
  2. 身体偏移定了以后，扫 rel（脸画布原点相对身体画布原点），评分 = 整图 alpha IoU + RGB MAD
  3. 汇总所有样本的最优 rel -> 得出一条通用规则

用法:
  python persona_work/tools/pick_rel.py            # 跑全部有合成图的随包立绘
"""
import json
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
S = 2


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m):
    return m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0


def iou_only(comp, body, b_off, region):
    canvas = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    canvas.alpha_composite(body, b_off)
    a = mask(comp).crop(region)
    b = mask(canvas).crop(region)
    u = frac(ImageChops.lighter(a, b))
    return (frac(a) + frac(b) - u) / u if u else 0


def full_score(comp, body, face, b_off, f_off):
    canvas = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    canvas.alpha_composite(body, b_off)
    canvas.alpha_composite(face, f_off)
    cm, nm = mask(comp), mask(canvas)
    inter = ImageChops.multiply(cm, nm)
    u = frac(ImageChops.lighter(cm, nm))
    iou = frac(inter) / u if u else 0
    d = ImageChops.difference(comp.convert("RGB"), canvas.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, inter)
    mi = frac(inter)
    return iou, ((d.resize((1, 1), Image.BOX).getpixel((0, 0)) / mi) if mi else 999)


def solve_one(base, rels):
    parts_dir, comp_dir = PAIRS[base.split("_")[0]]
    body_p = os.path.join(OUT, parts_dir, base + "_b.mzp.png")
    face_p = os.path.join(OUT, parts_dir, base + ".mzp.png")
    cdir = os.path.join(OUT, comp_dir)
    cands = sorted(f for f in os.listdir(cdir) if f.startswith(base + "_"))
    if not (os.path.isfile(body_p) and os.path.isfile(face_p) and cands):
        return None
    body = Image.open(body_p).convert("RGBA")
    face = Image.open(face_p).convert("RGBA")
    comp = Image.open(os.path.join(cdir, cands[0])).convert("RGBA")

    # ---- 1) 身体偏移：只在"最下那条带"上比，脸够不到脚 ----
    BAND = 600
    if body.height < BAND or comp.height < BAND:
        BAND = min(body.height, comp.height) // 2
    band = mask(body.crop((0, body.height - BAND, body.width, body.height)))
    cmask = mask(comp)
    max_x = comp.width - body.width
    max_y = comp.height - body.height
    best_b = None
    for by in range(0, max(0, max_y) + 1):
        for bx in range(0, max(0, max_x) + 1):
            reg = cmask.crop((bx, by + body.height - BAND, bx + body.width,
                              by + body.height))
            u = frac(ImageChops.lighter(reg, band))
            v = (frac(reg) + frac(band) - u) / u if u else 0
            if best_b is None or v > best_b[0]:
                best_b = (v, bx, by)
    if not best_b:
        return None
    b_off = (best_b[1], best_b[2])
    # ---- 2) 扫 rel（在 1/2 分辨率上）----
    cs = comp.resize((comp.width // S, comp.height // S), Image.BOX)
    bs = body.resize((body.width // S, body.height // S), Image.BOX)
    fs = face.resize((face.width // S, face.height // S), Image.BOX)
    res = []
    for rx in rels:
        for ry in rels:
            f_off = (b_off[0] // S + rx, b_off[1] // S + ry)
            if f_off[0] < 0 or f_off[1] < 0:
                continue
            iou, mad = full_score(cs, bs, fs, (b_off[0] // S, b_off[1] // S), f_off)
            res.append((iou, mad, (rx, ry)))
    res.sort(key=lambda r: (-r[0], r[1]))
    return dict(base=base, body_off=b_off, body_iou=best_b[0], best=res[0],
                runner=res[1] if len(res) > 1 else None)


def main():
    mani = json.load(open(os.path.join(ROOT, "skin", "data", "manifest.json"),
                          encoding="utf-8"))
    sprites = sorted({os.path.basename(u) for sc in mani["expressions"].values()
                      for lst in sc.get("slots", {}).values() for u in lst})
    bases = [s[:-len(".mzp.png")] for s in sprites]
    rels = list(range(-4, 13, 2))
    print(f"待验样本 {len(bases)} 个随包立绘；rel 候选 {rels}\n")
    out = []
    for b in bases:
        r = solve_one(b, rels)
        if not r:
            continue
        iou, mad, rel = r["best"]
        out.append((b, rel, iou, mad, r["body_off"], r["body_iou"]))
        print(f"{b:<26} best rel={str(rel):<10} IoU={iou:.5f} MAD={mad:6.2f}  "
              f"body_off={r['body_off']} bodyIoU={r['body_iou']:.4f}")
    print(f"\n共 {len(out)} 个样本。rel 分布：")
    from collections import Counter
    c = Counter(o[1] for o in out)
    for k, v in c.most_common():
        print(f"   rel={k}: {v} 个")
    if out:
        avg = tuple(round(sum(o[1][i] for o in out) / len(out)) for i in (0, 1))
        print(f"\n平均最优 rel = {avg}")
        print(f"平均 IoU（取各自最优 rel）= {sum(o[2] for o in out)/len(out):.5f}")


if __name__ == "__main__":
    main()

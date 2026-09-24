#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
derive_layer_transform.py —— 解出「身体层 + 脸层 -> 合成图」的精确变换，并**重建验证**。

判据链（全部用 PIL 的 C 级位运算，快且不含主观判断）：
  1. 身体层偏移：只在**下半身**条带里比 alpha 交并比（脸够不到腿，条带是纯身体）
  2. 脸层占位：残差 alpha = 合成 alpha - 位移后身体 alpha -> bbox
  3. 脸层缩放 k 与偏移：由残差 bbox 与脸层内容 bbox 反推，再**网格细搜**
  4. 重建验证：body + face*k 重画一张，与真合成图比 alpha IoU 与 RGB 平均绝对差
     必须 IoU >= 0.99 才认；不认就明说，不硬凑。

用法:
  python persona_work/tools/derive_layer_transform.py aok_a_03_02_00
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "hfa_png", "out")


def find(name):
    for d in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, d, name)
        if os.path.isfile(p):
            return p
    return None


def comp_candidates(base):
    hits = []
    for d in sorted(os.listdir(OUT)):
        dd = os.path.join(OUT, d)
        if os.path.isdir(dd):
            for f in os.listdir(dd):
                if f.startswith(base + "_") and not f.endswith("_b.mzp.png"):
                    hits.append(os.path.join(dd, f))
    return sorted(hits)


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m):
    w, h = m.size
    f = m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0
    return f


def iou(m1, m2, box=None):
    a, b = m1, m2
    if box:
        a = a.crop(box)
        b = b.crop(box)
    ai, bi = frac(a), frac(b)
    u = frac(ImageChops.lighter(a, b))
    return (frac(a, ) if False else (ai + bi - u)) / u if u else 0.0


def paste(size, items):
    c = Image.new("RGBA", size, (0, 0, 0, 0))
    for im, x, y in items:
        c.alpha_composite(im, (x, y))
    return c


def score(comp, items):
    """alpha IoU + 交集内 RGB 平均绝对差"""
    canvas = paste(comp.size, items)
    ma, mb = mask(comp), mask(canvas)
    inter = ImageChops.multiply(ma, mb)
    union = ImageChops.lighter(ma, mb)
    mi, mu = frac(inter), frac(union)
    if mu == 0:
        return 0.0, 999.0
    d = ImageChops.difference(comp.convert("RGB"), canvas.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, inter)
    mean_all = d.resize((1, 1), Image.BOX).getpixel((0, 0))
    mad = mean_all / mi if mi else 999.0
    return mi / mu, mad


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "aok_a_03_02_00"
    scale = 4  # 搜索用的降采样倍率
    body_p = find(base + "_b.mzp.png")
    face_p = find(base + ".mzp.png")
    comps = comp_candidates(base)
    if not (body_p and face_p and comps):
        print(f"缺文件: body={body_p} face={face_p} comps={comps}")
        return
    body_full = Image.open(body_p).convert("RGBA")
    face_full = Image.open(face_p).convert("RGBA")
    comp = Image.open(comps[0]).convert("RGBA")
    print(f"== {base} ==")
    print(f"  身体层 {body_full.size}  脸层 {face_full.size}  "
          f"合成图 {os.path.basename(comps[0])} {comp.size}")

    bbb = mask(body_full).getbbox()
    cbb = mask(comp).getbbox()
    print(f"  身体内容 bbox={bbb}   合成内容 bbox={cbb}")

    # 降采样件
    w, h = comp.size[0] // scale, comp.size[1] // scale
    comp_s = comp.resize((w, h), Image.BOX)
    body_s = body_full.resize((body_full.width // scale, body_full.height // scale), Image.BOX)
    face_s = face_full.resize((max(1, face_full.width // scale),
                               max(1, face_full.height // scale)), Image.BOX)
    # 只用下半身条带做身体偏移搜索
    band = (0, int(h * 0.60), w, int(h * 0.95))
    print(f"\n-- 1. 身体层偏移搜索（{scale}x 降采样，条带 y={band[1]}..{band[3]}）--")
    best = None
    for oy in range(0, 60):
        for ox in range(0, 60):
            # 只比条带
            a = mask(comp_s).crop(band)
            b = mask(paste(comp_s.size, [(body_s, ox, oy)])).crop(band)
            u = frac(ImageChops.lighter(a, b))
            v = (frac(a) + frac(b) - u) / u if u else 0
            if best is None or v > best[0]:
                best = (v, ox, oy)
    v, oxs, oys = best
    print(f"  降采样最佳 ({oxs*scale}, {oys*scale})  条带 IoU={v:.4f}")
    ox, oy = oxs * scale, oys * scale
    # 全分辨率细搜 ±scale
    best2 = None
    for dy in range(-scale, scale + 1):
        for dx in range(-scale, scale + 1):
            X, Y = ox + dx, oy + dy
            a = mask(comp).crop((0, int(comp.height * 0.60), comp.width, int(comp.height * 0.95)))
            canvas = paste(comp.size, [(body_full, X, Y)])
            b = mask(canvas).crop((0, int(comp.height * 0.60), comp.width, int(comp.height * 0.95)))
            u = frac(ImageChops.lighter(a, b))
            val = (frac(a) + frac(b) - u) / u if u else 0
            if best2 is None or val > best2[0]:
                best2 = (val, X, Y)
    v2, ox, oy = best2
    print(f"  全分辨率最佳 ({ox}, {oy})  条带 IoU={v2:.4f}")
    if v2 < 0.97:
        print("  ⚠ 条带 IoU 不足 —— 身体层不是 1:1 贴入。换判据，"
              "或先查缩放（fit_layer_scale.py）。")
        return

    print("\n-- 2. 脸层占位（残差 alpha）--")
    body_canvas = paste(comp.size, [(body_full, ox, oy)])
    resid = ImageChops.subtract(mask(comp), mask(body_canvas))
    rb = resid.getbbox()
    print(f"  残差 bbox={rb}  尺寸 {rb[2]-rb[0]}x{rb[3]-rb[1]}")
    fbb = mask(face_full).getbbox()
    print(f"  脸层内容 bbox={fbb} 尺寸 {fbb[2]-fbb[0]}x{fbb[3]-fbb[1]}")
    kw = (rb[2] - rb[0]) / (fbb[2] - fbb[0])
    kh = (rb[3] - rb[1]) / (fbb[3] - fbb[1])
    print(f"  宽比={kw:.4f}  高比={kh:.4f}  均值 k={(kw+kh)/2:.4f}")

    print("\n-- 3. 重建验证：扫 k 与偏移 --")
    fw, fh = fbb[2] - fbb[0], fbb[3] - fbb[1]
    results = []
    k = round((kw + kh) / 2 - 0.06, 4)
    while k <= (kw + kh) / 2 + 0.06 + 1e-9:
        f2 = face_full.resize((max(1, round(face_full.width * k)),
                               max(1, round(face_full.height * k))), Image.LANCZOS)
        fx = rb[0] - round(fbb[0] * k)
        fy = rb[1] - round(fbb[1] * k)
        sc, mad = score(comp, [(body_full, ox, oy), (f2, fx, fy)])
        results.append((sc, mad, round(k, 4), fx, fy))
        k += 0.002
    results.sort(key=lambda r: (-r[0], r[1]))
    for r in results[:3]:
        print(f"  k={r[2]:.4f}  偏移=({r[3]}, {r[4]})  IoU={r[0]:.5f}  RGB-MAD={r[1]:.2f}")
    sc, mad, k, fx, fy = results[0]

    print("\n-- 4. 局部细搜（±8px, k±0.01）--")
    fine = []
    for dk in range(-5, 6):
        kk = round(k + dk * 0.002, 4)
        f2 = face_full.resize((max(1, round(face_full.width * kk)),
                               max(1, round(face_full.height * kk))), Image.LANCZOS)
        for dx in range(-8, 9, 2):
            for dy in range(-8, 9, 2):
                s2, m2 = score(comp, [(body_full, ox, oy), (f2, fx + dx, fy + dy)])
                fine.append((s2, m2, kk, fx + dx, fy + dy))
    fine.sort(key=lambda r: (-r[0], r[1]))
    s3, m3, k3, fx3, fy3 = fine[0]
    print(f"  最佳 k={k3}  偏移=({fx3}, {fy3})  IoU={s3:.5f}  RGB-MAD={m3:.2f}")
    if s3 >= 0.99:
        print(f"\n  ✅ 解出：身体@({ox},{oy}) 1:1 ；脸 缩放 {k3} 贴到 ({fx3},{fy3})")
        print(f"     （脸层自身画布左上角 * {k3} 后，画布原点落在合成图的 ({fx3},{fy3})）")
    else:
        print(f"\n  ⚠ 最好只到 IoU={s3:.5f} —— 解不干净，如实记录，不硬凑")


if __name__ == "__main__":
    main()

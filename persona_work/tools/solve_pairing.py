# -*- coding: utf-8 -*-
"""
solve_pairing.py —— 解出「脸层贴在身体层上的位置」，并重建验证。

判据（精确、不靠猜）：
  1. 身体层偏移：用**脚**（内容最下 300 行）的 x 范围对齐；y 用两图内容底边差
     —— 脸够不到脚，所以这一段是纯身体，判据干净到 1px
  2. 脸层落点：残差 alpha（合成有、身体无）在头部区域的 bbox
     = 脸层内容在合成图里的实际位置
  3. 反推：脸的画布原点落在身体画布的哪个像素上 = (残差左上 - 脸内容左上) - 身体偏移
  4. 重建验证：身体@(ox,oy) + 脸@(fx,fy) 重画，与真合成图比 alpha IoU 与 RGB 差
     IoU 必须 >= 0.999 才算解对

用法:
  python persona_work/tools/solve_pairing.py aok_a_03_02_00 aok_a_12_02_00 ...
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def frac(m, box=None):
    if box:
        m = m.crop(box)
    return m.resize((1, 1), Image.BOX).getpixel((0, 0)) / 255.0


def find_in(d, name):
    p = os.path.join(OUT, d, name)
    return p if os.path.isfile(p) else None


def comps_for(base):
    dd = os.path.join(OUT, "data02105")
    if not os.path.isdir(dd):
        return []
    return sorted(os.path.join(dd, f) for f in os.listdir(dd)
                  if f.startswith(base + "_"))


def solve(base):
    bp = find_in("data02100", base + "_b.mzp.png")
    fp = find_in("data02100", base + ".mzp.png")
    cs = comps_for(base)
    if not (bp and fp and cs):
        print(f"  [{base}] 缺料 body={bool(bp)} face={bool(fp)} comps={len(cs)}")
        return None
    body = Image.open(bp).convert("RGBA")
    face = Image.open(fp).convert("RGBA")
    comp = Image.open(cs[0]).convert("RGBA")
    bm, fm, cm = mask(body), mask(face), mask(comp)

    bcb = bm.getbbox()
    ccb = cm.getbbox()
    # 1) 脚：身体内容最下 300 行的 x 范围
    band_b = bm.crop((0, bcb[3] - 300, body.width, bcb[3]))
    band_c = cm.crop((0, ccb[3] - 300, comp.width, ccb[3]))
    xb, xc = band_b.getbbox(), band_c.getbbox()
    ox = xc[0] - xb[0]
    oy = ccb[3] - bcb[3]
    print(f"  [{base}] 身体偏移=({ox}, {oy})  "
          f"（脚 x 范围 {xb[0]}..{xb[2]} -> {xc[0]}..{xc[2]}；"
          f"右对齐差 {(xc[2]-xb[2])-ox}）")

    # 2) 残差 -> 脸层落点
    canvas = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    canvas.alpha_composite(body, (ox, oy))
    resid = ImageChops.subtract(cm, mask(canvas))
    rb = resid.getbbox()
    fbb = fm.getbbox()
    print(f"      残差(脸层可见区) bbox={rb}  尺寸 {rb[2]-rb[0]}x{rb[3]-rb[1]}"
          f"   脸层内容 bbox={fbb} 尺寸 {fbb[2]-fbb[0]}x{fbb[3]-fbb[1]}")
    # 脸画布原点在合成图里的位置，再换算到身体画布坐标
    fx_comp = rb[0] - fbb[0]
    fy_comp = rb[1] - fbb[1]
    fx = fx_comp - ox
    fy = fy_comp - oy
    print(f"      脸画布原点: 合成图({fx_comp}, {fy_comp}) -> 身体画布({fx}, {fy})")

    # 3) 重建验证
    rec = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    rec.alpha_composite(Image.new("RGBA", comp.size, (0, 0, 0, 0)))
    rec.alpha_composite(body, (ox, oy))
    rec.alpha_composite(face, (fx_comp, fy_comp))
    rm = mask(rec)
    inter = frac(ImageChops.multiply(cm, rm))
    union = frac(ImageChops.lighter(cm, rm))
    iou = inter / union if union else 0
    d = ImageChops.difference(comp.convert("RGB"), rec.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, ImageChops.multiply(cm, rm))
    mad = (d.resize((1, 1), Image.BOX).getpixel((0, 0)) / inter) if inter else 999
    print(f"      重建: alpha IoU={iou:.5f}  交集内 RGB 平均差={mad:.2f}")
    return dict(base=base, ox=ox, oy=oy, fx=fx, fy=fy, iou=iou, mad=mad,
                body=body.size, face=face.size)


def main():
    bases = sys.argv[1:] or ["aok_a_03_02_00"]
    rows = []
    for b in bases:
        r = solve(b)
        if r:
            rows.append(r)
    if rows:
        print("\n=== 汇总：脸层贴在身体画布上的位置 ===")
        print(f"{'base':<22}{'身体画布':<14}{'脸画布':<12}{'贴图点':<14}{'IoU':<9}MAD")
        for r in rows:
            print(f"{r['base']:<22}{str(r['body']):<14}{str(r['face']):<12}"
                  f"{str((r['fx'], r['fy'])):<14}{r['iou']:<9.5f}{r['mad']:.2f}")


if __name__ == "__main__":
    main()

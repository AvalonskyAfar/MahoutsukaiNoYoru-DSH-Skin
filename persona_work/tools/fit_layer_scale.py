#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fit_layer_scale.py —— 求「身体层(_b) -> 合成图(data02105)」的缩放比与偏移。

判据链（都不靠猜）：
  1. 两图**内容 bbox 的底边都对应脚底**（脸够不到脚）-> 用它当下锚点
  2. 只用身体内容的下半段做 alpha 行投影，在"下锚点固定"的前提下
     只需搜一个参数：缩放比 s -> 残差最小的 s 就是它
  3. 用 s + 内容底边/左边算出偏移 (ox, oy)，再用**容差内模板命中率**验证
     （必须接近 1.0；抽出的 PNG 可能有量化差异，所以用 |dRGB|<=8 而不是相等）

用法:
  python persona_work/tools/fit_layer_scale.py aok_a_03_02_00
"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "hfa_png", "out")


def find(name):
    for d in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, d, name)
        if os.path.isfile(p):
            return p
    return None


def all_matching(prefix):
    hits = []
    for d in sorted(os.listdir(OUT)):
        dd = os.path.join(OUT, d)
        if os.path.isdir(dd):
            for f in os.listdir(dd):
                if f.startswith(prefix):
                    hits.append(os.path.join(dd, f))
    return sorted(hits)


def row_profile(im):
    a = im.getchannel("A")
    t = a.resize((1, a.height), Image.BOX)
    return [t.getpixel((0, y)) for y in range(a.height)]


def fit_scale(body, comp, bbb, cbb, lo=0.90, hi=1.15, span=3000, n=500):
    """下锚点固定：身体内容底 <-> 合成内容底。搜缩放比 s。"""
    bp = row_profile(body)
    cp = row_profile(comp)
    b_bot, c_bot = bbb[3], cbb[3]
    best = None
    s = lo
    while s <= hi + 1e-9:
        err = 0.0
        cnt = 0
        for i in range(n):
            # 从底往上取 i/n 比例处的点：身体坐标
            y_b = int(b_bot - span * i / n)
            y_c = int(c_bot - span * s * i / n)
            if 0 <= y_b < len(bp) and 0 <= y_c < len(cp):
                err += abs(cp[y_c] - bp[y_b])
                cnt += 1
        if cnt:
            e = err / cnt
            if best is None or e < best[0]:
                best = (e, round(s, 4))
        s += 0.001
    return best


def tol_match(comp, body, ox, oy, s, tol=8, step=8):
    if abs(s - 1.0) > 1e-6:
        body = body.resize((max(1, int(body.width * s)), max(1, int(body.height * s))),
                           Image.LANCZOS)
    bb = body.tobytes()
    cb = comp.tobytes()
    bw, bh = body.size
    cw, ch = comp.size
    ok = tot = 0
    for y in range(0, bh, step):
        for x in range(0, bw, step):
            o = (y * bw + x) * 4
            if bb[o + 3] < 240:
                continue
            X, Y = x + ox, y + oy
            if not (0 <= X < cw and 0 <= Y < ch):
                continue
            o2 = (Y * cw + X) * 4
            tot += 1
            if abs(bb[o] - cb[o2]) <= tol and abs(bb[o + 1] - cb[o2 + 1]) <= tol \
               and abs(bb[o + 2] - cb[o2 + 2]) <= tol:
                ok += 1
    return (ok / tot if tot else 0.0), tot


def report(base):
    body = Image.open(find(base + "_b.mzp.png")).convert("RGBA")
    comps = [p for p in all_matching(base + "_") if not p.endswith("_b.mzp.png")]
    if not comps:
        print(f"== {base} == 没有合成图，跳过")
        return
    comp = Image.open(comps[0]).convert("RGBA")
    bbb = body.getchannel("A").getbbox()
    cbb = comp.getchannel("A").getbbox()
    print(f"== {base} ==")
    print(f"  身体层 {body.size} 内容bbox={bbb} 尺寸={bbb[2]-bbb[0]}x{bbb[3]-bbb[1]}")
    print(f"  合成图 {os.path.basename(comps[0])} {comp.size} 内容bbox={cbb} "
          f"尺寸={cbb[2]-cbb[0]}x{cbb[3]-cbb[1]}")
    e, s = fit_scale(body, comp, bbb, cbb)
    print(f"  [拟合] 最佳缩放 s={s}（下半身行投影残差 {e:.2f}）")
    ox = round(cbb[0] - s * bbb[0])
    oy = round(cbb[3] - s * bbb[3])
    print(f"  [推得] 偏移 = ({ox}, {oy})   （内容左边/底边对齐）")
    sc, tot = tol_match(comp, body, ox, oy, s)
    print(f"  [验证] 容差(|dRGB|<=8) 命中率 = {sc:.4f} （采样 {tot} 点）")
    if sc > 0.98:
        print("  -> ✅ 身体层是 **等比缩放** 后贴进合成图，参数已确定")
    else:
        print("  -> ⚠ 命中率不足，说明还有别的差异（换判据或换样本）")


def main():
    bases = sys.argv[1:] or ["aok_a_03_02_00"]
    for b in bases:
        report(b)
        print()


if __name__ == "__main__":
    main()

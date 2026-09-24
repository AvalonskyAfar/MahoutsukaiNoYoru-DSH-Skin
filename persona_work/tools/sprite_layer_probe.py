#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
sprite_layer_probe.py —— 量出「身体层 + 脸层 -> 合成图」的对齐关系。

背景：前序会话判定 `_b` 是"头部抠空的身体层"、脸是运行时另贴的图层，
      而**对齐参数没挖到**，于是皮肤只用"特写脸"（屏幕上只剩一个孤零零的头）。
      但 `hfa_png/out/data02105/` 里躺着**已经合好的整身图**，
      例 `aok_a_03_02_00_02_02.mzp.png` (2042x6122) —— 对齐关系就烤在里面。

判据（都不靠猜）：
  1. 腿部区域做 bbox 对比 -> 判断身体层是否 **1:1** 贴进合成图
  2. 用腿部/靴子的小块做**模板匹配**（精确像素相等计数）-> 定位身体层偏移
  3. 合成图 alpha 减去位移后的身体层 alpha -> 得到脸层实际占位
     与脸层图自身的内容 bbox 比 -> 得出脸层的偏移与缩放比

用法:
  python persona_work/tools/sprite_layer_probe.py aok_a_03_02_00
  python persona_work/tools/sprite_layer_probe.py aok_a_12_02_00 --comp aok_a_12_02_00_02_02
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
        if not os.path.isdir(dd):
            continue
        for f in os.listdir(dd):
            if f.startswith(prefix):
                hits.append(os.path.join(dd, f))
    return sorted(hits)


def open_rgba(p):
    return Image.open(p).convert("RGBA")


def bbox_region(im, y0=None, y1=None):
    box = im.getchannel("A")
    if y0 is not None:
        box = box.crop((0, y0, im.width, y1 or im.height))
        bb = box.getbbox()
        return None if bb is None else (bb[0], bb[1] + y0, bb[2], bb[3] + y0)
    return box.getbbox()


def sized(bb):
    return None if bb is None else (bb[2] - bb[0], bb[3] - bb[1])


def template_match(comp, body, tx, ty, half=40, step=2):
    """body 在 (tx,ty) 附近找一个 patch，在 comp 里搜它的位置。
    返回 (最佳偏移, 精确命中率)。比较 RGBA 四通道**完全相等**。"""
    cb = comp.tobytes()
    bb = body.tobytes()
    bw, bh = body.size
    cw, ch = comp.size
    # 从模板点附近挑 alpha 饱满的像素做样本
    samples = []
    for y in range(ty, min(ty + 400, bh), step):
        for x in range(tx, min(tx + 400, bw), step):
            o = (y * bw + x) * 4
            if bb[o + 3] > 250:  # 不透明
                samples.append((x, y, bb[o:o + 4]))
            if len(samples) > 1200:
                break
        if len(samples) > 1200:
            break
    if not samples:
        return None
    best = None
    for oy in range(-half, half + 1):
        for ox in range(-half, half + 1):
            ok = 0
            for (x, y, px) in samples:
                X, Y = x + ox, y + oy
                if not (0 <= X < cw and 0 <= Y < ch):
                    continue
                o = (Y * cw + X) * 4
                if cb[o:o + 4] == px:
                    ok += 1
            score = ok / len(samples)
            if best is None or score > best[0]:
                best = (score, ox, oy)
    return best


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "aok_a_03_02_00"
    comp_name = None
    if "--comp" in sys.argv:
        comp_name = sys.argv[sys.argv.index("--comp") + 1]

    print(f"== 基准 id: {base} ==")
    body_path = find(base + "_b.mzp.png")
    face_path = find(base + ".mzp.png")
    if comp_name:
        comps = [find(comp_name)]
    else:
        comps = [p for p in all_matching(base + "_") if not p.endswith("_b.mzp.png")]
    if not (body_path and face_path and comps):
        print("  缺文件：body=%s face=%s comps=%s" % (body_path, face_path, comps))
        return

    body = open_rgba(body_path)
    face = open_rgba(face_path)
    print(f"  身体层(_b) {body.width}x{body.height}  bbox={bbox_region(body)}")
    print(f"  脸层       {face.width}x{face.height}  bbox={bbox_region(face)}")
    for c in comps:
        print(f"  合成图     {os.path.basename(c)}  "
              f"{Image.open(c).size}  bbox={bbox_region(open_rgba(c))}")
    comp = open_rgba(comps[0])
    cw, ch = comp.size
    bw, bh = body.size

    # ---- 1. 腿部区域 bbox 对比：身体层是否 1:1 ----
    print("\n-- 1. 腿部区域(画面下段) bbox 对比，判断是否 1:1 --")
    cut_b = int(bh * 0.80)
    cut_c = int(ch * 0.80)
    bb_legs = bbox_region(body, cut_b)
    cb_legs = bbox_region(comp, cut_c)
    print(f"  身体层 y>{cut_b}: bbox={bb_legs} 尺寸={sized(bb_legs)}")
    print(f"  合成图 y>{cut_c}: bbox={cb_legs} 尺寸={sized(cb_legs)}")
    if bb_legs and cb_legs:
        dw = (cb_legs[2] - cb_legs[0]) - (bb_legs[2] - bb_legs[0])
        dh = (cb_legs[3] - cb_legs[1]) - (bb_legs[3] - bb_legs[1])
        print(f"  尺寸差: dW={dw} dH={dh}  -> "
              f"{'1:1 未缩放' if abs(dw) <= 2 and abs(dh) <= 2 else '⚠ 有缩放！'}")

    # ---- 2. 模板匹配求偏移 ----
    print("\n-- 2. 身体层在合成图里的偏移（腿部模板精确匹配）--")
    t = template_match(comp, body, tx=920, ty=bh - 900, half=60, step=2)
    if t:
        score, ox, oy = t
        print(f"  best: offset=({ox}, {oy})  精确命中率={score:.4f}")
        if score < 0.60:
            print("  ⚠ 命中率低 -> 不是简单 1:1 贴图，得换判据")
    else:
        ox = oy = 0
        print("  模板匹配失败")

    # ---- 3. 脸层占位 ----
    print("\n-- 3. 脸层实际占位（合成 alpha 减 位移后身体 alpha）--")
    ca = comp.getchannel("A").tobytes()
    ba = body.getchannel("A").tobytes()
    minx, miny, maxx, maxy = cw, ch, -1, -1
    step = 3
    for y in range(0, ch, step):
        row = y * cw
        by = y - oy
        in_body_row = 0 <= by < bh
        brow = by * bw if in_body_row else 0
        for x in range(0, cw, step):
            if ca[row + x] <= 8:
                continue
            bx = x - ox
            if in_body_row and 0 <= bx < bw and ba[brow + bx] > 8:
                continue
            if x < minx:
                minx = x
            if y < miny:
                miny = y
            if x > maxx:
                maxx = x
            if y > maxy:
                maxy = y
    print(f"  脸层专属像素 bbox=（{minx}, {miny}, {maxx}, {maxy}） "
          f"尺寸 {maxx-minx}x{maxy-miny}")
    fbb = bbox_region(face)
    if fbb:
        fw, fh = fbb[2] - fbb[0], fbb[3] - fbb[1]
        print(f"  脸层图内容 bbox={fbb} 尺寸 {fw}x{fh}")
        print(f"  宽比={(maxx-minx)/fw:.4f}  高比={(maxy-miny)/fh:.4f}")
        if abs((maxx - minx) / fw - 1) < 0.03 and abs((maxy - miny) / fh - 1) < 0.03:
            print(f"  -> 脸层 **1:1** 直接贴，偏移 = ({minx-fbb[0]}, {miny-fbb[1]})")
        else:
            print("  -> 脸层**被缩放**，比例见上")


if __name__ == "__main__":
    main()

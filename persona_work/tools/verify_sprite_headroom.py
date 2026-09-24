#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
verify_sprite_headroom.py —— 离线验证「立绘不会被切平头顶」（docs/19 红线 8 / 验收 §4.3-1）。

背景：`docs/17` §2.2 定的规则是「按**素材画布**整张输出，绝不按内容 bbox 裁」。
`build_stage_sprites.py` 里对应的实现是 `win = (0, 0, body.width, body.height)`。
但「没被裁」只保证**烘图那一步**没裁 —— 真正决定用户看到什么的是**渲染几何**：
    `.myh-sprite{height:76vh;width:auto}`  ← 无 object-fit，故横向也不会裁
    父层 `.myh-stage{position:absolute;inset:0;display:grid;place-items:end center}`
    `transform:translateX(var(--myh-sprite-x,20vw))`
所以本脚本同时检查三件事：

  A. **画布保真**：每张 `stage_*.png` 的尺寸 == 它**来源身体层**的画布尺寸
     （证实「按素材画布输出」没有缩水/收紧）。
  B. **头顶余量**：图内 alpha bbox 的上边距 >= 阈值（默认 1px），
     即图里确实留着发型余量，而不是贴边。
  C. **渲染几何**：在给定视口/（可选）正文上沿下，按 76vh 换算出
     · 立绘在屏上的实际盒子（left/right/top）
     · 头顶**渲染位置**（= 盒子 top + bboxTop × scale）
     · 头顶是否被视口顶边或正文带上沿切掉
     · 水平方向 x=0 或 x=viewportW 处是否已进入 alpha bbox（= 人被旁边切掉）

用法：
    python persona_work/tools/verify_sprite_headroom.py
    python persona_work/tools/verify_sprite_headroom.py --viewport 1920x1080
    python persona_work/tools/verify_sprite_headroom.py --vh 76 --sprite-x 20 --column-top 90
    python persona_work/tools/verify_sprite_headroom.py --json out.json
退出码：0 = 全部通过；1 = 有 FAIL（脚本可进 7 个检查脚本那一套）。
"""
import argparse
import glob
import json
import os
import re
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPRITES = os.path.join(ROOT, "skin", "assets", "sprite")
OUT = os.path.join(ROOT, "hfa_png", "out")
STAGE = os.path.join(ROOT, "persona_work", "stage")
SPEC = os.path.join(STAGE, "stage_spec.json")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}

# stage_<景>_c<通道>_<帧>.png  —— 与 build_stage_sprites.py 的产物命名一致
NAME_RE = re.compile(r"^stage_(?P<scene>[a-z0-9]+)_c(?P<chan>\d+)_(?P<frame>\d+)\.png$", re.I)

ALPHA_MIN = 8  # 与 build_stage_sprites.mask() 的判据保持同一口径


def scene_index():
    """景 -> (角色, 批次, i3)，来自 stage_spec.json（唯一规格来源）。"""
    if not os.path.isfile(SPEC):
        return {}
    spec = json.load(open(SPEC, encoding="utf-8"))
    return {k: (v.get("char"), v.get("batch"), v.get("i3"))
            for k, v in spec.items() if isinstance(v, dict)}


def headroom_of(path):
    """返回 (w, h, bbox 或 None)。bbox = **alpha > 阈值** 的内容包围盒。

    ★ 坑（本脚本第一版就栽在这）：`Image.getbbox()` 在 RGBA 上**同时看 R/G/B**。
      透明像素只要 RGB 不是纯黑（很多素材的透明区是白色），
      它就会把整张画布算成"内容" → 量出来永远贴近画布边缘，结论完全反了。
      所以必须**对 alpha 单通道**取 bbox，不能对整张图取。
    """
    with Image.open(path) as im:
        im = im.convert("RGBA")
        w, h = im.size
        mask = im.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0)
        return w, h, mask.getbbox()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--viewport", default="1920x1080", help="视口 WxH（默认 1920x1080）")
    ap.add_argument("--vh", type=float, default=76.0, help="立绘高度 vh（默认 76，取自 client.js）")
    ap.add_argument("--sprite-x", type=float, default=20.0, help="--myh-sprite-x 的 vw 值（默认 20）")
    ap.add_argument("--column-top", type=float, default=0.0,
                    help="正文带上沿（px，0=不检查；DSH 顶栏约 44~90）")
    ap.add_argument("--min-headroom", type=int, default=1, help="图内上边距下限（px）")
    ap.add_argument("--json", default="", help="把结果写到这个 JSON")
    args = ap.parse_args()

    m = re.match(r"^(\d+)x(\d+)$", args.viewport.strip(), re.I)
    if not m:
        print(f"✗ viewport 格式不对：{args.viewport}（要 WxH）")
        return 1
    vw, vh_px = int(m.group(1)), int(m.group(2))
    sprite_h = vh_px * args.vh / 100.0
    shift = vw * args.sprite_x / 100.0

    files = sorted(glob.glob(os.path.join(SPRITES, "stage_*.png")))
    if not files:
        print(f"✗ 没有找到立绘：{SPRITES}\\stage_*.png")
        return 1

    idx = scene_index()
    rows, fails, warns = [], [], []

    for p in files:
        name = os.path.basename(p)
        nm = NAME_RE.match(name)
        w, h, bbox = headroom_of(p)
        row = dict(file=name, w=w, h=h)

        if bbox is None:
            fails.append(f"{name}: 整张图全透明（alpha 全 <= {ALPHA_MIN}）")
            row["bbox"] = None
            rows.append(row)
            continue
        x0, y0, x1, y1 = bbox
        row["bbox"] = [x0, y0, x1, y1]
        row["padTop"], row["padBottom"] = y0, h - y1
        row["padLeft"], row["padRight"] = x0, w - x1

        # --- A. 画布保真：与来源身体层比对 ---
        src_ok, src_info = None, ""
        if nm:
            scene = nm.group("scene").upper()
            meta = idx.get(scene)
            if meta and all(meta):
                ch, batch, i3 = meta
                bp = os.path.join(OUT, DIRS.get(ch, ""), f"{ch}_{batch}_{i3}_{nm.group('chan')}_00_b.mzp.png")
                if os.path.isfile(bp):
                    with Image.open(bp) as b:
                        bw, bh = b.size
                    src_ok = (bw == w and bh == h)
                    src_info = f"来源身体层 {bw}x{bh}"
                    row["bodyCanvas"] = [bw, bh]
        row["canvasMatchesBody"] = src_ok
        if src_ok is False:
            fails.append(f"{name}: 尺寸 {w}x{h} != {src_info} —— 没按素材画布整张输出")

        # --- B. 图内头顶余量 ---
        if y0 < args.min_headroom:
            fails.append(f"{name}: 图内上边距仅 {y0}px（< {args.min_headroom}）—— 内容贴顶，头顶已被裁")
        if x0 < args.min_headroom or (w - x1) < args.min_headroom:
            warns.append(f"{name}: 左右留边仅 L{x0}/R{w-x1}px（< {args.min_headroom}）")

        # --- C. 渲染几何 ---
        scale = sprite_h / float(h)
        draw_w = w * scale
        # place-items:end center → 先水平居中，再整体 translateX
        left = (vw - draw_w) / 2.0 + shift
        right = left + draw_w
        top = vh_px - sprite_h  # 贴底
        head_top_px = top + y0 * scale
        row.update(scale=round(scale, 4), drawW=round(draw_w, 1),
                   boxLeft=round(left, 1), boxRight=round(right, 1), boxTop=round(top, 1),
                   headTopPx=round(head_top_px, 1))
        row["headClippedByViewport"] = head_top_px < 0
        row["headClippedByColumn"] = bool(args.column_top) and head_top_px < args.column_top
        # 水平：视口左右边缘是否已经切进 alpha bbox
        # 边缘 x 处的图内坐标：
        def inner_at(px):
            return (px - left) / scale
        row["cutAtLeftEdge"] = left < 0 and inner_at(0) > x0
        row["cutAtRightEdge"] = right > vw and inner_at(vw) < x1

        if row["headClippedByViewport"]:
            fails.append(f"{name}: 头顶渲染在 y={head_top_px:.1f}px，被视口顶边切掉")
        if row["headClippedByColumn"]:
            warns.append(f"{name}: 头顶渲染在 y={head_top_px:.1f}px，进入正文带上沿（{args.column_top}px）"
                         f"—— 会被正文暗带/正文盖住")
        if row["cutAtRightEdge"]:
            warns.append(f"{name}: 右侧 x={vw} 处已切进人像（盒子右缘 {right:.1f}px）")
        if row["cutAtLeftEdge"]:
            warns.append(f"{name}: 左侧 x=0 处已切进人像（盒子左缘 {left:.1f}px）")

        rows.append(row)

    # ---- 汇总 ----
    ok_a = [r for r in rows if r.get("canvasMatchesBody") is True]
    unknown_a = [r for r in rows if r.get("canvasMatchesBody") is None]
    pads = [r["padTop"] for r in rows if "padTop" in r]
    heads = [r["headTopPx"] for r in rows if "headTopPx" in r]

    print("=" * 66)
    print(f"立绘头顶余量 / 渲染几何核查   视口 {vw}x{vh_px}  vh={args.vh}%  立绘高 {sprite_h:.0f}px")
    print(f"  --myh-sprite-x = {args.sprite_x}vw = {shift:.0f}px    正文上沿 = {args.column_top or '未检查'}")
    print("=" * 66)
    print(f"素材数            : {len(rows)} 张")
    print(f"画布保真(==身体层): {len(ok_a)} 张一致"
          + (f"，{len(unknown_a)} 张无法回溯来源" if unknown_a else ""))
    if pads:
        print(f"图内上边距        : min {min(pads)}px / max {max(pads)}px / 均值 {sum(pads)/len(pads):.1f}px")
    if heads:
        print(f"头顶渲染 y        : min {min(heads):.1f}px / max {max(heads):.1f}px  （视口顶=0，底={vh_px}）")

    # 盒子的水平分布（按景分组，便于看"站右侧"是否成立）
    print("\n各景渲染盒子（头顶 y / 盒子 left..right）:")
    per_scene = {}
    for r in rows:
        scene = (NAME_RE.match(r["file"]) or [None, "?"])
        scene = NAME_RE.match(r["file"]).group("scene").upper() if NAME_RE.match(r["file"]) else "?"
        per_scene.setdefault(scene, []).append(r)
    for scene in sorted(per_scene):
        rs = per_scene[scene]
        ls = [x["boxLeft"] for x in rs if "boxLeft" in x]
        hts = [x["headTopPx"] for x in rs if "headTopPx" in x]
        print(f"  {scene:>3}  {len(rs):>3} 张   头顶 {min(hts):.0f}~{max(hts):.0f}px   "
              f"盒子 left {min(ls):.0f}~{max(ls):.0f}px")

    if fails:
        print(f"\n✗ FAIL {len(fails)} 条:")
        for f in fails[:40]:
            print("   " + f)
        if len(fails) > 40:
            print(f"   … 还有 {len(fails)-40} 条")
    if warns:
        print(f"\n⚠ WARN {len(warns)} 条（不判失败，但要人眼确认）:")
        for w_ in warns[:15]:
            print("   " + w_)
        if len(warns) > 15:
            print(f"   … 还有 {len(warns)-15} 条")

    verdict = "✓ 通过" if not fails else "✗ 不通过"
    print(f"\n== 结论：{verdict} ==")

    if args.json:
        json.dump(dict(viewport=[vw, vh_px], vh=args.vh, spriteX=args.sprite_x,
                       columnTop=args.column_top, rows=rows,
                       fails=fails, warns=warns),
                  open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"明细 -> {args.json}")

    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())

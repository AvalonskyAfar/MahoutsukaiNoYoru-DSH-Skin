#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""量每一景/每一角色的立绘**朝向**，用来判断"立绘该站哪一侧"。

方法（只对 alpha 通道做，红线：绝不看 RGB）：
  · 上半区（头/发：bbox 上沿起 0~30% 高度）alpha 质量的**水平重心**
  · 下半区（躯干：bbox 70~100% 高度）alpha 质量的**水平重心**
  · d = 头重心 − 躯干重心（占 bbox 宽度的百分比）
      d > 0 → 头偏右 → 角色**面朝右**
      d < 0 → 头偏左 → 角色**面朝左**
  · 再用"最外缘在哪一侧"做交叉验证：脸的前缘（鼻尖/下巴）会贴住 bbox 的那一侧。

⚠ 这是**统计推断，不是人眼确认**。它给的是"该往哪边站"的**证据**，最终仍应人眼过一眼。
   若两侧差值很小（|d| < 2%），判为"正视/无法判定"，不要硬判。

用法：
    python persona_work/tools/verify_sprite_facing.py
    python persona_work/tools/verify_sprite_facing.py --json facing.json
"""
import glob
import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPRITES = os.path.join(ROOT, "skin", "assets", "sprite")
ALPHA_MIN = 8
SCENES = ["A1", "A3", "A4", "A5", "A6"]


def analyse(path):
    with Image.open(path) as im:
        im = im.convert("RGBA")
        a = im.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0)
        w, h = a.size
        bbox = a.getbbox()
        if not bbox:
            return None
        x0, y0, x1, y1 = bbox
        bw, bh = x1 - x0, y1 - y0
        px = a.load()

        def centroid(y_from, y_to):
            """在 [y_from, y_to) 行区间内算 alpha 质量的水平重心（绝对 x）。"""
            tot = 0
            acc = 0
            for y in range(y_from, y_to):
                for x in range(x0, x1):
                    v = px[x, y]
                    if v:
                        tot += 1
                        acc += x
            return (acc / tot) if tot else None

        head = centroid(y0, y0 + max(1, int(bh * 0.30)))
        body = centroid(y0 + int(bh * 0.70), y1)
        if head is None or body is None:
            return None
        d = (head - body) / bw * 100.0
        # 交叉验证：bbox 左右两侧的内容高度（脸的前缘一侧通常更"实"）
        left_hits = sum(1 for y in range(y0, y1) for x in range(x0, x0 + max(1, int(bw * 0.12))) if px[x, y])
        right_hits = sum(1 for y in range(y0, y1) for x in range(x1 - max(1, int(bw * 0.12)), x1) if px[x, y])
        return dict(size=(w, h), bbox=bbox, head=round(head, 1), body=round(body, 1),
                    d=round(d, 2), leftEdge=left_hits, rightEdge=right_hits)


def main():
    want_json = "--json" in sys.argv
    out = {}
    print("景   文件                                    画布        头重心    躯干重心    d%     朝向")
    print("-" * 100)
    for scene in SCENES:
        files = sorted(glob.glob(os.path.join(SPRITES, f"stage_{scene.lower()}_c*.png")))
        if not files:
            print(f"{scene:<4} （无立绘）")
            continue
        # 每景取该景**第一张**做代表（同景同衣服，其余姿势通常同朝向）
        per_file = []
        for p in files:
            r = analyse(p)
            if r:
                r["file"] = os.path.basename(p)
                per_file.append(r)
        # 景级汇总：对 d 取中位数，避免个别姿势带偏
        ds = sorted(r["d"] for r in per_file)
        med = ds[len(ds) // 2]
        facing = "面朝右 →" if med > 2 else ("← 面朝左" if med < -2 else "正视/无法判定")
        rep = per_file[0]
        print(f"{scene:<4} {rep['file']:<40} {str(rep['size']):<11} {rep['head']:>8} "
              f"{rep['body']:>9} {med:>7.2f}  {facing}")
        out[scene] = dict(median_d=med, facing=facing,
                          files=[{k: v for k, v in r.items() if k != "bbox"} for r in per_file])
    print("-" * 100)
    print("判读：d = 头重心 − 躯干重心（占 bbox 宽 %）。d>0 头偏右=面朝右；d<0 面朝左。")
    print("      |d|<2% 视为正视，别硬判。")
    if want_json:
        i = sys.argv.index("--json")
        p = sys.argv[i + 1] if len(sys.argv) > i + 1 else "facing.json"
        json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("明细 ->", p)
    return 0


if __name__ == "__main__":
    sys.exit(main())

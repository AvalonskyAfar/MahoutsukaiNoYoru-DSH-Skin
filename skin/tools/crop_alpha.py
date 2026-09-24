#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把素材按 **alpha 边界**裁掉透明外框。

为什么需要
----------
解包出来的原作背景/立绘**自带宽窄不一的透明外框**：
    实测 A3 背景 3572×2042，有效内容只有 3285×1972（左14 / 上14 / 右287 / 下69）
皮肤用 `object-fit:cover` 铺满视口时，这些透明区**也算进缩放比例** →
有效画面被推偏（出现"贴边黑缝"）+ 整体被放大（发糊）。
裁掉之后 cover 的口径与"看到的画面"一致，窗口任意比例都不留缝。

用法
----
    python skin/tools/crop_alpha.py                 # 试跑，只打印
    python skin/tools/crop_alpha.py --write         # 就地裁切（先备份！）
    python skin/tools/crop_alpha.py --write --dir bg
    python skin/tools/crop_alpha.py --write --dir sprite --pad 0

退出码 0/1，可并进检查套件。
"""
import argparse
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "skin", "assets")
TH = 8  # alpha 阈值：<=8 视为透明（与离线核查脚本同一口径）


def alpha_bbox(im):
    return im.convert("RGBA").getchannel("A").point(lambda v: 255 if v > TH else 0).getbbox()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="就地裁切（默认只试跑）")
    ap.add_argument("--dir", default=None, help="只处理某个子目录（如 bg / sprite）")
    ap.add_argument("--pad", type=int, default=0, help="保留的透明边像素（默认 0）")
    args = ap.parse_args()

    dirs = [os.path.join(ASSETS, args.dir)] if args.dir else [
        os.path.join(ASSETS, "bg"), os.path.join(ASSETS, "sprite")]
    n = skipped = 0
    for d in dirs:
        if not os.path.isdir(d):
            continue
        print("== %s" % os.path.relpath(d, ROOT))
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith(".png"):
                continue
            p = os.path.join(d, f)
            im = Image.open(p)
            if im.mode != "RGBA":
                print("   -  %-34s %s 无 alpha → 跳过" % (f, im.mode))
                skipped += 1
                continue
            bb = alpha_bbox(im)
            if bb is None:
                print("   !  %-34s 整张全透明 → 跳过" % f)
                skipped += 1
                continue
            L, T, R, B = bb
            if args.pad:
                L, T = max(0, L - args.pad), max(0, T - args.pad)
                R, B = min(im.width, R + args.pad), min(im.height, B + args.pad)
            if (L, T, R, B) == (0, 0, im.width, im.height):
                print("   =  %-34s %dx%d 无透明边" % (f, im.width, im.height))
                skipped += 1
                continue
            print("   x  %-34s %dx%d → %dx%d   边距 L%-4d T%-4d R%-4d B%-4d" % (
                f, im.width, im.height, R - L, B - T, L, T, im.width - R, im.height - B))
            if args.write:
                im.crop((L, T, R, B)).save(p)  # PNG 裁切无损，不重采样
                n += 1
    if args.write:
        print("已就地裁切 %d 张（跳过 %d）" % (n, skipped))
    else:
        print("试跑：以上会被裁切（跳过 %d）。加 --write 落盘。" % skipped)


if __name__ == "__main__":
    main()

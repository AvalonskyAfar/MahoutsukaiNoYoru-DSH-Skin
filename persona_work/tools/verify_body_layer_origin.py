#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""验证皮肤立绘确实由 `_00_b` 身体层合成（用于消解 docs/16 红线6 与 docs/19 红线8 的字面冲突）。

判据（★ 第一版判据写错了，记在这免得再犯）：
  · **画布尺寸必须与身体层完全相等** —— 这是 `build_stage_sprites.py` 里
    `win = (0, 0, body.width, body.height)` 的直接后果，也是「按素材画布整张输出」的判据。
  · **alpha bbox 不要求相等**，只要求**被画布包住**：身体层只有躯干，
    脸层会把额头/头发**往上长**，于是立绘 bbox 的上沿会**高于**身体层 bbox 的上沿。
    第一版要求两者 bbox 全等，于是把 A3/A6 误判成"不是身体层合成的" —— 错的。
  · 若立绘是"特写/脸图"，画布尺寸就会与身体层对不上（尺寸相等是强证据）。
"""
import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "hfa_png", "out")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}


def alpha_bbox(p):
    im = Image.open(p).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    return im.size, a.getbbox()


def main():
    m = json.load(open(os.path.join(ROOT, "skin", "data", "manifest.json"), encoding="utf-8"))
    cases = [
        ("A3", "aok", "n", "12", "03"),
        ("A1", "ari", "n", "01", "10"),
        ("A6", "koj", "l", "01", "01"),
        ("A4", "aok", "n", "03", "21"),
        ("A5", "koj", "n", "00", "01"),
    ]
    allok = True
    print("景   角色 批次 i3 通道 | 身体层 _00_b 画布            | 皮肤立绘 画布              | 尺寸相等 | bbox 被包住 | 脸层往上长")
    print("-" * 126)
    for scene, ch, batch, i3, chan in cases:
        body = os.path.join(OUT, DIRS[ch], f"{ch}_{batch}_{i3}_{chan}_00_b.mzp.png")
        names = [os.path.basename(n) for sl in m["expressions"][scene]["slots"].values()
                 for n in sl if f"_c{chan}_" in n]
        if not names:
            print(f"{scene}: 该通道没烘出图")
            continue
        spr = os.path.join(ROOT, "skin", "assets", "sprite", names[0])
        if not os.path.isfile(body):
            print(f"{scene}: 身体层缺失 {os.path.basename(body)}")
            continue
        bs, bb = alpha_bbox(body)
        ss, sb = alpha_bbox(spr)
        same_size = bs == ss
        bb_none = bb is None or sb is None
        contained = (not bb_none) and sb[0] >= bb[0] and sb[1] <= bb[1] and sb[2] <= bb[2] and sb[3] >= bb[3]
        face_grow = (not bb_none) and sb[1] < bb[1]
        allok = allok and same_size and contained
        print(f"{scene:<4} {ch:<4} {batch:<3} {i3:<3} {chan:<3}  | {str(bs):>11}          | "
              f"{str(ss):>11}          |   {'是' if same_size else '否'}     |"
              f"     {'是' if contained else '否'}     |   {'是' if face_grow else '否'}")
    print("-" * 126)
    print("结论：立绘" + ("**确实**" if allok else "**并非**") +
          "由 `_00_b` 身体层合成（画布尺寸全等，且脸层只在画布内往上长）")
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())

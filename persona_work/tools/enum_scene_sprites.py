# -*- coding: utf-8 -*-
"""
enum_scene_sprites.py —— 清点 6 个对话景所需的立绘层次，看每种料各有多少。

对每个 (角色, 服装行 i3)：
  - 脸层（data02100，不带 _b）
  - 身体层（data02100，带 _b）
  - 合成图（data02105，整身已合好）
  - 小缩略（data02020，s_ 前缀 = 合成图的 1/13.5 缩略）
并打印各自的画布尺寸分布 —— 判断"一个身体配多张脸"是否成立。
"""
import collections
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = r"D:\QuickLook插件包\moye\hfa_png\out"

SCENES = [
    ("A3 教室·白天", "aok", "12"),
    ("A4 夜·灯饰通学路", "aok", "03"),
    ("A1/A2 洋房客厅", "ari", "01"),
    ("A5 公园步道·秋", "koj", "00"),
    ("A6 洋馆客室·夜", "koj", "01"),
]


def scan(prefix_char, i3):
    """返回 {dir: {name: size}}，按 kind 分"""
    kinds = {"face": {}, "body": {}, "comp": {}, "thumb": {}}
    for d in sorted(os.listdir(OUT)):
        dd = os.path.join(OUT, d)
        if not os.path.isdir(dd):
            continue
        for f in os.listdir(dd):
            if not f.endswith(".mzp.png"):
                continue
            parts = f[:-len(".mzp.png")].split("_")
            if not parts or parts[0] not in (prefix_char, "s_" + prefix_char):
                continue
            core = parts[1:] if parts[0] == prefix_char else parts[1:]
            if parts[0] == "s_" + prefix_char:
                core = parts[1:]
            # 只看到 i3 为止：<char>_<batch>_<i3>_...
            if len(core) < 3:
                continue
            if core[1] != i3:
                continue
            key = f"{parts[0]}_{core[0]}_{i3}"
            with Image.open(os.path.join(dd, f)) as im:
                size = im.size
            if parts[0].startswith("s_"):
                kinds["thumb"][key] = kinds["thumb"].get(key, 0) + 1
            elif f.endswith("_b.mzp.png"):
                kinds["body"].setdefault(key, collections.Counter())[size] += 1
            elif d == "data02105":
                kinds["comp"].setdefault(key, collections.Counter())[size] += 1
            else:
                kinds["face"].setdefault(key, collections.Counter())[size] += 1
    return kinds


def total(d):
    if not d:
        return 0
    return sum(sum(c.values()) if isinstance(c, collections.Counter) else c for c in d.values())


for label, ch, i3 in SCENES:
    print(f"===== {label}   ({ch}, i3={i3}) =====")
    k = scan(ch, i3)
    print(f"  脸层 : {total(k['face'])} 个")
    for key, c in sorted(k["face"].items()):
        print(f"      {key}: {sum(c.values())} 个，画布 {dict(c.most_common(3))}")
    print(f"  身体层 _b : {total(k['body'])} 个")
    for key, c in sorted(k["body"].items()):
        print(f"      {key}: {sum(c.values())} 个，画布 {dict(c.most_common(3))}")
    print(f"  合成图    : {total(k['comp'])} 个")
    for key, c in sorted(k["comp"].items()):
        print(f"      {key}: {sum(c.values())} 个，画布 {dict(c.most_common(3))}")
    print(f"  缩略 s_   : {total(k['thumb'])} 个")
    print()

#!/usr/bin/env python3
"""scene_data.py — 每个景的原始数据（供交接文档引用）

按 §8 的六个景，逐个从 sprite_sequence.json / 全库立绘里取：
  该景对应章节引用了哪些 (角色, 服装行, 表情码)
输出 markdown，方便贴进文档。
"""
import json, os, re, sys
from collections import defaultdict, Counter

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

# 景 -> 章节清单
SCENES = {
    "A1/A2": ["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"],
    "A3": ["2_1", "2_2", "2_3", "2_4", "2_5"],
    "A4": ["d_8"],
    "A5": ["7_1", "8dot5"],
    "A6": ["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"],
}


def inventory(who, i3):
    """该 (角色, 服装行) 下的全部表情码（跨批次并集）"""
    codes = defaultdict(set)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in os.listdir(dp):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if not m or m.group(1) != who or m.group(3) != i3:
                continue
            codes[m.group(4)].add(m.group(2))
    return codes


def main():
    d = json.load(open(AGG, encoding="utf-8"))
    out = []
    for scene, chs in SCENES.items():
        used = defaultdict(Counter)
        for ch in chs:
            v = d.get(ch)
            if not v:
                continue
            for s in v["sprites"]:
                used[(s["who"], s["i3"])][s["i4"]] += 1
        out.append(f"\n## {scene}  (章节: {', '.join(chs)})\n")
        for (who, i3), c in sorted(used.items()):
            allc = inventory(who, i3)
            out.append(f"### {who} i3={i3}")
            out.append(f"- 全库该行表情码: **{len(allc)}** 个 — {', '.join(sorted(allc))}")
            out.append(f"- 这些章引用过的表情码: **{len(c)}** 个 — " +
                       ", ".join(f"{k}(x{v})" for k, v in sorted(c.items())))
        print("\n".join(out[-40:]) if False else "", end="")
    md = "\n".join(out)
    p = r"D:\QuickLook插件包\moye\persona_work\expressions\scene_data.md"
    open(p, "w", encoding="utf-8").write(md)
    print(md)
    print("\n写出", p)


if __name__ == "__main__":
    main()

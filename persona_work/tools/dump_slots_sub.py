# -*- coding: utf-8 -*-
"""dump_slots_sub.py —— 把前序会话逐帧判好的槽位数据按 (通道, 槽位) 摊开。"""
import collections
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye\persona_work\stage"

for f in ["slots_sub_aok03.json", "slots_sub_aok12.json", "slots_sub_ari01.json"]:
    try:
        d = json.load(open(ROOT + "\\" + f, encoding="utf-8"))
    except Exception as e:
        print(f, "读取失败", e)
        continue
    print(f"===== {f}  共 {len(d)} 条 =====")
    by = collections.defaultdict(list)
    for e in d:
        by[(e.get("i4"), e.get("slot"))].append((e.get("v"), e.get("desc", "")))
    for key in sorted(by.keys(), key=lambda k: (str(k[0]), str(k[1]))):
        ch, slot = key
        vs = by[key]
        desc = "；".join(x[1] for x in vs[:2] if x[1])
        print(f"  通道 {ch:<3} {str(slot):<10} 帧 {' '.join(x[0] for x in vs):<24} {desc[:34]}")
    print()

# -*- coding: utf-8 -*-
"""
pick_channel.py —— 为每个景挑出"主身体"（哪个批次+通道能覆盖最多槽位）。

数据源：persona_work/stage/slots_sub_*.json（逐文件人眼判定的槽位）
        + slots_manual_main.json（主 agent 自己判定的，按景分组）
输出：每个景下 (批次, 通道) -> 覆盖了哪些槽位、缺哪些
"""
import collections
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
STAGE = os.path.join(ROOT, "persona_work", "stage")

SCENES = [
    ("A3 教室·白天", "aok", "12"), ("A4 夜·通学路", "aok", "03"),
    ("A1/A2 洋房客厅", "ari", "01"), ("A5 公园步道·秋", "koj", "00"),
    ("A6 洋馆客室·夜", "koj", "01"),
]
SLOTS = ["neutral", "smile", "angry", "glare", "surprised", "troubled",
         "shy", "serious", "tired", "think", "sad", "laugh"]

entries = []
for f in sorted(os.listdir(STAGE)):
    if not f.startswith("slots_sub_") or not f.endswith(".json"):
        continue
    for e in json.load(open(os.path.join(STAGE, f), encoding="utf-8")):
        e["_src"] = f
        entries.append(e)

print(f"slots_sub_* 共 {len(entries)} 条判定\n")

for label, ch, i3 in SCENES:
    rows = [e for e in entries if e["id"].startswith(f"{ch}_") and
            e["id"].split("_")[2] == i3]
    print(f"===== {label}  ({ch}, i3={i3})  共 {len(rows)} 条 =====")
    by = collections.defaultdict(list)
    for e in rows:
        parts = e["id"].split("_")
        by[(parts[1], parts[3])].append(e)
    scored = []
    for (batch, chan), lst in by.items():
        have = sorted({e["slot"] for e in lst})
        scored.append((len(have), batch, chan, have, lst))
    scored.sort(reverse=True, key=lambda r: r[0])
    for n, batch, chan, have, lst in scored:
        miss = [s for s in SLOTS if s not in have]
        print(f"  batch={batch} 通道={chan}: 覆盖 {n} 槽  {have}")
        print(f"      缺: {miss}")
        for e in lst:
            print(f"      · {e['id']}_{e['v']:<3} {e['slot']:<10} {e.get('desc','')[:28]}")
    print()

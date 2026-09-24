# -*- coding: utf-8 -*-
"""room_frames.py —— 原作在客室相关章节里，金鹿用了哪些帧（照搬原作的调度）。"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
d = json.load(open(ROOT + r"\persona_work\agg\sprite_sequence.json", encoding="utf-8"))

CHAPS = [c for c in d if "room" in c or "wik" in c or c.startswith("8")]
for ch in CHAPS:
    seq = [s for s in d[ch]["sequence"] if s.startswith("koj_")]
    if not seq:
        continue
    groups = {}
    for s in seq:
        p = s.split("_")
        if len(p) >= 5:
            groups.setdefault((p[1], p[3]), []).append(p[4])
    parts = []
    for (b, c), fr in sorted(groups.items()):
        parts.append(f"{b}{c}:{'/'.join(fr)}")
    print(f"{ch:<16} {'  '.join(parts)}")

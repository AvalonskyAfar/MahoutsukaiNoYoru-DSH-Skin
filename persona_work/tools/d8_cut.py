# -*- coding: utf-8 -*-
"""
d8_cut.py —— 按「批次优先级：原作引用过 > n > l > a > m > s」定 A4 的取景。

扫第 13 章全部小节（d_1 … d_8）里 aok 的立绘引用，按 (批次, 通道) 计数。
这就是 spec-switching.md §5.2/§5.3 的"照搬原作"口径。
"""
import collections
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
SEQ = json.load(open(ROOT + r"\persona_work\agg\sprite_sequence.json", encoding="utf-8"))

for prefix, i3 in (("d_", "03"), ("2_", "12")):
    print(f"===== 章 {prefix}* / aok i3={i3} =====")
    tot = collections.Counter()
    per = {}
    for ch in sorted(SEQ):
        if not ch.startswith(prefix):
            continue
        c = collections.Counter()
        for sid in SEQ[ch]["sequence"]:
            p = sid.split("_")
            if len(p) >= 5 and p[0] == "aok" and p[2] == i3:
                c[(p[1], p[3])] += 1
                tot[(p[1], p[3])] += 1
        if c:
            per[ch] = c
    for ch, c in per.items():
        print(f"  {ch:<8} 共{sum(c.values()):<3} " +
              "  ".join(f"{b}{ch2}:{n}" for (b, ch2), n in c.most_common(4)))
    print("  --- 全章合计 ---")
    for (b, ch2), n in tot.most_common(8):
        print(f"    batch={b} 通道={ch2}: {n}")
    print()

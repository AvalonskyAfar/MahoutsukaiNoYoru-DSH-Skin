"""章节标题卡 -> .chs 章节 的反查表。用于确定游戏的权威章节顺序。"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import chapters, usage_map

SKIP = {"staffroll", "test_script", "archive", "opening", "start_script"}
ch = chapters()
u = usage_map(ch)

print("章节标题卡 -> 使用它的 .chs：")
for i in range(408, 424):
    who = sorted(x for x in u.get(i, []) if x not in SKIP)
    print(f"  img{i:04d}  ->  {who if who else '（无）'}")

print()
print("各 .chs 引用的标题卡（用来排章节顺序）：")
for n in sorted(ch):
    if n in SKIP:
        continue
    cards = sorted(i for i in ch[n] if 409 <= i <= 423)
    if cards:
        print(f"  {n:14} 标题卡 = {['img%04d' % c for c in cards]}")

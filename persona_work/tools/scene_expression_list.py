"""
每个景的表情清单：分成「原作实际引用过的」与「该服装行全库可用的」，逐个列出。

用法:
    python scene_expression_list.py A3
    python scene_expression_list.py --all
"""
import json, os, re, sys
from collections import defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

SCENES = {
    "A3": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("aok", "12")]),
    "A4": (["d_8"], [("aok", "03")]),
    "A5": (["7_1", "8dot5"], [("koj", "00"), ("koj", "01"), ("koj", "07")]),
    "A6": (["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"], [("koj", "00"), ("koj", "01"), ("koj", "07")]),
    "A1": (["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"], [("ari", "01")]),
    "A2": (["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"], [("ari", "01")]),
}


def inventory(who, i3):
    d = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if m and m.group(1) == who and m.group(3) == i3:
                d[m.group(4)].append((m.group(2), m.group(5), bool(m.group(6)), f))
    return d


def main():
    data = json.load(open(AGG, encoding="utf-8"))
    want = sys.argv[1:] if sys.argv[1:] != ["--all"] else list(SCENES)
    for scene in want:
        chs, chars = SCENES[scene]
        print(f"\n{'='*74}\n## 景 {scene}   章节 {'+'.join(chs)}\n")
        for who, i3 in chars:
            used = defaultdict(list)
            for ch in chs:
                v = data.get(ch)
                if not v:
                    continue
                for s in v["sprites"]:
                    if s["who"] == who and s["i3"] == i3:
                        used[s["i4"]].append(s["id"])
            inv = inventory(who, i3)
            print(f"### {who} 服装行 i3={i3}")
            print(f"全库该行表情码 {len(inv)} 个: {', '.join(sorted(inv))}")
            print(f"本章节引用过的 {len(used)} 个:\n")
            for i4 in sorted(used):
                ids = sorted(set(used[i4]))
                allids = inv.get(i4, [])
                print(f"  i4={i4}  引用 {len(ids)} 次 / 全库该码共 {len(allids)} 张")
                print(f"     引用过的: {', '.join(ids)}")
                cl = [f"{b}{v}" for b, v, isb, f in allids if not isb]
                fb = [f"{b}{v}" for b, v, isb, f in allids if isb]
                print(f"     全库特写变体: {','.join(cl) if cl else '—'}")
                print(f"     全库全身变体: {','.join(fb) if fb else '—'}")


if __name__ == "__main__":
    main()

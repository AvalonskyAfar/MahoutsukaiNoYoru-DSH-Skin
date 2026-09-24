"""按场景列出「该景对应章节里，原作实际引用过的立绘标识」+ 服装行核对。

用法:
    python scene_sprites.py 2_1 2_2 2_3 2_4 2_5 --who aok --i3 12
    python scene_sprites.py d_8 --who aok --i3 03
    python scene_sprites.py wik_nap wik_room --who koj
"""
import os, re, sys, json
from collections import defaultdict, Counter

AGG = r"D:\QuickLook插件包\moye\persona_work\agg"
SPRITE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")


def load():
    with open(os.path.join(AGG, "sprite_sequence.json"), encoding="utf-8") as f:
        return json.load(f)


def main():
    argv = list(sys.argv[1:])
    who = None
    i3 = None
    if "--who" in argv:
        k = argv.index("--who")
        who = argv[k + 1]
        del argv[k:k + 2]
    if "--i3" in argv:
        k = argv.index("--i3")
        i3 = argv[k + 1]
        del argv[k:k + 2]
    args = argv

    data = load()
    seen = {}
    order = []
    for ch in args:
        v = data.get(ch.lower())
        if not v:
            print(f"!! {ch} 无立绘引用")
            continue
        for s in v["sprites"]:
            if who and s["who"] != who:
                continue
            if i3 and s["i3"] != i3:
                continue
            if s["id"] not in seen:
                seen[s["id"]] = s
                order.append(s["id"])

    print(f"== {'+'.join(args)}  who={who or 'ALL'}  i3={i3 or 'ALL'}")
    print(f"   共 {len(order)} 个立绘标识")
    by_fam = defaultdict(list)
    for s in order:
        d = seen[s]
        by_fam[(d["who"], d["batch"], d["i3"], d["i4"])].append(d)
    for k in sorted(by_fam, key=lambda k: (k[0], k[2], k[3], k[1])):
        items = by_fam[k]
        vars_ = sorted(x["variant"] for x in items)
        full = "＋全身" if any(not x["closeup"] for x in items) else ""
        print(f"   {k[0]}_{k[1]}_{k[2]}_{k[3]}  变体{','.join(vars_)}{full}   {items[0]['file']}")

    print()
    print("== 该范围内各 (角色,i3) 的 (批次,i4) 统计 ==")
    c = Counter()
    for s in order:
        d = seen[s]
        c[(d["who"], d["i3"], d["i4"])] += 1
    for (w, r, e), n in sorted(c.items()):
        print(f"   {w} i3={r} i4={e}  x{n}")


if __name__ == "__main__":
    main()

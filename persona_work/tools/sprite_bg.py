"""从 .chs 剧本反查「章节 -> 用到的立绘（角色_服装）」。

立绘文件名形如 aok_a_02_02_00（角色_服装_姿态_表情_变体），
.chs 字节码的字符串表里直接带这些名字 —— 所以"哪一章穿哪套衣服"可以直接查实。

用法:
    python sprite_bg.py list aok                 # 每个章节用到的 aok 服装
    python sprite_bg.py outfits aok              # 每个服装组被哪些章节使用
    python sprite_bg.py find aok_n               # 某个服装组出现在哪些章节
    python sprite_bg.py all                      # 三个角色一起
"""
import os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import CHS, PAT

SPRITE = re.compile(r"([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})")


def scan():
    """章节 -> {(角色, 服装): set(文件名)}"""
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if not f.lower().endswith(".chs"):
                continue
            d = open(os.path.join(dp, f), "rb").read()
            hits = defaultdict(set)
            for m in PAT.finditer(d):
                for g in SPRITE.finditer(m.group().decode("ascii", "replace")):
                    who, outfit = g.group(1), g.group(2)
                    hits[(who, outfit)].add(g.group(0))
            if hits:
                res[f[:-4].lower()] = hits
    return res


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    data = scan()

    if cmd == "list":
        who = sys.argv[2]
        for n in sorted(data):
            os_ = sorted(o for (w, o) in data[n] if w == who)
            if os_:
                detail = ", ".join(f"{o}({len(data[n][(who,o)])}张)" for o in os_)
                print(f"  {n:16} {detail}")
    elif cmd == "outfits":
        who = sys.argv[2]
        agg = defaultdict(set)
        for n, hits in data.items():
            for (w, o) in hits:
                if w == who:
                    agg[o].add(n)
        for o in sorted(agg):
            chs = sorted(agg[o])
            print(f"  {who}_{o}:  {len(chs)} 个章节")
            print(f"      {', '.join(chs)}")
    elif cmd == "find":
        w, o = sys.argv[2].split("_")
        chs = sorted(n for n, h in data.items() if (w, o) in h)
        n_files = set()
        for n in chs:
            n_files |= data[n][(w, o)]
        print(f"  {w}_{o} 出现在 {len(chs)} 个章节：{', '.join(chs)}")
        print(f"  涉及 {len(n_files)} 个立绘文件")
        for x in sorted(n_files)[:12]:
            print("     ", x)
    else:
        for who in ("aok", "ari", "kin"):
            agg = defaultdict(set)
            for n, hits in data.items():
                for (w, o) in hits:
                    if w == who:
                        agg[o].add(n)
            print(f"== {who}: 服装组 {sorted(agg)}")


if __name__ == "__main__":
    main()

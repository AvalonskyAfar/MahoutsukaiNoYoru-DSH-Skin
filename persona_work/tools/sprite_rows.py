"""更细的立绘反查：章节 -> (批次字母, i3 姿态行)。

立绘名 = <角色>_<批次>_<i3>_<i4>_<变体>，其中 **i3 才是真正的"服装/姿态"键**，
批次字母只是归档分卷。本工具把每章用到的 (批次, i3) 列出来，
并统计每个 (批次, i3) 被多少章共用 —— 共用越少，越能锁定"这一章专属的那套衣服"。

用法:
    python sprite_rows.py aok a_1              # 第10章 青子用到哪些 (批次,i3)
    python sprite_rows.py aok d_2 d_8          # 最终章几个分片
    python sprite_rows.py aok --rare 2_1 2_2   # 这几章共用、别处罕见的行
"""
import os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import CHS, PAT

SPRITE = re.compile(r"([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})")


def scan():
    """章节 -> {(角色, 批次, i3): set(完整立绘名)}"""
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if not f.lower().endswith(".chs"):
                continue
            d = open(os.path.join(dp, f), "rb").read()
            hits = defaultdict(set)
            for m in PAT.finditer(d):
                for g in SPRITE.finditer(m.group().decode("ascii", "replace")):
                    who, batch, i3, i4, var = g.groups()
                    hits[(who, batch, int(i3))].add(g.group(0))
            if hits:
                res[f[:-4].lower()] = hits
    return res


def usage(data):
    u = defaultdict(set)
    for n, h in data.items():
        for k in h:
            u[k].add(n)
    return u


def main():
    data = scan()
    who = sys.argv[1]
    args = sys.argv[2:]
    u = usage(data)

    if args and args[0] == "--rare":
        names = [a.lower() for a in args[1:]]
        pool = defaultdict(set)
        for n in names:
            for k, v in data.get(n, {}).items():
                if k[0] == who:
                    pool[k] |= v
        rows = []
        for k, files in pool.items():
            others = [x for x in u[k] if x not in names]
            rows.append((len(others), k, len(files)))
        rows.sort()
        print("== %s 在 %s 用到的姿态行（按「别处罕见」排序）" % (who, "/".join(names)))
        for n, k, nf in rows:
            print(f"   {k[1]}{k[2]:02d}   别处出现 {n:3} 章   本组立绘 {nf} 张")
        return

    for n in args:
        h = data.get(n.lower())
        if not h:
            print(f"  {n}: 无立绘引用")
            continue
        rows = sorted(k[2] for k in h if k[0] == who)
        detail = []
        for i3 in rows:
            batches = sorted(k[1] for k in h if k[0] == who and k[2] == i3)
            for b in batches:
                nf = len(h[(who, b, i3)])
                shared = len(u[(who, b, i3)]) - 1
                detail.append(f"{b}{i3:02d}({nf}张,别处{shared}章)")
        print(f"  {n:16} {who}: {', '.join(detail)}")


if __name__ == "__main__":
    main()

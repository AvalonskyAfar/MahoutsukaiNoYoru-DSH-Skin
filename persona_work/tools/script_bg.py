"""从 .chs 剧本反查「章节 -> 背景图编号」

魔法使之夜的 .chs 是 HunexCompiledScriptVer1.00 字节码，字符串操作数里直接
带背景图编号（img0387 之类）。本工具把每个章节脚本引用到的 imgNNNN 抽出来，
并统计"这张图被多少个章节共用"，从而把通用图（黑场/转场）和场景专用图分开。

用法:
    python script_bg.py list                      # 所有章节 -> 编号数
    python script_bg.py show 2_1 2_2 2_3          # 指定章节引用的图 + 共用度
    python script_bg.py rare 2_1 2_2 2_3 2_4 2_5  # 只列这些章共用、别处罕见的图
    python script_bg.py find 0387                 # 哪些章节用了 img0387
    python script_bg.py where 0387                # 该编号在哪些归档里
"""
import os, re, sys
from collections import defaultdict

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
OUT = r"D:\QuickLook插件包\moye\hfa_png\out"
PAT = re.compile(rb"[ -~]{4,}")
IMG = re.compile(r"img(\d{3,4})", re.I)


def chapters():
    """章节名 -> set(编号)"""
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if not f.lower().endswith(".chs"):
                continue
            d = open(os.path.join(dp, f), "rb").read()
            ids = set()
            for m in PAT.finditer(d):
                for g in IMG.finditer(m.group().decode("ascii", "replace")):
                    ids.add(int(g.group(1)))
            res[f[:-4].lower()] = ids
    return res


def usage_map(ch):
    u = defaultdict(list)
    for name, ids in ch.items():
        for i in ids:
            u[i].append(name)
    return u


def archives_of(i):
    out = []
    for d in sorted(os.listdir(OUT)):
        dp = os.path.join(OUT, d)
        if not os.path.isdir(dp):
            continue
        if any(re.match(r"img%04d(\(\d+\))?\." % i, f) for f in os.listdir(dp)):
            out.append(d)
    return out


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    ch = chapters()
    u = usage_map(ch)

    if cmd == "list":
        for name in sorted(ch):
            print(f"{name:18} {len(ch[name]):4} 张")
    elif cmd == "show":
        for name in sys.argv[2:]:
            ids = sorted(ch.get(name.lower(), []))
            print(f"== {name}  ({len(ids)} 张)")
            for i in ids:
                print(f"   img{i:04d}  被他章共用 {len(u[i])-1:3} 次  归档={','.join(archives_of(i)) or '不在已解包素材里'}")
    elif cmd == "rare":
        names = [n.lower() for n in sys.argv[2:]]
        pool = set()
        for n in names:
            pool |= ch.get(n, set())
        rows = []
        for i in sorted(pool):
            others = [x for x in u[i] if x not in names]
            rows.append((len(others), i, others))
        rows.sort()
        print("== %s 专用候选（按「别处罕见」排序）" % "/".join(names))
        for n, i, others in rows:
            print(f"   img{i:04d}  别处出现 {n:3} 次  归档={','.join(archives_of(i)) or '【无】'}")
    elif cmd == "find":
        i = int(sys.argv[2])
        print(f"img{i:04d} 被以下章节引用：", sorted(u.get(i, [])))
    elif cmd == "where":
        i = int(sys.argv[2])
        print(f"img{i:04d} ->", archives_of(i))


if __name__ == "__main__":
    main()

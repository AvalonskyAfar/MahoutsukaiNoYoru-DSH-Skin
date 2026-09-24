"""列出 .chs 里的 BGM 引用（字符串以 BGM 开头）及其所属章节。

用法:
    python bgm_ref.py            # BGM 字符串 -> 章节
    python bgm_ref.py chapter    # 章节 -> BGM 字符串
    python bgm_ref.py <章节...>  # 指定章节
"""
import os, re, sys
from collections import defaultdict

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
PAT = re.compile(rb"[ -~]{3,}")
BGM = re.compile(r"BGM[A-Za-z0-9_]*")


def scan():
    """章节 -> set(BGM 字符串)"""
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if not f.lower().endswith(".chs"):
                continue
            d = open(os.path.join(dp, f), "rb").read()
            hits = set()
            for m in PAT.finditer(d):
                for g in BGM.finditer(m.group().decode("ascii", "replace")):
                    hits.add(g.group(0))
            res[f[:-4].lower()] = hits
    return res


def main():
    data = scan()
    args = sys.argv[1:]

    if args and args[0] == "chapter":
        for n in sorted(data):
            if data[n]:
                print(f"  {n:16} {', '.join(sorted(data[n]))}")
        return

    if args:
        for n in args:
            h = data.get(n.lower(), set())
            print(f"  {n:16} {', '.join(sorted(h)) if h else '（无 BGM 引用）'}")
        return

    rev = defaultdict(set)
    for n, hs in data.items():
        for s in hs:
            rev[s].add(n)
    print(f"共 {len(rev)} 种 BGM 引用串：\n")
    for s in sorted(rev):
        chs = sorted(rev[s])
        print(f"  {s:14} 出现在 {len(chs):3} 个章节")
        print(f"      {', '.join(chs)}")


if __name__ == "__main__":
    main()

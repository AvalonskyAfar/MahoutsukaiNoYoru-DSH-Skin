"""从 .chs 剧本反查「章节 -> 用到的 BGM / 音效」。

BGM = data03000.hfa 的 m01.hw ~ m63.hw + x_m64.hw
SE  = data03100.hfa 的 se*.hw / mixse_<章>_*.hw / editse_<章>_*.hw

用法:
    python bgm_bg.py list                 # 每个章节引用了哪些 BGM
    python bgm_bg.py find m07             # 某首 BGM 出现在哪些章节
    python bgm_bg.py chapter 2_1 2_2      # 指定章节的 BGM + mixse/editse
    python bgm_bg.py order                # 列出所有出现的 mNN，看编号覆盖
"""
import os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import CHS, PAT

BGM = re.compile(r"\bx_m(\d{2})\b|\bm(\d{2})\b")
MIX = re.compile(r"\b(?:mixse|editse)_([0-9a-z]+)_(\d+)\b")


def scan():
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if not f.lower().endswith(".chs"):
                continue
            d = open(os.path.join(dp, f), "rb").read()
            bgm, mix = set(), set()
            for m in PAT.finditer(d):
                s = m.group().decode("ascii", "replace")
                for g in BGM.finditer(s):
                    bgm.add(int(g.group(1) or g.group(2)))
                for g in MIX.finditer(s):
                    mix.add(g.group(0))
            res[f[:-4].lower()] = (bgm, mix)
    return res


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    data = scan()

    if cmd == "list":
        for n in sorted(data):
            bgm, mix = data[n]
            if not bgm and not mix:
                continue
            b = ",".join(f"m{v:02d}" for v in sorted(bgm)) or "-"
            print(f"  {n:16} BGM[{b}]  mix/edit={len(mix)}")
    elif cmd == "find":
        want = int(sys.argv[2].lstrip("mx_"))
        chs = sorted(n for n, (b, _) in data.items() if want in b)
        print(f"  m{want:02d} 出现在 {len(chs)} 个章节：{', '.join(chs)}")
    elif cmd == "chapter":
        for n in sys.argv[2:]:
            b, mix = data.get(n.lower(), (set(), set()))
            print(f"== {n}")
            print(f"   BGM: {', '.join('m%02d' % v for v in sorted(b)) or '（无）'}")
            print(f"   mix/edit: {', '.join(sorted(mix)) or '（无）'}")
    elif cmd == "order":
        allb = set()
        for b, _ in data.values():
            allb |= b
        print("剧本里出现过的 BGM 编号：")
        print("  ", ", ".join("m%02d" % v for v in sorted(allb)))
        print("   共", len(allb), "首（data03000 里有 m01~m63 + x_m64）")


if __name__ == "__main__":
    main()

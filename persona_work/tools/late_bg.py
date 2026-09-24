"""找出「后期章节专用」的背景图编号。

思路：一个场景图如果只被后期章节（9 / a / b / c / d）引用、而 1~8 章从不引用，
那它大概率就是最终章新增的场景（街道、老家门口之类）。

用法:
    python late_bg.py               # 默认：后期章 = 9_,a_,b_,c_,d_；早期章 = 1_~8_
    python late_bg.py 9_ a_ b_ c_ d_ --early 1_ 2_ 3_ 4_ 5 6_ 7_ 8
输出按归档聚合，便于逐个导出看图。
"""
import os, re, sys, struct
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import chapters, archives_of

OUT = r"D:\QuickLook插件包\moye\hfa_png\out"

LATE = ("9_", "a_", "b_", "c_", "d_")
EARLY = ("1_", "1dot5", "2_", "3_", "4_", "5", "6_", "7_", "8")


def png_size(arch, i):
    dp = os.path.join(OUT, arch)
    for f in os.listdir(dp):
        if re.match(r"img0*%d(?![0-9])" % i, f):
            h = open(os.path.join(dp, f), "rb").read(26)
            w, hh = struct.unpack(">II", h[16:24])
            return w, hh
    return None


def main():
    ch = chapters()
    late = {n: v for n, v in ch.items() if n.startswith(LATE)}
    early_pool = set()
    for n, v in ch.items():
        if n.startswith(EARLY):
            early_pool |= v

    only_late = defaultdict(list)
    for n, ids in late.items():
        for i in ids:
            if i not in early_pool:
                only_late[i].append(n)

    print(f"只在后期章出现、1~8 章从不引用的编号：{len(only_late)} 个\n")
    by_arch = defaultdict(list)
    for i in sorted(only_late):
        archs = archives_of(i)
        a = archs[0] if archs else "?"
        by_arch[a].append(i)

    for a in sorted(by_arch):
        ids = by_arch[a]
        print(f"===== {a}  ({len(ids)} 个)")
        for i in ids:
            sz = png_size(a, i) if a != "?" else None
            bigger = sz and (sz[0] >= 2500 or sz[1] >= 1800)
            mark = "  <== 大画布" if bigger else ""
            print(f"   img{i:04d}  {('%dx%d' % sz) if sz else '不在素材里':>12}  后期章={','.join(sorted(only_late[i]))}{mark}")


if __name__ == "__main__":
    main()

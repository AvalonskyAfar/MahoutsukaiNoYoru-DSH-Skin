# -*- coding: utf-8 -*-
"""
chapter_cuts.py —— 看原作在指定章节里到底用了哪个 (批次, 通道) 组合。

这就是"照搬原作"：chapter 的立绘引用序列 -> 按 (角色, 批次, 通道) 计数
-> 出现最多的那个就是这一场的**主镜头**（body 不动的那个）。
同时打印帧的变化情况（帧号序列 = 表情调度）。

用法:
  python persona_work/tools/chapter_cuts.py 2_3 2_4 d_8
  python persona_work/tools/chapter_cuts.py --prefix 2_ --char aok
  python persona_work/tools/chapter_cuts.py --all-chapters-of aok 03
"""
import collections
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
SEQ = json.load(open(os.path.join(ROOT, "persona_work", "agg", "sprite_sequence.json"),
                     encoding="utf-8"))


def dump(chapter, char=None):
    info = SEQ.get(chapter)
    if not info:
        print(f"[{chapter}] 不存在")
        return
    seq = info["sequence"]
    if char:
        seq = [s for s in seq if s.startswith(char + "_")]
    grp = collections.Counter()
    frames = collections.defaultdict(list)
    for sid in seq:
        p = sid.split("_")
        if len(p) < 5:
            continue
        grp[(p[0], p[1], p[3])] += 1
        frames[(p[0], p[1], p[3])].append(p[4])
    print(f"=== {chapter}（共 {info['count']} 条引用，本次统计 {len(seq)} 条）===")
    for (ch, batch, chan), n in grp.most_common(10):
        fr = frames[(ch, batch, chan)]
        print(f"  {ch}_{batch}_{chan}: {n} 次   帧序 {' '.join(fr[:24])}")
    print()


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return
    if a[0] == "--prefix":
        pre, char = a[1], (a[3] if len(a) > 3 else None)
        for k in sorted(SEQ):
            if k.startswith(pre):
                dump(k, char)
        return
    if a[0] == "--all-chapters-of":
        char, i3 = a[1], a[2]
        for k in sorted(SEQ):
            d = dump.__wrapped__ if False else None
            seq = SEQ[k]["sequence"]
            hit = [s for s in seq if s.startswith(char + "_") and
                   len(s.split("_")) >= 5 and s.split("_")[2] == i3]
            if hit:
                dump(k, char)
        return
    for c in a:
        dump(c)


if __name__ == "__main__":
    main()

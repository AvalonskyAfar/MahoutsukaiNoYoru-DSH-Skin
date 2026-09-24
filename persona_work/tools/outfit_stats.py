"""统计各角色「服装 -> 姿态行 x 表情数」，用于核实 A4 的备选判据
（交接文件 §9 风险 2：穿羽绒服的青子表情是否比较少）

用法: python outfit_stats.py [角色前缀，默认 aok]
"""
import os, re, sys
from collections import defaultdict

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
CH = sys.argv[1] if len(sys.argv) > 1 else "aok"

d = defaultdict(lambda: defaultdict(set))
for arch in sorted(os.listdir(ROOT)):
    dp = os.path.join(ROOT, arch)
    if not os.path.isdir(dp):
        continue
    for f in os.listdir(dp):
        n = f.replace(".mzp.png", "").replace(".cbg.png", "")
        m = re.match(rf"^{CH}_([a-z])_(\d+)_(\d+)_(\d+)$", n)
        if m:
            of, i3, i4, _ = m.groups()
            d[of][int(i3)].add(int(i4))

print(f"角色={CH}   服装字母 -> 姿态行 / 每行表情数")
for of in sorted(d):
    rows = sorted(d[of])
    tot = sum(len(v) for v in d[of].values())
    detail = ", ".join(f"i3={k:02d}:{len(d[of][k])}表情" for k in rows)
    print(f"  {CH}_{of}:  行数={len(rows):2}  表情槽合计={tot:3}   [{detail}]")

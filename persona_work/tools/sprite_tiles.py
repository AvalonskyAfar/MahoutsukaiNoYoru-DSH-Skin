"""统计立绘的「画布尺寸档位」（tile 尺格）—— 站位规格的实测依据。

观察：解包出的 PNG 画布不是单一尺寸，而是一套「尺格」：
  特写档  ~ 380x510 / 758x1018 / 1136x1018 / 1262x1018 / 1010x1018
  全身档  ~ 380x1272 / 506x1272 / 632x1272 / 1010x1272 / 2018x5844（上下拼接）
"内容 bbox" 只是 alpha 裁切的结果，**不能**当作立绘的固有尺寸；
固有尺寸是画布尺寸。站位/缩放必须按画布算。

用法:
    python sprite_tiles.py aok 12 03
    python sprite_tiles.py koj 00 01
"""
import os, re, sys, json
from collections import defaultdict
from PIL import Image

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")


def main():
    who = sys.argv[1]
    i3s = sys.argv[2:]
    tiles = defaultdict(lambda: defaultdict(int))
    files = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if not m or m.group(1) != who:
                continue
            if i3s and m.group(3) not in i3s:
                continue
            im = Image.open(os.path.join(dp, f))
            key = ("_b" if m.group(6) else "closeup", im.size)
            tiles[key][m.group(3)] += 1
            if len(files[key]) < 3:
                files[key].append(f)
            im.close()

    print(f"{who} 画布档位 (kind x i3):")
    all_i3 = sorted({i for k in tiles for i in tiles[k]})
    for (kind, size), per in sorted(tiles.items()):
        cells = "  ".join(f"{i}:{per.get(i, 0):3}" for i in all_i3)
        print(f"   {kind:8} {size[0]:5}x{size[1]:<5}  {cells}   e.g. {files[(kind,size)][0]}")
    print()
    # 按镜头汇总画布
    for kind in ("closeup", "_b"):
        sizes = defaultdict(int)
        for (k, size), per in tiles.items():
            if k == kind:
                sizes[size] += sum(per.values())
        print(f"   {kind} 画布分布:")
        for s, n in sorted(sizes.items(), key=lambda x: -x[1]):
            print(f"      {s[0]:5}x{s[1]:<5} x{n}")


if __name__ == "__main__":
    main()

"""验证「按内容 bbox 裁切后，脸的位置是否一致」。

做法：检测「眼睛」——青子/金鹿/有珠的虹膜是画面里**饱和的蓝色/绿色**像素。
取内容 bbox 内蓝色像素的重心，看它在归一化内容坐标里的分布。
若各图重心集中，说明 bbox 锚点是稳的。

用法: python eye_anchor.py aok 12
"""
import os, re, sys, statistics
from collections import defaultdict
from PIL import Image

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")


def eye_center(path):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    box = a.getbbox()
    if not box:
        return None
    im = im.crop(box)
    w, h = im.size
    px = im.load()
    sx = sy = n = 0
    step = max(1, w // 160)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b, al = px[x, y]
            if al < 200:
                continue
            # 青/蓝虹膜：蓝明显高于红，且够亮
            if b > 110 and b - r > 40 and g > 60:
                sx += x
                sy += y
                n += 1
    if n < 20:
        return None
    return (sx / n / w, sy / n / h, n, (w, h))


def main():
    who, i3 = sys.argv[1], sys.argv[2]
    res = []
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if not m or m.group(1) != who or m.group(3) != i3 or m.group(6):
                continue
            r = eye_center(os.path.join(dp, f))
            if r:
                res.append((f, r))
    print(f"{who} i3={i3}: {len(res)} 张测到眼睛")
    if not res:
        return
    xs = [r[1][0] for r in res]
    ys = [r[1][1] for r in res]
    print(f"   眼重心 x: {min(xs):.3f} ~ {max(xs):.3f}  中位 {statistics.median(xs):.3f}  stdev {statistics.pstdev(xs):.3f}")
    print(f"   眼重心 y: {min(ys):.3f} ~ {max(ys):.3f}  中位 {statistics.median(ys):.3f}  stdev {statistics.pstdev(ys):.3f}")
    outliers = [r for r in res if abs(r[1][0] - statistics.median(xs)) > 0.08 or abs(r[1][1] - statistics.median(ys)) > 0.10]
    print(f"   偏离中位较多的 {len(outliers)} 张：")
    for f, r in outliers[:20]:
        print(f"      {f:34} x={r[1][0]:.3f} y={r[1][1]:.3f} n={r[1][2]}")


if __name__ == "__main__":
    main()

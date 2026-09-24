"""眼锚点检测 v3：排除「深色且高饱和」的头发/黑衣，只留真正的虹膜。

v2 的问题：黑色长发（饱和度也可以很高、亮度低）被算成虹膜，导致 ey 偏小。
v3 加两条约束：
  ① 亮度下限提高（mx > 95），把黑发/黑衣排掉；
  ② 只统计**彩色**虹膜（max-min 够大），并把描边（近黑）排掉。
另外用「连通性」约束：只保留离图中位数最近的 60% 像素（去掉零散噪声）。
"""
import os, re, sys, json, statistics
from collections import defaultdict
from PIL import Image

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
CACHE = r"D:\QuickLook插件包\moye\persona_work\stage\eye_anchor.json"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")


def iris_center(path):
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if not box:
        return None
    im = im.crop(box)
    w, h = im.size
    px = im.load()
    pts = []
    step = max(1, w // 220)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b, al = px[x, y]
            if al < 220:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mx <= 95 or mx >= 240:
                continue
            sat = (mx - mn) / mx
            if sat < 0.30:
                continue
            if mx - mn < 45:
                continue
            pts.append((x, y))
    if len(pts) < 25:
        return None
    # 去掉离中位数太远的散点（保留中间 70%）
    mx_ = statistics.median(p[0] for p in pts)
    my_ = statistics.median(p[1] for p in pts)
    pts2 = sorted(pts, key=lambda p: (p[0] - mx_) ** 2 + (p[1] - my_) ** 2)
    keep = pts2[: max(25, int(len(pts2) * 0.70))]
    sx = sum(p[0] for p in keep) / len(keep)
    sy = sum(p[1] for p in keep) / len(keep)
    return {"ex": round(sx / w, 4), "ey": round(sy / h, 4),
            "n": len(keep), "w": w, "h": h, "bbox": list(box)}


def main():
    only = None
    for i, a in enumerate(sys.argv):
        if a == "--who":
            only = set(sys.argv[i + 1].split(","))
    cache = {}
    n_new = 0
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            n = f.replace(".mzp.png", "")
            m = SINGLE.match(n)
            if not m or m.group(6):
                continue
            if only and m.group(1) not in only:
                continue
            r = iris_center(os.path.join(dp, f))
            if r:
                cache[n] = r
                n_new += 1
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"眼锚点缓存 v3: {len(cache)} 条")
    agg = defaultdict(list)
    for k, v in cache.items():
        m = SINGLE.match(k)
        if m:
            agg[(m.group(1), m.group(3))].append((v["ex"], v["ey"], v["n"]))
    print("\n(角色, 服装行) 眼重心分布（中位 ± 标准差）：")
    for key in sorted(agg):
        rows = agg[key]
        if len(rows) < 4:
            continue
        ex = [r[0] for r in rows]
        ey = [r[1] for r in rows]
        nn = statistics.median(r[2] for r in rows)
        print(f"  {key[0]:4} i3={key[1]}: {len(rows):4} 张  "
              f"ex {statistics.median(ex):.3f}±{statistics.pstdev(ex):.3f}  "
              f"ey {statistics.median(ey):.3f}±{statistics.pstdev(ey):.3f}  n中位 {nn:.0f}")


if __name__ == "__main__":
    main()

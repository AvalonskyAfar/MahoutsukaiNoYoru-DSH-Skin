"""量立绘的画布与内容几何（只看**单帧**，排除图集页）。

图集页的识别：名字里数字段比标准多（如 `aok_a_12_02_00_01_01.mzp.png`
= 2x2 图集，tile 380x256）。标准单帧是 `角色_批次_行_表情_变体[_b]`。
"""
import os, re, sys, json, statistics
from collections import defaultdict
from PIL import Image

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\expressions\geometry.json"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")
ATLAS = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(_b)?$")


def gather(who=None, i3s=None):
    single, atlas = defaultdict(list), defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            n = f.split(".mzp.png")[0]
            m = SINGLE.match(n)
            if m:
                if who and m.group(1) != who:
                    continue
                if i3s and m.group(3) not in i3s:
                    continue
                single[(m.group(1), m.group(3), bool(m.group(6)))].append(os.path.join(dp, f))
                continue
            m2 = ATLAS.match(n)
            if m2:
                if who and m2.group(1) != who:
                    continue
                if i3s and m2.group(3) not in i3s:
                    continue
                atlas[(m2.group(1), m2.group(3), bool(m2.group(8)))].append(os.path.join(dp, f))
    return single, atlas


def measure(paths):
    rows = []
    for p in paths:
        im = Image.open(p)
        box = im.getchannel("A").getbbox()
        rows.append({
            "file": p.replace(ROOT + os.sep, "").replace("\\", "/"),
            "canvas": list(im.size),
            "bbox": list(box) if box else None,
        })
        im.close()
    return rows


def summarize(rows, title):
    if not rows:
        print(f"{title}: 无")
        return
    print(f"== {title}  ({len(rows)} 张单帧)")
    canv = defaultdict(int)
    for r in rows:
        canv[tuple(r["canvas"])] += 1
    for c, n in sorted(canv.items(), key=lambda x: -x[1])[:8]:
        print(f"   画布 {c[0]:5}x{c[1]:5}  x{n}")
    xs0 = [r["bbox"][0] for r in rows if r["bbox"]]
    ys0 = [r["bbox"][1] for r in rows if r["bbox"]]
    xs1 = [r["bbox"][2] for r in rows if r["bbox"]]
    ys1 = [r["bbox"][3] for r in rows if r["bbox"]]
    if xs0:
        print(f"   bbox x0 {min(xs0)}~{max(xs0)} (中位 {statistics.median(xs0)})"
              f"   x1 {min(xs1)}~{max(xs1)} (中位 {statistics.median(xs1)})")
        print(f"   bbox y0 {min(ys0)}~{max(ys0)} (中位 {statistics.median(ys0)})"
              f"   y1 {min(ys1)}~{max(ys1)} (中位 {statistics.median(ys1)})")
        wt = [r["bbox"][2] - r["bbox"][0] for r in rows if r["bbox"]]
        ht = [r["bbox"][3] - r["bbox"][1] for r in rows if r["bbox"]]
        print(f"   内容尺寸 w {min(wt)}~{max(wt)} (中位 {statistics.median(wt)})"
              f"   h {min(ht)}~{max(ht)} (中位 {statistics.median(ht)})")


def main():
    argv = list(sys.argv[1:])
    who = argv[0]
    i3s = [a for a in argv[1:] if not a.startswith("--")] or None
    single, atlas = gather(who, i3s)
    allrows = {}
    for key in sorted(single, key=lambda k: (k[1], k[2])):
        w, i3, b = key
        rows = measure(single[key])
        summarize(rows, f"{w} i3={i3} {'_b 全身' if b else '特写'}")
        allrows[f"{w}_{i3}{'_b' if b else ''}"] = rows
    for key in sorted(atlas, key=lambda k: (k[1], k[2])):
        w, i3, b = key
        rows = measure(atlas[key])
        summarize(rows, f"【图集页】{w} i3={i3} {'_b' if b else ''}")

    old = {}
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding="utf-8"))
    old.update(allrows)
    json.dump(old, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", OUT)


if __name__ == "__main__":
    main()

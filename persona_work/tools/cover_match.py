"""章节封面缩略图 -> 全尺寸原图 的匹配器。

思路：封面缩略图（353x199）多半是某一章某张大图的等比缩小版。
把该章 .chs 引用到的所有图都缩到同尺寸，算归一化后的差异，取最接近的几张。

用法:
    python cover_match.py 5b-7 5b_7          # 封面 data00000/5b-7.mzp.png 对 5b_7.chs 的图
    python cover_match.py 5b-7 5b_7 5b_6 --top 8
"""
import os, re, sys, struct
from PIL import Image, ImageChops

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_bg import chapters

OUT = r"D:\QuickLook插件包\moye\hfa_png\out"
COVER = os.path.join(OUT, "data00000")
TH = (128, 72)

_idx = {}
for d in sorted(os.listdir(OUT)):
    dp = os.path.join(OUT, d)
    if not os.path.isdir(dp):
        continue
    for f in os.listdir(dp):
        m = re.match(r"img0*(\d+)(?![0-9])", f)
        if m:
            _idx.setdefault(int(m.group(1)), (d, f))


def load_flat(p):
    im = Image.open(p)
    box = im.getchannel("A").getbbox() if im.mode in ("RGBA", "LA") else None
    im = im.convert("RGBA")
    if box:
        im = im.crop(box)
    bg = Image.new("RGB", im.size, (0, 0, 0))
    bg.paste(im, (0, 0), im)
    return bg


def sig(im):
    """归一化灰度签名：缩到 TH 后减均值、除标准差，抵消色偏与亮度差"""
    g = im.convert("L").resize(TH, Image.LANCZOS)
    px = list(g.getdata())
    n = len(px)
    mu = sum(px) / n
    var = sum((v - mu) ** 2 for v in px) / n
    sd = var ** 0.5 or 1.0
    return [(v - mu) / sd for v in px]


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) / len(a)


def main():
    cover = sys.argv[1]
    chs = [a.lower() for a in sys.argv[2:]]
    top = 8
    if "--top" in chs:
        i = chs.index("--top")
        top = int(chs[i + 1])
        chs = chs[:i]
    allmode = "--all" in chs
    chs = [c for c in chs if not c.startswith("--")]

    cp = os.path.join(COVER, cover if cover.endswith(".png") else cover + ".mzp.png")
    if not os.path.exists(cp):
        print("找不到封面", cp)
        return
    csig = sig(load_flat(cp))
    print(f"封面 {cover}  内容尺寸 {load_flat(cp).size}", flush=True)

    ch = chapters()
    if allmode:
        ids = set(_idx)
        print(f"比对范围：全库 {len(ids)} 个编号", flush=True)
    else:
        ids = set()
        for n in chs:
            ids |= ch.get(n, set())
        print(f"比对范围：章节 {'/'.join(chs)} 共 {len(ids)} 个编号\n", flush=True)

    jobs = [(i, _idx[i]) for i in sorted(ids) if i in _idx]
    rows = []
    n = 0
    for i, (arch, fn) in jobs:
        r = _worker((csig, i, arch, fn))
        if r:
            rows.append(r)
        n += 1
        if n % 200 == 0:
            print(f"  ...已比对 {n}/{len(jobs)}", flush=True)
    rows.sort()
    for d, i, arch, fn, w, hh in rows[:top]:
        flag = "  ★大画布" if w >= 2500 else ""
        print(f"  差异={d:7.4f}  img{i:04d}  {w}x{hh:<6} {arch}/{fn}{flag}")


def _worker(job):
    csig, i, arch, fn = job
    try:
        s = sig(load_flat(os.path.join(OUT, arch, fn)))
    except Exception:
        return None
    with open(os.path.join(OUT, arch, fn), "rb") as fh:
        h = fh.read(26)
    w, hh = struct.unpack(">II", h[16:24])
    return (dist(csig, s), i, arch, fn, w, hh)


if __name__ == "__main__":
    main()

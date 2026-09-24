"""把变体矩阵切片（按 i4 分组，每组若干行），便于逐张查看。"""
import os, sys, json
from PIL import Image

OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
CELL, LAB, HEAD = 170, 26, 46


def split(path, groups_per=4):
    im = Image.open(path)
    name = os.path.basename(path)
    # 从文件名解析行数
    rows = (im.height - HEAD) // (CELL + LAB)
    n = 0
    idx = []
    y0 = HEAD
    while n < rows:
        y2 = min(im.height, HEAD + (n + groups_per) * (CELL + LAB))
        crop = im.crop((0, y0, im.width, y2))
        out = os.path.join(OUTDIR, name.replace(".jpg", f"_g{n // groups_per + 1}.jpg"))
        crop.save(out, quality=90)
        idx.append((os.path.basename(out), crop.size))
        n += groups_per
        y0 = y2
    for o, s in idx:
        print("  ", o, s)
    return idx


if __name__ == "__main__":
    idx = {}
    for p in sys.argv[1:]:
        idx[os.path.basename(p)] = split(p)
    mpath = os.path.join(OUTDIR, "matrix_index.json")
    old = {}
    if os.path.exists(mpath):
        old = json.load(open(mpath, encoding="utf-8"))
    old.update(idx)
    json.dump(old, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("index:", mpath)

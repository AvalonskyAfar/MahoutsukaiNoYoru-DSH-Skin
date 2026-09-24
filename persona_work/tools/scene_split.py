"""把场景矩阵按行切片（每片若干行）。"""
import os, sys
from PIL import Image

CELL, LAB, HEAD = 190, 26, 50


def split(path, rows_per=4):
    im = Image.open(path)
    base = os.path.basename(path).replace(".jpg", "")
    rows = (im.height - HEAD) // (CELL + LAB)
    outs = []
    n = 0
    y = HEAD
    while n < rows:
        y2 = min(im.height, HEAD + (n + rows_per) * (CELL + LAB))
        crop = im.crop((0, y, im.width, y2))
        o = os.path.join(os.path.dirname(path), f"{base}_r{n // rows_per + 1}.jpg")
        crop.save(o, quality=90)
        outs.append((os.path.basename(o), crop.size))
        n += rows_per
        y = y2
    for o, s in outs:
        print("  ", o, s)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(os.path.basename(p))
        split(p)

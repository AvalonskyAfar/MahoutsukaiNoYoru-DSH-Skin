"""把印相表按行切片。用法: python slice_sheet.py <图> <每片行数> [CELL] [LAB] [HEAD]"""
import os, sys
from PIL import Image

p = sys.argv[1]
per = int(sys.argv[2]) if len(sys.argv) > 2 else 3
CELL = int(sys.argv[3]) if len(sys.argv) > 3 else 200
LAB = int(sys.argv[4]) if len(sys.argv) > 4 else 34
HEAD = int(sys.argv[5]) if len(sys.argv) > 5 else 46

im = Image.open(p)
base = os.path.basename(p).replace(".jpg", "")
rows = (im.height - HEAD) // (CELL + LAB)
n = 0
y = HEAD
i = 1
while n < rows:
    y2 = min(im.height, HEAD + (n + per) * (CELL + LAB))
    c = im.crop((0, y, im.width, y2))
    o = os.path.join(os.path.dirname(p), f"{base}_s{i}.jpg")
    c.save(o, quality=90)
    print("  ", o, c.size)
    n += per
    y = y2
    i += 1

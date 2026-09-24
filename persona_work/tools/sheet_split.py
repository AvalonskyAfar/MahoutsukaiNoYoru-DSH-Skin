"""把一张大对比表按行切片成若干小图（便于逐张查看 / 交给视觉子代理）。"""
import os, sys
from PIL import Image

def split(path, rows_per=5, w=1500):
    im = Image.open(path)
    print(path, im.size)
    # 标签行高 30，首行 header 44
    lab, cell = 30, 300
    step = cell + lab
    n = 0
    y = 44
    while y < im.height:
        y2 = min(im.height, 44 + (n + 1) * step * rows_per)
        crop = im.crop((0, y, im.width, y2))
        out = path.replace(".jpg", f"_p{n+1}.jpg")
        crop.save(out, quality=90)
        print("  ", out, crop.size)
        n += 1
        y = y2

if __name__ == "__main__":
    for p in sys.argv[1:]:
        split(p)

# -*- coding: utf-8 -*-
"""
face_sheet.py —— 把一个通道的所有帧印成带编号的对照表（供人眼判定槽位）。

用法:
  python persona_work/tools/face_sheet.py aok a 03 16
  python persona_work/tools/face_sheet.py aok a 12 21 --cols 6
输出: persona_work/tmp/sheet_<char>_<batch>_<i3>_<chan>.png
"""
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
TMP = os.path.join(ROOT, "persona_work", "tmp")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def main():
    ch, batch, i3, chan = sys.argv[1:5]
    cols = 6
    if "--cols" in sys.argv:
        cols = int(sys.argv[sys.argv.index("--cols") + 1])
    d = os.path.join(OUT, DIRS[ch])
    frames = []
    for f in sorted(os.listdir(d)):
        if f.startswith(f"{ch}_{batch}_{i3}_{chan}_") and f.endswith(".mzp.png") \
           and not f.endswith("_b.mzp.png"):
            frames.append(f)
    # 排除合成图（多两段）
    frames = [f for f in frames if len(f[:-8].split("_")) == 5]
    if not frames:
        print("没有帧")
        return
    H = 320
    cells = []
    for f in frames:
        im = Image.open(os.path.join(d, f)).convert("RGBA")
        bb = mask(im).getbbox()
        if bb:
            im = im.crop(bb)
        w = max(1, round(im.width * H / im.height))
        im = im.resize((w, H), Image.LANCZOS)
        bg = Image.new("RGBA", im.size, (35, 35, 48, 255))
        cells.append((Image.alpha_composite(bg, im).convert("RGB"), f[:-8].split("_")[-1]))
    cw = max(c[0].width for c in cells) + 12
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cw * cols, (H + 26) * rows), (18, 18, 24))
    dr = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate(cells):
        x = (i % cols) * cw + 6
        y = (i // cols) * (H + 26)
        dr.text((x, y + 4), f"{i:02d}  v{label}", fill=(200, 220, 255))
        sheet.paste(im, (x + (cw - 12 - im.width) // 2, y + 22))
    p = os.path.join(TMP, f"sheet_{ch}_{batch}_{i3}_{chan}.png")
    sheet.save(p)
    print(f"{len(frames)} 帧 -> {p}  {sheet.size}")
    print("帧序: " + " ".join(c[1] for c in cells))


if __name__ == "__main__":
    main()

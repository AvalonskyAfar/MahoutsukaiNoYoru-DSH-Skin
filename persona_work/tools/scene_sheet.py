# -*- coding: utf-8 -*-
"""
scene_sheet.py —— 把某个 (角色,批次,i3,通道) 的所有帧**合成身体后**印成对照表。

每个格子 = 身体层 + 脸层（按画布对齐合）→ 裁到左上角一块固定窗口 → 缩小。
这样一次能同时看两件事：这一帧是什么表情、身体有没有正确接上。

用法:
  python persona_work/tools/scene_sheet.py aok n 12 02 --cols 5
输出: persona_work/tmp/scene_<char>_<batch>_<i3>_<chan>.png
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


def build(body, face):
    W = max(body.width, face.width)
    H = max(body.height, face.height)
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(body, (0, 0))
    c.alpha_composite(face, (0, 0))
    bb = mask(c).getbbox()
    return c.crop(bb) if bb else c


def sheet_for(d, ch, batch, i3, chan, cols, H, only=None):
    body_p = os.path.join(d, f"{ch}_{batch}_{i3}_{chan}_00_b.mzp.png")
    if not os.path.isfile(body_p):
        print(f"  [{ch}_{batch}_{i3}_{chan}] 没有身体层 {os.path.basename(body_p)}")
        return None, []
    body = Image.open(body_p).convert("RGBA")
    frames = []
    for f in sorted(os.listdir(d)):
        core = f[:-len(".mzp.png")] if f.endswith(".mzp.png") else f
        p = core.split("_")
        if len(p) == 5 and p[0] == ch and p[1] == batch and p[2] == i3 and p[3] == chan:
            if only and p[4] not in only:
                continue
            frames.append((p[4], os.path.join(d, f)))
    if not frames:
        print(f"  [{ch}_{batch}_{i3}_{chan}] 没有帧")
        return None, []
    cells = []
    for frame, p in frames:
        face = Image.open(p).convert("RGBA")
        comp = build(body, face)
        w = max(1, round(comp.width * H / comp.height))
        im = comp.resize((w, H), Image.LANCZOS)
        bg = Image.new("RGBA", im.size, (35, 35, 48, 255))
        cells.append((Image.alpha_composite(bg, im).convert("RGB"), frame))
    return cells, [c[1] for c in cells]


def main():
    ch, batch, i3 = sys.argv[1:4]
    chans = None
    if "--chans" in sys.argv:
        chans = sys.argv[sys.argv.index("--chans") + 1].split(",")
    else:
        chans = [sys.argv[4]]
    cols = 6
    if "--cols" in sys.argv:
        cols = int(sys.argv[sys.argv.index("--cols") + 1])
    only = None
    if "--frames" in sys.argv:
        only = set(sys.argv[sys.argv.index("--frames") + 1].split(","))
    d = os.path.join(OUT, DIRS[ch])
    H = 420 if only else 300
    blocks = []
    for chan in chans:
        cells, order = sheet_for(d, ch, batch, i3, chan, cols, H, only)
        if cells:
            blocks.append((chan, cells, order))
    if not blocks:
        return
    rows_of = lambda n: (n + cols - 1) // cols
    cw = max(max(c[0].width for c in b[1]) for b in blocks) + 14
    total_rows = sum(rows_of(len(b[1])) for b in blocks)
    sheet = Image.new("RGB", (cw * cols, (H + 26) * total_rows), (18, 18, 24))
    dr = ImageDraw.Draw(sheet)
    row0 = 0
    for chan, cells, order in blocks:
        for i, (im, label) in enumerate(cells):
            r, c = divmod(i, cols)
            x = c * cw + 7
            yy = (row0 + r) * (H + 26)
            dr.text((x, yy + 5), f"c{chan} [{i:02d}] v{label}", fill=(210, 230, 255))
            sheet.paste(im, (x + (cw - 14 - im.width) // 2, yy + 22))
        row0 += rows_of(len(cells))
        print(f"  通道 {chan}: {len(cells)} 帧  帧序 {' '.join(order)}")
    p = os.path.join(TMP, f"scene_{ch}_{batch}_{i3}_{'_'.join(chans)}.png")
    sheet.save(p)
    print(f"-> {p} {sheet.size}")


if __name__ == "__main__":
    main()

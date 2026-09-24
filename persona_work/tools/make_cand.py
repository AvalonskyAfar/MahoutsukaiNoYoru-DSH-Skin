"""候选对比图生成器 —— 选景确认用

用法:
    python make_cand.py <输出名> "<归档>:<ID>:<标题>" [...]

例:
    python make_cand.py cand_ari_talk "data02010:3008:A1-1 客厅·白天" "data02010:3029:A1-2 有珠房间·白天"

输出: persona_work/scene/<输出名>.jpg  （2 列，每格带 标题 + 归档/imgNNNN + 尺寸）
"""
import os, sys, re
from PIL import Image, ImageDraw

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\scene"
CELL = 700
LABEL = 40
COLS = 2


def find(arch, i):
    """i 可为编号（int/数字串）或完整文件名；同一编号多文件时排序取第一个，保证可复现。"""
    dp = os.path.join(ROOT, arch)
    names = sorted(os.listdir(dp))
    if not str(i).isdigit():
        for fn in names:
            if fn == i or fn == str(i) + ".mzp.png" or fn == str(i) + ".cbg.png":
                return os.path.join(dp, fn)
        return None
    n = int(i)
    for fn in names:
        m = re.match(r"img0*(\d+)(?![0-9])", fn)
        if m and int(m.group(1)) == n:
            return os.path.join(dp, fn)
    return None


def load(p):
    im = Image.open(p)
    box = im.getchannel("A").getbbox() if im.mode in ("RGBA", "LA") else None
    im = im.convert("RGBA")
    if box:
        im = im.crop(box)
    bg = Image.new("RGB", im.size, (16, 16, 18))
    bg.paste(im, (0, 0), im)
    return bg


def main(name, specs):
    os.makedirs(OUTDIR, exist_ok=True)
    items = []
    for s in specs:
        # 支持 "归档:编号:标题" 与 "归档/文件名:标题"
        if s.count(":") >= 2:
            arch, ids, title = s.split(":", 2)
        else:
            ap, title = s.split(":", 1)
            arch, ids = ap.rsplit("/", 1)
        p = find(arch, ids)
        if not p:
            print(f"!! 未找到 {arch}/{ids}")
            continue
        im = load(p)
        w0, h0 = im.size
        im.thumbnail((CELL - 8, CELL - 8), Image.LANCZOS)
        items.append((title, f"{arch}/{os.path.basename(p)}", f"{w0}x{h0}", im))
    if not items:
        return
    rows = (len(items) + COLS - 1) // COLS
    W, H = COLS * CELL, rows * (CELL + LABEL)
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    for n, (title, path, size, im) in enumerate(items):
        r, c = divmod(n, COLS)
        x, y = c * CELL, r * (CELL + LABEL)
        d.text((x + 8, y + 6), title, fill=(255, 235, 120))
        d.text((x + 8, y + 22), f"{path}   {size}", fill=(150, 200, 255))
        sheet.paste(im, (x + (CELL - im.width) // 2, y + LABEL + (CELL - LABEL - im.height) // 2))
        d.rectangle([x, y, x + CELL - 1, y + CELL + LABEL - 1], outline=(70, 70, 78))
    out = os.path.join(OUTDIR, f"{name}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  ({len(items)} 格, {W}x{H})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])

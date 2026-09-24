"""接触印相表（contact sheet）生成器 —— 用于在数千张无意义命名的背景图里定位场景

用法:
    python contact_sheet.py <归档名> <起始ID> <张数> [列数] [每格宽]
例:
    python contact_sheet.py data02010 3000 24 6 420

输出: persona_work/scene/sheet_<归档>_<起>_<张数>.jpg  （带 ID 标注）
"""
import os, sys, re
from PIL import Image, ImageDraw

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\scene"


def build(arch, start, count, cols=6, cell=420, label_h=22):
    os.makedirs(OUTDIR, exist_ok=True)
    dp = os.path.join(ROOT, arch)
    files = {}
    for fn in os.listdir(dp):
        m = re.match(r"img(\d+)", fn)
        if m:
            files[int(m.group(1))] = fn

    ids = [i for i in range(start, start + count) if i in files]
    if not ids:
        print(f"该区间无图: {arch} {start}..{start+count-1}")
        return None

    rows = (len(ids) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + label_h)
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)

    for n, i in enumerate(ids):
        r, c = divmod(n, cols)
        x, y = c * cell, r * (cell + label_h)
        try:
            raw = Image.open(os.path.join(dp, files[i]))
            box = raw.getchannel("A").getbbox() if raw.mode in ("RGBA", "LA") else None
            raw = raw.convert("RGBA")
            if box:
                raw = raw.crop(box)
            im = Image.new("RGB", raw.size, (16, 16, 18))
            im.paste(raw, (0, 0), raw)
        except Exception as e:
            draw.text((x + 4, y + 4), f"{i} ERR", fill=(255, 80, 80))
            continue
        im.thumbnail((cell - 4, cell - 4), Image.LANCZOS)
        ox = x + (cell - im.width) // 2
        oy = y + label_h + (cell - label_h - im.height) // 2
        sheet.paste(im, (ox, oy))
        draw.text((x + 4, y + 4), f"img{i}", fill=(255, 235, 120))

    out = os.path.join(OUTDIR, f"sheet_{arch}_{start:04d}_{count}.jpg")
    sheet.save(out, quality=88)
    print(f"{out}  ({len(ids)} 张, {W}x{H})")
    return out


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "data02010"
    s = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    c = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    col = int(sys.argv[4]) if len(sys.argv) > 4 else 6
    cell = int(sys.argv[5]) if len(sys.argv) > 5 else 420
    build(a, s, c, col, cell)

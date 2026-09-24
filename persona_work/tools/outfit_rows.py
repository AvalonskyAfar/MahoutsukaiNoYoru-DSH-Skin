"""把指定 (角色, 批次, i3) 的立绘导出成对比表 —— 每行取"内容面积最大"的那张（通常是全身）。

用法:
    python outfit_rows.py aok a12 l12 m12 n12 -o class12
    python outfit_rows.py aok a03 l03 m03 n03 s03 -o final03
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\scene"
SPRITE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})$")


def collect():
    d = {}
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in os.listdir(dp):
            n = f.replace(".mzp.png", "")
            m = SPRITE.match(n)
            if not m:
                continue
            who, b, i3, i4, var = m.groups()
            d.setdefault((who, b, int(i3)), []).append(os.path.join(dp, f))
    return d


def area(p):
    im = Image.open(p)
    box = im.getchannel("A").getbbox() if im.mode in ("RGBA", "LA") else None
    return (box[2] - box[0]) * (box[3] - box[1]) if box else im.size[0] * im.size[1]


def main():
    who = sys.argv[1]
    name = "outfit_rows"
    if "-o" in sys.argv:
        i = sys.argv.index("-o")
        name = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    keys = [a for a in sys.argv[2:] if not a.startswith("-")]
    d = collect()

    cell, lab = 420, 34
    items = []
    for k in keys:
        b, i3 = k[0], int(k[1:])
        files = d.get((who, b, i3))
        if not files:
            print("缺", k)
            continue
        best = max(files, key=area)
        im = Image.open(best)
        box = im.getchannel("A").getbbox() if im.mode in ("RGBA", "LA") else None
        im = im.convert("RGBA")
        if box:
            im = im.crop(box)
        bg = Image.new("RGB", im.size, (246, 246, 250))
        bg.paste(im, (0, 0), im)
        bg.thumbnail((cell - 10, cell - 10), Image.LANCZOS)
        items.append((f"{who}_{b} i3={i3:02d}  ({len(files)}张)", os.path.basename(best), bg))

    cols = min(5, len(items))
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + lab)), (246, 246, 250))
    dr = ImageDraw.Draw(sheet)
    font = None
    for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(p):
            try:
                font = ImageFont.truetype(p, 20)
                break
            except Exception:
                pass
    for n, (title, fn, im) in enumerate(items):
        r, c = divmod(n, cols)
        x, y = c * cell, r * (cell + lab)
        dr.text((x + 6, y + 4), title, fill=(180, 0, 0), font=font)
        dr.text((x + 6, y + 22), fn[:44], fill=(90, 90, 110), font=font)
        sheet.paste(im, (x + (cell - im.width) // 2, y + lab + (cell - lab - im.height) // 2))
    out = os.path.join(OUT, name + ".jpg")
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == "__main__":
    main()

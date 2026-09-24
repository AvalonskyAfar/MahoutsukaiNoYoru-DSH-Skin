"""按文件名正则拼接触印相表（用于 data00000 这类非 imgNNNN 命名的归档）

用法:
    python sheet_files.py <归档> <输出名> <文件名正则> [列数] [每格宽] [起始序号] [张数]

例:
    python sheet_files.py data00000 ch_covers "^[0-9a-d]+(\\.[0-9]+)?[a-z]?-" 8 320

输出: persona_work/scene/<输出名>.jpg
"""
import os, sys, re
from PIL import Image, ImageDraw

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\scene"


def natkey(s):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def build(arch, name, pattern, cols=8, cell=320, skip=0, take=9999, label_h=20):
    os.makedirs(OUTDIR, exist_ok=True)
    dp = os.path.join(ROOT, arch)
    rx = re.compile(pattern)
    files = sorted([f for f in os.listdir(dp) if rx.match(f)], key=natkey)
    files = files[skip:skip + take]
    if not files:
        print("没有匹配的文件")
        return None
    rows = (len(files) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + label_h)
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    for n, fn in enumerate(files):
        r, c = divmod(n, cols)
        x, y = c * cell, r * (cell + label_h)
        d.text((x + 4, y + 4), fn.replace(".mzp.png", "").replace(".cbg.png", ""), fill=(255, 235, 120))
        try:
            raw = Image.open(os.path.join(dp, fn))
            box = raw.getchannel("A").getbbox() if raw.mode in ("RGBA", "LA") else None
            raw = raw.convert("RGBA")
            if box:
                raw = raw.crop(box)
            im = Image.new("RGB", raw.size, (16, 16, 18))
            im.paste(raw, (0, 0), raw)
        except Exception as e:
            d.text((x + 4, y + 20), f"ERR {e}"[:40], fill=(255, 80, 80))
            continue
        im.thumbnail((cell - 4, cell - 4), Image.LANCZOS)
        sheet.paste(im, (x + (cell - im.width) // 2, y + label_h + (cell - label_h - im.height) // 2))
    out = os.path.join(OUTDIR, f"{name}.jpg")
    sheet.save(out, quality=88)
    print(f"{out}  ({len(files)} 张, {W}x{H})  范围: {files[0]} .. {files[-1]}")
    return out


if __name__ == "__main__":
    a = sys.argv[1]
    n = sys.argv[2]
    p = sys.argv[3]
    c = int(sys.argv[4]) if len(sys.argv) > 4 else 8
    cell = int(sys.argv[5]) if len(sys.argv) > 5 else 320
    sk = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    tk = int(sys.argv[7]) if len(sys.argv) > 7 else 9999
    build(a, n, p, c, cell, sk, tk)

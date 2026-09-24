"""候选图导出 / 拼版工具 —— 选景用

用法:
    python pick.py one  <归档> <ID> [输出名] [宽]
    python pick.py grid <归档> <ID,ID,ID,...> [输出名] [每格宽]

例:
    python pick.py one  data02010 3004 cand_A1_1
    python pick.py grid data02010 3004,3006,3008,3010 cand_A1_sel

输出: persona_work/scene/<输出名>.jpg
"""
import os, sys, re
from PIL import Image, ImageDraw

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\scene"


def find(arch, i):
    """按编号找文件；data02050~02052 里同一编号有多个分层/差分文件（img0231_01_01 等），
    排序后取第一个，保证结果稳定可复现。"""
    dp = os.path.join(ROOT, arch)
    cands = []
    for fn in sorted(os.listdir(dp)):
        m = re.match(r"img0*(\d+)(?![0-9])", fn)
        if m and int(m.group(1)) == i:
            cands.append(fn)
    return os.path.join(dp, sorted(cands)[0]) if cands else None


def find_exact(arch, fn):
    dp = os.path.join(ROOT, arch)
    for f in sorted(os.listdir(dp)):
        if f == fn or f == fn + ".mzp.png" or f == fn + ".cbg.png":
            return os.path.join(dp, f)
    return None


def load(p):
    """打开 PNG，裁掉透明外框（解包图统一 2552x1272，真实内容约 2101x1261），再铺到深灰底"""
    im = Image.open(p)
    box = None
    if im.mode in ("RGBA", "LA"):
        a = im.getchannel("A")
        box = a.getbbox()
    im = im.convert("RGBA")
    if box:
        im = im.crop(box)
    bg = Image.new("RGB", im.size, (16, 16, 18))
    bg.paste(im, (0, 0), im)
    return bg, box


def one(arch, i, name, width=1100):
    os.makedirs(OUTDIR, exist_ok=True)
    p = find_exact(arch, i) if isinstance(i, str) else find(arch, i)
    if not p:
        print(f"未找到 {arch}/{i}")
        return None
    im, box = load(p)
    ow, oh = im.size
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    out = os.path.join(OUTDIR, f"{name}.jpg")
    im.save(out, quality=90)
    print(f"{out}  (内容 {ow}x{oh}, 裁自 {box})")
    return out


def grid(arch, ids, name, cell=760, label_h=30):
    os.makedirs(OUTDIR, exist_ok=True)
    ims = []
    for i in ids:
        p = find(arch, i)
        if not p:
            print(f"未找到 {arch}/img{i:04d}")
            continue
        im, _ = load(p)
        im.thumbnail((cell, cell), Image.LANCZOS)
        ims.append((i, im))
    if not ims:
        return None
    cols = 2 if len(ims) > 1 else 1
    rows = (len(ims) + cols - 1) // cols
    W = cols * cell
    H = rows * (cell + label_h)
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    for n, (i, im) in enumerate(ims):
        r, c = divmod(n, cols)
        x, y = c * cell, r * (cell + label_h)
        sheet.paste(im, (x + (cell - im.width) // 2, y + label_h + (cell - label_h - im.height) // 2))
        d.text((x + 6, y + 8), f"img{i}", fill=(255, 235, 120))
    out = os.path.join(OUTDIR, f"{name}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  ({len(ims)} 张, {W}x{H})")
    return out


if __name__ == "__main__":
    mode = sys.argv[1]
    arch = sys.argv[2]
    if mode == "one":
        raw = sys.argv[3]
        i = int(raw) if raw.isdigit() else raw
        name = sys.argv[4] if len(sys.argv) > 4 else f"one_{arch}_{raw}"
        w = int(sys.argv[5]) if len(sys.argv) > 5 else 1100
        one(arch, i, name, w)
    else:
        ids = [int(x) for x in sys.argv[3].split(",") if x.strip()]
        name = sys.argv[4] if len(sys.argv) > 4 else "grid"
        cell = int(sys.argv[5]) if len(sys.argv) > 5 else 760
        grid(arch, ids, name, cell)

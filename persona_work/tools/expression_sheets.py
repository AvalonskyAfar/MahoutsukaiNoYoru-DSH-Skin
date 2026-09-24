"""表情差分对比表：把一个 (角色, 服装行 i3) 下的所有表情码导出成印相表。

**每行一个表情码 i4**，把该 i4 在**所有批次**里的变体横向排开（变量 0~N）。
格子里的小字 = 批次字母；`_b` 全身版单独成行。
用来肉眼 / 视觉模型判定「这个表情是什么」并映射到 12 个情绪槽位。

用法:
    python expression_sheets.py aok 12            # 青子 制服
    python expression_sheets.py aok 12 --batches a,l,m,n
    python expression_sheets.py koj 01
    python expression_sheets.py aok 12 --variants 3   # 每行最多显示前 3 个变体
"""
import os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
SPRITE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        try:
            FONT = ImageFont.truetype(_p, 20)
            break
        except Exception:
            pass


def collect(who, i3, batches=None):
    """(i4, 是否_b) -> [(批次, 变量号, 路径)]"""
    d = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            n = f.split(".mzp.png")[0].split(".cbg.png")[0]
            m = SPRITE.match(n)
            if not m:
                continue
            w, b, r, e, v = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            if w != who or r != i3:
                continue
            if batches and b not in batches:
                continue
            d[(e, bool(m.group(6)))].append((b, v, os.path.join(dp, f)))
    return d


def load_small(p, cell):
    im = Image.open(p).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)
    bg = Image.new("RGB", im.size, (24, 24, 28))
    bg.paste(im, (0, 0), im)
    bg.thumbnail((cell, cell), Image.LANCZOS)
    return bg


def build(who, i3, batches=None, maxvar=4, cell=300, suffix=""):
    d = collect(who, i3, batches)
    if not d:
        print("无匹配")
        return None
    keys = sorted(d, key=lambda k: (k[1], int(k[0])))
    lab = 30
    cols = maxvar
    W = 300 + cols * cell
    H = len(keys) * (cell + lab) + 44
    sheet = Image.new("RGB", (W, H), (238, 238, 242))
    dr = ImageDraw.Draw(sheet)
    allb = sorted({b for k in keys for b, _, _ in d[k]})
    dr.text((8, 8), f"{who}  i3={i3}  批次={','.join(allb)}  表情码={len(keys)} 个", fill=(160, 0, 0), font=FONT)
    for n, k in enumerate(keys):
        e, bflag = k
        files = d[k]
        y = 44 + n * (cell + lab)
        tag = f"{who}_*_{i3}_{e}" + ("_b" if bflag else "")
        dr.rectangle([0, y, W, y + lab - 2], fill=(215, 215, 225))
        dr.text((8, y + 4), f"{tag}   ({len(files)}张 批次{''.join(sorted({b for b,_,_ in files}))})",
                fill=(20, 20, 90), font=FONT)
        for c, (b, v, f) in enumerate(files[:maxvar]):
            try:
                im = load_small(f, cell - 8)
            except Exception as ex:
                dr.text((300 + c * cell, y + lab), f"ERR {ex}", fill=(255, 0, 0))
                continue
            ox = 300 + c * cell + (cell - im.width) // 2
            oy = y + lab + (cell - im.height) // 2
            sheet.paste(im, (ox, oy))
            dr.text((300 + c * cell + 4, y + lab + 2), f"{b}{v}", fill=(255, 220, 80), font=FONT)
    os.makedirs(OUTDIR, exist_ok=True)
    tag = f"{who}_{i3}" + ("_" + "_".join(batches) if batches else "") + suffix
    out = os.path.join(OUTDIR, f"expr_{tag}.jpg")
    sheet.save(out, quality=88)
    print(f"{out}  ({sheet.size[0]}x{sheet.size[1]}, {len(keys)} 行)")
    return out


if __name__ == "__main__":
    argv = list(sys.argv[1:])
    who, i3 = argv[0], argv[1]
    rest = argv[2:]
    batches = None
    if "--batches" in rest:
        k = rest.index("--batches")
        batches = rest[k + 1].split(",")
        del rest[k:k + 2]
    maxvar = 4
    if "--variants" in rest:
        k = rest.index("--variants")
        maxvar = int(rest[k + 1])
    build(who, i3, batches, maxvar)

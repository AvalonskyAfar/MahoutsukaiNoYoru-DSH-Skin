"""★ 变体矩阵：把一个 (角色, 服装行 i3) 下所有表情组 (i4) 的所有帧 (变体) 排成矩阵。

为什么需要它（2026-09-16 实测更正）：
  立绘名的第 4 段 `i4` **不是**表情本身，而是「表情组/通道」；
  **第 5 段（变体号）才是真正的表情编号**。
  证据：`aok_a_12_02_00..08`（同一 i4=02）肉眼可见是「平静/闭眼/惊讶/为难/脸红/微笑/生气/怒视/半眼」
  等**完全不同的表情**，而不是同一表情的取景微调。

所以「穷举某个服装行有哪些表情」= 把 i4 × 变体 的矩阵逐格看一遍。

用法:
    python variant_matrix.py aok 12
    python variant_matrix.py koj 01 --batches a,l,n
"""
import os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        try:
            FONT = ImageFont.truetype(_p, 20)
            break
        except Exception:
            pass


def collect(who, i3, batches=None, full=False, only=None):
    """(i4, 变体) -> [(批次, 路径)]

    only: 只保留变体号在这个集合里的帧（用于「只看某章实际引用过的」）
    """
    d = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if not m:
                continue
            w, b, r, e, v = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            if w != who or r != i3:
                continue
            if bool(m.group(6)) != full:
                continue
            if batches and b not in batches:
                continue
            if only is not None and v not in only:
                continue
            d[(e, v)].append((b, os.path.join(dp, f)))
    return d


def build(who, i3, batches=None, full=False, cell=170, only=None, suffix=""):
    d = collect(who, i3, batches, full)
    if not d:
        print("无匹配", who, i3, full)
        return None
    # ★ 按「帧号（变体）」分组：一个表情号可能有多个 i4 通道产出同号帧，各占一格
    byvar = defaultdict(list)
    for (e, v), files in d.items():
        byvar[v].append((e, files[0][0], files[0][1]))
    vars_ = sorted(byvar)
    maxn = max(len(byvar[v]) for v in vars_)
    lab = 26
    head = 46
    W = 170 + len(vars_) * cell
    H = head + maxn * (cell + lab)
    sheet = Image.new("RGB", (W, H), (236, 236, 241))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 8), f"{who} i3={i3}  镜头={'全身_b' if full else '特写'}  "
                    f"帧号 {len(vars_)} 列 x 每列最多 {maxn} 个通道", fill=(160, 0, 0), font=FONT)
    for c, v in enumerate(vars_):
        dr.text((170 + c * cell + 6, 24), f"v{v}", fill=(20, 20, 90), font=FONT)
    for c, v in enumerate(vars_):
        files = sorted(byvar[v])
        for r, (e, b, p) in enumerate(files):
            y = head + r * (cell + lab)
            dr.rectangle([0, y, W, y + lab - 2], fill=(212, 212, 222))
            dr.text((8, y + 3), f"帧{v} i4={e}", fill=(20, 20, 90), font=FONT)
            try:
                im = Image.open(p).convert("RGBA")
                im.thumbnail((cell - 4, cell - 4), Image.LANCZOS)
            except Exception as ex:
                dr.text((170 + c * cell, y + lab), str(ex)[:16], fill=(255, 0, 0))
                continue
            bg = Image.new("RGB", im.size, (18, 18, 22))
            bg.paste(im, (0, 0), im)
            ox = 170 + c * cell + (cell - bg.width) // 2
            oy = y + lab + (cell - bg.height) // 2
            sheet.paste(bg, (ox, oy))
            dr.text((170 + c * cell + 3, y + lab + 1), f"{b}", fill=(255, 220, 80), font=FONT)
    os.makedirs(OUTDIR, exist_ok=True)
    tag = f"{who}_{i3}" + ("_b" if full else "") + ("_" + "_".join(batches) if batches else "") + suffix
    out = os.path.join(OUTDIR, f"matrix_{tag}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  {sheet.size}  ({len(vars_)} 帧列 x 最多 {maxn} 通道)")
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
    only = None
    suffix = ""
    if "--only" in rest:
        k = rest.index("--only")
        only = set(rest[k + 1].split(","))
        suffix = "_only"
        del rest[k:k + 2]
    build(who, i3, batches, "--full" in rest, only=only, suffix=suffix)

# -*- coding: utf-8 -*-
"""
match_layers.py —— 在合成图里**分别定位身体层与脸层**，相减得到相对贴图点。

为什么不用 bbox 推：合成图里的身体与 `_b` 文件并非逐像素相同（约 0.5% 尺寸差），
bbox 对齐会把这点算进偏移里，残差就铺满整张图。

做法（粗到细，判据是"模板不透明像素上的 RGB 平均绝对差"，越小越好）：
  1/8 全扫  ->  1/2 窗口内扫  ->  1/1 用中心小块精修到 1px
  身体用脚/靴那块（唯一、且脸够不到）；脸只在头部区域搜。

用法:
  python persona_work/tools/match_layers.py aok_a_03_02_00 [--box x0,y0,x1,y1]
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
TMP = os.path.join(ROOT, "persona_work", "tmp")

# 每个角色一对目录：(零件目录, 合成图目录)
PAIRS = {
    "aok": ("data02100", "data02105"),
    "ari": ("data02110", "data02115"),
    "beo": ("data02120", "data02125"),
    "eir": ("data02130", "data02135"),
    "kin": ("data02140", "data02145"),
    "koj": ("data02150", "data02155"),
    "rid": ("data02160", "data02165"),
    "rit": ("data02170", "data02175"),
    "sou": ("data02180", "data02185"),
    "tob": ("data02190", "data02195"),
    "tou": ("data02210", "data02215"),
    "yam": ("data02220", "data02225"),
    "yui": ("data02230", "data02235"),
}


def dirs_for(stem):
    return PAIRS[stem.split("_")[0]]


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def score_at(comp, patch, px, py, pm, sub=None):
    """patch 左上角放在 comp 的 (px,py) 时的平均绝对差。sub=(x,y,w,h) 限定比较区。"""
    p = patch
    if sub:
        p = patch.crop((sub[0], sub[1], sub[0] + sub[2], sub[1] + sub[3]))
        px, py = px + sub[0], py + sub[1]
        pm = p.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    if px < 0 or py < 0 or px + p.width > comp.width or py + p.height > comp.height:
        return 1e9
    reg = comp.crop((px, py, px + p.width, py + p.height))
    d = ImageChops.difference(reg.convert("RGB"), p.convert("RGB")).convert("L")
    d = ImageChops.multiply(d, pm)
    return d.resize((1, 1), Image.BOX).getpixel((0, 0))


def match(comp, patch, box, label, coarse=8):
    pm = patch.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    if pm.getbbox() is None or pm.histogram()[255] if False else False:
        pass
    x0, y0, x1, y1 = box
    # --- 1/coarse 全扫 ---
    sc = coarse
    cw, chh = comp.width // sc, comp.height // sc
    cs = comp.resize((cw, chh), Image.BOX)
    ps = patch.resize((max(2, patch.width // sc), max(2, patch.height // sc)), Image.BOX)
    pms = ps.getchannel("A").point(lambda v: 255 if v > 150 else 0)
    bx0, by0 = max(0, x0 // sc), max(0, y0 // sc)
    bx1, by1 = min(cw, x1 // sc), min(chh, y1 // sc)
    best = None
    for y in range(by0, max(by0 + 1, bx1 - ps.height + 1 if False else min(by1, chh - ps.height) + 1)):
        for x in range(bx0, min(bx1, cw - ps.width) + 1):
            reg = cs.crop((x, y, x + ps.width, y + ps.height))
            d = ImageChops.difference(reg.convert("RGB"), ps.convert("RGB")).convert("L")
            d = ImageChops.multiply(d, pms)
            v = d.resize((1, 1), Image.BOX).getpixel((0, 0))
            if best is None or v < best[0]:
                best = (v, x, y)
    if best is None:
        print(f"  [{label}] 粗搜失败")
        return None, None
    gx, gy = best[1] * sc, best[2] * sc
    print(f"  [{label}] 1/{sc} 粗搜: ({gx}, {gy}) 粗糙度 {best[0]:.2f}")

    # --- 1/2 窗口内扫 ---
    sc = 2
    win = 4 * coarse  # 全分辨率像素
    cx0, cy0 = max(0, gx - win), max(0, gy - win)
    cx1, cy1 = gx + patch.width + win, gy + patch.height + win
    cs = comp.crop((cx0, cy0, cx1, cy1))
    cs2 = cs.resize((cs.width // sc, cs.height // sc), Image.BOX)
    ps2 = patch.resize((patch.width // sc, patch.height // sc), Image.BOX)
    pms2 = ps2.getchannel("A").point(lambda v: 255 if v > 150 else 0)
    best2 = None
    for y in range(0, cs2.height - ps2.height + 1):
        for x in range(0, cs2.width - ps2.width + 1):
            reg = cs2.crop((x, y, x + ps2.width, y + ps2.height))
            d = ImageChops.difference(reg.convert("RGB"), ps2.convert("RGB")).convert("L")
            d = ImageChops.multiply(d, pms2)
            v = d.resize((1, 1), Image.BOX).getpixel((0, 0))
            if best2 is None or v < best2[0]:
                best2 = (v, x, y)
    gx, gy = cx0 + best2[1] * sc, cy0 + best2[2] * sc
    print(f"  [{label}] 1/2  细搜: ({gx}, {gy}) 粗糙度 {best2[0]:.2f}")

    # --- 1/1 中心小块精修 ---
    sub = (patch.width // 2 - 150, patch.height // 2 - 150, 300, 300)
    best3 = None
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            v = score_at(comp, patch, gx + dx, gy + dy, pm, sub=sub)
            if v < 1e8 and (best3 is None or v < best3[0]):
                best3 = (v, gx + dx, gy + dy)
    if best3:
        gx, gy, v = best3[1], best3[2], best3[0]
        print(f"  [{label}] 1/1  精修: ({gx}, {gy}) 粗糙度 {v:.2f}")
    full = score_at(comp, patch, gx, gy, pm)
    print(f"  [{label}] 整块复核: 平均绝对差 {full:.2f}（0 = 逐像素相同）")
    return (gx, gy), full


def solve(base, box_face=None):
    parts_dir, comp_dir = dirs_for(base)
    body_p = os.path.join(OUT, parts_dir, base + "_b.mzp.png")
    face_p = os.path.join(OUT, parts_dir, base + ".mzp.png")
    if not os.path.isfile(body_p) or not os.path.isfile(face_p):
        print(f"[{base}] 缺 body/face")
        return None
    cdir = os.path.join(OUT, comp_dir)
    cands = sorted(f for f in os.listdir(cdir)
                   if f.startswith(base + "_")) if os.path.isdir(cdir) else []
    if not cands:
        print(f"[{base}] 没有合成图")
        return None
    comp_p = os.path.join(cdir, cands[0])
    body = Image.open(body_p).convert("RGBA")
    face = Image.open(face_p).convert("RGBA")
    comp = Image.open(comp_p).convert("RGBA")
    print(f"== {base} ==  body={body.size} face={face.size} "
          f"comp={comp.size} ({cands[0]})")

    bb = mask(body).getbbox()
    feet = body.crop((0, max(0, bb[3] - 460), body.width, bb[3]))
    feet_origin = (0, max(0, bb[3] - 460))
    box = (0, 0, comp.width, comp.height)
    bp, bs = match(comp, feet, box, "身体·脚")
    if bp is None:
        return None
    body_off = (bp[0] - feet_origin[0], bp[1] - feet_origin[1])
    print(f"  -> 身体层 -> 合成图 偏移 = {body_off}")

    fb = mask(face).getbbox()
    face_patch = face.crop(fb)
    boxf = box_face or (0, 0, comp.width, min(comp.height, 2800))
    fp, fs = match(comp, face_patch, boxf, "脸层")
    if fp is None:
        return None
    face_off = (fp[0] - fb[0], fp[1] - fb[1])
    print(f"  -> 脸层 -> 合成图 偏移 = {face_off}")

    rel = (face_off[0] - body_off[0], face_off[1] - body_off[1])
    print(f"  ==> 脸层画布原点贴在**身体画布**的 {rel}")

    pad = 800
    canvas = Image.new("RGBA", (body.width + 2 * pad, body.height + 2 * pad), (0, 0, 0, 0))
    canvas.alpha_composite(body, (pad, pad))
    canvas.alpha_composite(face, (pad + rel[0], pad + rel[1]))
    crop = canvas.crop((pad, pad, pad + body.width, pad + 2000))
    bg = Image.new("RGBA", crop.size, (40, 40, 60, 255))
    out = Image.alpha_composite(bg, crop).convert("RGB")
    out = out.resize((out.width // 3, out.height // 3), Image.LANCZOS)
    p = os.path.join(TMP, "rebuild_" + base + ".png")
    out.save(p)
    print(f"  重建预览（头部）-> {p}")
    return dict(base=base, body_off=body_off, face_off=face_off, rel=rel,
                body_score=bs, face_score=fs)


if __name__ == "__main__":
    for b in (sys.argv[1:] or ["aok_a_03_02_00"]):
        solve(b)
        print()

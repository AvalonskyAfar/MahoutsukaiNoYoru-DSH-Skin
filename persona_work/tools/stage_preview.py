"""站位预览合成：把景背景 + 立绘按某套站位规则渲染成 1920x1080 预览图。

用途：站位规格不能靠推演定，必须**看着真实素材**定。
本工具按给定的锚点/缩放规则渲染若干组，横向对比。

用法:
    python stage_preview.py A3 --mode table
    python stage_preview.py A3 --mode custom --x 0.5 --y 1.0 --scale 1.0 --anchor bbox
"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\stage"
W, H = 1920, 1080
DIALOG_TOP = 760          # 对话框顶边（04 规格：1 行 86px + 45px 间距 + 输入区）
FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        FONT = ImageFont.truetype(_p, 22)
        break

SCENES = {
    "A1": ("data02010/img3008.mzp.png", "ari", "01", "a01"),
    "A2": ("data02010/img3006.mzp.png", "ari", "01", "a01"),
    "A3": ("data02050/img0231_01_01.mzp.png", "aok", "12", "n12"),
    "A4": ("data02000/img0296.mzp.png", "aok", "03", "n03"),
    "A5": ("data02000/img0349.mzp.png", "koj", "00", "n00"),
    "A6": ("data02000/img0222.mzp.png", "koj", "01", "a01"),
    "B1": ("data02010/img3000.mzp.png", None, None, None),
    "B3": ("data00000/title_bg1.cbg.png", None, None, None),
}


def bg_fit(path, w, h):
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)
    bg = Image.new("RGB", (w, h), (12, 12, 16))
    s = max(w / im.width, h / im.height)
    im2 = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    bg.paste(im2, ((w - im2.width) // 2, (h - im2.height) // 2), im2)
    return bg


def find(sid):
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        if os.path.exists(os.path.join(dp, sid + ".mzp.png")):
            return os.path.join(dp, sid + ".mzp.png")
    return None


def render(bg, sprite_path, anchor="bbox", x=0.5, y=1.0, scale=1.0, crop=None):
    out = bg.copy()
    im = Image.open(sprite_path).convert("RGBA")
    if anchor == "bbox":
        box = im.getchannel("A").getbbox()
        if box:
            if crop is not None:      # crop = 内容归一化 (x0,y0,x1,y1)
                bx0, by0, bx1, by1 = box
                cw, ch = bx1 - bx0, by1 - by0
                box = (int(bx0 + crop[0] * cw), int(by0 + crop[1] * ch),
                       int(bx0 + crop[2] * cw), int(by0 + crop[3] * ch))
            im = im.crop(box)
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    px = int(x * W - im.width / 2)
    py = int(y * H - im.height)
    out.paste(im, (px, py), im)
    return out


def table(scene):
    bgp, who, i3, batch = SCENES[scene]
    bg = bg_fit(os.path.join(ROOT, bgp), W, H)
    variants = []
    if who:
        # 找该 (批次, i3) 下帧 00 的特写与全身
        close = find(f"{who}_{batch}_{i3.split('_')[-1] if '_' in i3 else i3}_02_00") if False else None
    return bg


def combined(scene, specs, title):
    bgp, who, i3, batch = SCENES[scene]
    bgp_full = os.path.join(ROOT, bgp)
    tiles = []
    for name, sid, kwargs in specs:
        bg = bg_fit(bgp_full, W, H)
        p = find(sid)
        im = render(bg, p, **kwargs) if p else bg
        d = ImageDraw.Draw(im)
        d.rectangle([0, DIALOG_TOP, W, H], fill=(30, 40, 48, 255))
        d.text((40, DIALOG_TOP + 20), f"【预览】{name}   {sid}", fill=(200, 230, 240), font=FONT)
        d.text((40, DIALOG_TOP + 50), f"{kwargs}", fill=(150, 180, 190), font=FONT)
        tiles.append((name, im))
    cols = min(3, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    tw, th = W // cols, H // rows
    sheet = Image.new("RGB", (tw * cols, th * rows), (10, 10, 12))
    for n, (name, im) in enumerate(tiles):
        r, c = divmod(n, cols)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (c * tw, r * th))
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, f"stage_{scene}.jpg")
    sheet.save(out, quality=88)
    print(out, sheet.size)


if __name__ == "__main__":
    scene = sys.argv[1]
    if scene == "A3":
        specs = [
            ("特写·内容贴底居中", "aok_n_12_02_00", dict(anchor="bbox", x=0.5, y=1.0)),
            ("特写·内容贴底·裁到肩", "aok_n_12_02_00", dict(anchor="bbox", x=0.5, y=1.02, crop=(0, 0, 1, 1))),
            ("特写·缩 0.62 全身可见", "aok_n_12_02_00_b", dict(anchor="bbox", x=0.5, y=0.86, scale=0.132)),
            ("全身·原尺寸贴底", "aok_n_12_02_00_b", dict(anchor="canvas", x=0.5, y=1.0)),
            ("全身·缩到 0.62", "aok_n_12_02_00_b", dict(anchor="canvas", x=0.5, y=0.98, scale=0.62)),
            ("全身·只露上半（裁 62%）", "aok_n_12_02_00_b", dict(anchor="bbox", x=0.5, y=1.0, crop=(0, 0, 1, 0.62))),
        ]
        combined(scene, specs, "A3")
    elif scene == "A4":
        specs = [
            ("特写·内容贴底居中", "aok_n_03_02_00", dict(anchor="bbox", x=0.5, y=1.0)),
            ("特写·右偏 62%", "aok_n_03_02_00", dict(anchor="bbox", x=0.62, y=1.0)),
            ("全身·原尺寸贴底", "aok_n_03_02_00_b", dict(anchor="bbox", x=0.5, y=1.0)),
            ("全身·缩 0.62", "aok_n_03_02_00_b", dict(anchor="bbox", x=0.5, y=0.98, scale=0.62)),
            ("全身·裁到上半 55%", "aok_n_03_02_00_b", dict(anchor="bbox", x=0.5, y=1.0, crop=(0, 0, 1, 0.55))),
            ("全身·裁到上半 55% 右偏", "aok_n_03_02_00_b", dict(anchor="bbox", x=0.62, y=1.0, crop=(0, 0, 1, 0.55))),
        ]
        combined(scene, specs, "A4")

"""★ 景 × 表情 的**逐文件**对照表（最终判定用）。

背景（2026-09-16 两轮实测结论，**推翻了交接文件 §4.1 的语义**）：
  `<角色>_<批次>_<i3>_<i4>_<v>[_b]`
  其中 **`i4` 与 `v` 都不是单独可用的表情键**——
  `v` 是**每条 (批次, i4) 通道自己动画序列里的帧号**。
  证据：`aok_n_12_09` 的 v09 = 大怒，而 `aok_n_12_21` 的 v09 = 惊讶；
        `koj_a_00_01` 的 v01 = 张口惊讶，而 `koj_n_00_07` 的 v01 = 压眉瞪视。
  → **只有具体文件（= (i3, i4, v) 三元组）才确定表情。**

所以本工具把「某景实际用到的那批具体文件」逐张导出成带编号的印相表，
供逐格视觉判定，判定结果写进 expressions.json。

用法:
    python scene_expr_sheet.py A3
    python scene_expr_sheet.py --all
"""
import json, os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

SCENES = {
    "A1A2": (["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a",
              "wik_h_a", "wik_k", "wik_l_2"], [("ari", "01")]),
    "A3": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("aok", "12")]),
    "A4": (["d_8"], [("aok", "03")]),
    "A5": (["7_1", "8dot5"], [("koj", "00"), ("koj", "01")]),
    "A6": (["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"], [("koj", "01")]),
    "A3sou": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("sou", "12")]),
    "A3tob": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("tob", "00")]),
}

FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        FONT = ImageFont.truetype(_p, 18)
        break

CELL, LAB = 200, 34


def find(sid):
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if os.path.isdir(dp) and os.path.exists(os.path.join(dp, sid + ".mzp.png")):
            return os.path.join(dp, sid + ".mzp.png")
    return None


def build(scene):
    data = json.load(open(AGG, encoding="utf-8"))
    chs, chars = SCENES[scene]
    items = []       # (序号, who, i3, i4, v, sid, 引用次数)
    for who, i3 in chars:
        c = defaultdict(int)
        for ch in chs:
            for s in data.get(ch, {}).get("sprites", []):
                if s["who"] == who and s["i3"] == i3 and s["closeup"]:
                    c[s["id"]] += 1
        for k in sorted(c, key=lambda x: (x.split("_")[3], x.split("_")[4], x.split("_")[1])):
            m = SINGLE.match(k)
            items.append([None, m.group(1), m.group(3), m.group(4), m.group(5), k, c[k]])
    if not items:
        print("无", scene)
        return
    # 编号：两位数字，写进图里
    for n, it in enumerate(items):
        it[0] = n + 1

    per = 6
    rows = (len(items) + per - 1) // per
    W = per * CELL
    H = 46 + rows * (CELL + LAB)
    sheet = Image.new("RGB", (W, H), (236, 236, 241))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 6), f"景 {scene}  逐文件表情对照表  共 {len(items)} 个具体文件"
                    f"（编号 → 文件 → 待填槽位）", fill=(160, 0, 0), font=FONT)
    for n, (idx, who, i3, i4, v, sid, cnt) in enumerate(items):
        r, c = divmod(n, per)
        x, y = c * CELL, 46 + r * (CELL + LAB)
        dr.rectangle([x, y, x + CELL - 1, y + LAB - 1], fill=(210, 210, 222))
        dr.text((x + 3, y + 2), f"#{idx:02d} e{i4} v{v} x{cnt}", fill=(20, 20, 90), font=FONT)
        p = find(sid)
        if not p:
            dr.text((x + 3, y + LAB), "缺", fill=(255, 0, 0), font=FONT)
            continue
        im = Image.open(p).convert("RGBA")
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((CELL - 4, CELL - 4), Image.LANCZOS)
        bg = Image.new("RGB", im.size, (18, 18, 22))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x + (CELL - bg.width) // 2, y + LAB + (CELL - bg.height) // 2))
        dr.text((x + 3, y + LAB + CELL - 20), sid[:26], fill=(255, 220, 80), font=FONT)
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, f"exprfiles_{scene}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  {sheet.size}  {len(items)} 个文件, {rows} 行")

    # 同时写一份索引，供填表
    idx = os.path.join(OUTDIR, f"exprfiles_{scene}.json")
    json.dump([{"no": i, "who": w, "i3": a, "i4": b, "v": v, "id": sid, "refs": n}
               for (i, w, a, b, v, sid, n) in items],
              open(idx, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("  ", idx)


if __name__ == "__main__":
    args = sys.argv[1:] or ["--all"]
    names = list(SCENES) if args == ["--all"] else args
    for s in names:
        build(s)

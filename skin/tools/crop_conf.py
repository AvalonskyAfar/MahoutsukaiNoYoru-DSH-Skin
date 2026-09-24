#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把原著「環境設定」那一屏的**图集**裁成独立切片，落到 `skin/assets/ui/conf/`。

为什么需要
----------
原著的环境设置是**横排五页签 + 页内选项组 + 滑条 + 底部恢复按钮**，而且
**文字全部烧在 PNG 上** —— 把 250 个 `.chs` 编译脚本全文搜过（HunexCompiledScript
字节码，字符串是 UTF-8 明文），页签名 / 选项名 / 按钮名**一个都没有**，
只有 `test_script.chs` 出现过「音量」二字。所以**搜索这条路是死的，切图才是正解**：
切出来就有字，字就是真凭据。

而图集**不能用百分比定位** —— 行高不是均匀的（`btn_base0_zc` 是 71/71/79/79），
按百分比一定切歪。所以必须有一张**逐格写死的几何表**，也就是本文件。

用法
----
    python skin/tools/crop_conf.py                # 试跑：只报告会写什么、与现役是否一致
    python skin/tools/crop_conf.py --check        # 只校验：现役 80 个切片与几何表是否逐字节一致
    python skin/tools/crop_conf.py --write        # 落盘（先备份 skin/assets/ui/conf/）
    python skin/tools/crop_conf.py --write --src D:/另一个解包目录

退出码 0/1，可并进检查套件（与 `crop_alpha.py` 同一习惯）。

⚠ 这个脚本的存在本身就是一条约束：`assemble-assets.mjs` **不生成** `conf/`
  （只生成 ui/bg/sprite/bgm 的清单），所以 `skin/assets/ui/conf/` 一旦被删，
  只能靠这个脚本重建 —— 别把 `tools/` 从备份里漏掉。
  （实测 `install.ps1` 的镜像备份只收 `tools\\*.mjs` 与 `tools\\*.ps1`，**不含 `.py`**。）
"""
import argparse
import hashlib
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_SRC = os.path.join(ROOT, "hfa_png", "out", "data00000")
DEFAULT_OUT = os.path.join(ROOT, "skin", "assets", "ui", "conf")

# ---------------------------------------------------------------------------
# 几何表：全部由**逐像素探边**量出（找透明沟槽），不是估的。
#   每项 = (源文件名, 列段[(x, w)], 行段[(y, h)], 画布 (W, H), 输出名模板)
#   输出名模板里的 {c} = 列号、{s} = 状态行号。
# ---------------------------------------------------------------------------
TABS = [
    # btn_base0_zc 1648×384：5 列 × 4 态，322×79 一格
    # 列段 5 个: 9..330 / 335..656 / 661..982 / 987..1308 / 1313..1634
    # 行段 4 个: 13..83 / 103..173 / 189..267 / 279..357
    ("btn_base0_zc.cbg.png",
     [(9, 322), (335, 322), (661, 322), (987, 322), (1313, 322)],
     [(13, 71), (103, 71), (189, 79), (279, 79)],
     (322, 79), "tab{c}_s{s}.png"),
]

OPTS = [
    # btn_base2_zc / btn_base4_zc 940×364：4 列 × 4 态，216×72 一格
    # 列段: 8..223 / 244..459 / 480..695 / 716..931
    # 行段: 8..79 / 108..163 / 192..263 / 292..347
    ("btn_base2_zc.cbg.png",
     [(8, 216), (244, 216), (480, 216), (716, 216)],
     [(8, 72), (108, 56), (192, 72), (292, 56)],
     (216, 72), "opt2_c{c}_s{s}.png"),
    ("btn_base4_zc.cbg.png",
     [(8, 216), (244, 216), (480, 216), (716, 216)],
     [(8, 72), (108, 56), (192, 72), (292, 56)],
     (216, 72), "opt4_c{c}_s{s}.png"),
]

# 单列、只按行切的：源文件, x0..x1, 行段[(y,h)], 画布, 输出名
SINGLE = [
    ("btn_default_zc.cbg.png", 41, 567, [(39, 78), (127, 78), (215, 78), (303, 78)],
     (526, 78), "dflt_s{s}.png"),
    ("conf_sbtn.cbg.png", 0, 64, [(3, 58), (80, 40)], (64, 58), "knob_s{s}.png"),
]

# 两端标签：源文件, [(列标签, x0, x1)], 行段[(y,h)], 画布, 输出名模板
SPLIT_LABELS = [
    ("conf_stxt01_zc.cbg.png", [("s", 67, 99), ("l", 143, 175)],
     [(2, 34), (49, 28)], (34, 34), "stxt01_{c}_s{s}.png"),      # 小 / 大
    ("conf_stxt2_zc.cbg.png", [("slow", 67, 100), ("fast", 143, 176)],
     [(2, 34), (49, 28)], (34, 34), "stxt2_{c}_s{s}.png"),       # 慢 / 快
]

# btn_base3 604×252：轨 2 条 + 箭头 8 枚（4 组 × 左右 × 两态）
BASE3 = {
    "file": "btn_base3.cbg.png",
    "bars": [((8, 8, 594, 80), (586, 72), "track_glow.png"),
             ((8, 104, 594, 160), (586, 56), "track_plain.png")],
    # 列段: 17..55 / 92..130 / 169..207 / 244..282 / 317..365 / 390..438 / 466..521 / 538..593
    "arrows": [((17, 186, 56, 247), (60, 61), "arwL_s0.png"),
               ((92, 186, 131, 247), (60, 61), "arwR_s0.png"),
               ((169, 186, 208, 247), (60, 61), "arwL_s1.png"),
               ((244, 186, 283, 247), (60, 61), "arwR_s1.png"),
               ((317, 186, 366, 247), (60, 61), "arwL_s2.png"),
               ((390, 186, 439, 247), (60, 61), "arwR_s2.png"),
               ((466, 186, 522, 247), (60, 61), "arwL_s3.png"),
               ((538, 186, 594, 247), (60, 61), "arwR_s3.png")],
}

# 轨 / 分隔线 / 色带：整张直接拷，不改名不改内容
DIRECT = [("conf_sbar.cbg.png", "sbar.png"),
          ("conf_sbar2.cbg.png", "sbar2.png"),
          ("conf_line.cbg.png", "line.png"),
          ("conf_band.cbg.png", "band.png")]


def centered(crop, canvas):
    """把裁片**居中**放到固定画布上 —— 各态尺寸不一时保持同一基线，贴图不会跳位。"""
    W, H = canvas
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(crop.convert("RGBA"),
                         (max(0, (W - crop.width) // 2), max(0, (H - crop.height) // 2)))
    return base


def plan():
    """产出 [(输出文件名, 生成函数)] —— 一个纯表，不落盘。"""
    items = []

    for fn, cols, rows, canvas, tpl in TABS + OPTS:
        for c, (cx, cw) in enumerate(cols):
            for s, (ry, rh) in enumerate(rows):
                items.append((tpl.format(c=c, s=s),
                              (fn, (cx, ry, cx + cw, ry + rh), canvas)))

    for fn, x0, x1, rows, canvas, tpl in SINGLE:
        for s, (ry, rh) in enumerate(rows):
            items.append((tpl.format(s=s), (fn, (x0, ry, x1, ry + rh), canvas)))

    for fn, pairs, rows, canvas, tpl in SPLIT_LABELS:
        for s, (ry, rh) in enumerate(rows):
            for key, x0, x1 in pairs:
                items.append((tpl.format(c=key, s=s), (fn, (x0, ry, x1, ry + rh), canvas)))

    for box, canvas, name in BASE3["bars"] + BASE3["arrows"]:
        items.append((name, (BASE3["file"], box, canvas)))

    for src, dst in DIRECT:
        items.append((dst, (src, None, None)))       # None = 整张直接拷

    return items


def sha(b):
    return hashlib.sha256(b).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="落盘（默认只试跑）")
    ap.add_argument("--check", action="store_true", help="只校验与现役是否逐字节一致")
    ap.add_argument("--src", default=DEFAULT_SRC, help="图集来源目录")
    ap.add_argument("--out", default=DEFAULT_OUT, help="切片输出目录")
    args = ap.parse_args()

    src_files = sorted({v[0] for _, v in plan()} | {s for s, _ in DIRECT})
    missing = [f for f in src_files if not os.path.isfile(os.path.join(args.src, f))]
    if missing:
        print("✗ 图集缺失 %d 个：%s" % (len(missing), ", ".join(missing)))
        print("  来源目录：%s" % args.src)
        return 1

    cache = {}
    made = same = diff = 0
    changed = []
    for name, spec in plan():
        fn, box, canvas = spec
        if fn not in cache:
            cache[fn] = Image.open(os.path.join(args.src, fn))
        im = cache[fn]
        if box is None:
            out = im.convert("RGBA")
        else:
            out = centered(im.crop(box), canvas)
        import io as _io
        buf = _io.BytesIO()
        out.save(buf, format="PNG")
        data = buf.getvalue()

        dst = os.path.join(args.out, name)
        if os.path.isfile(dst):
            cur = open(dst, "rb").read()
            if sha(cur) == sha(data):
                same += 1
            else:
                diff += 1
                changed.append(name)
                if args.check:
                    print("  ✗ %-24s 与现役不同（现役 %s / 应生成 %s）"
                          % (name, sha(cur), sha(data)))
                if args.write:
                    open(dst, "wb").write(data)
        else:
            if args.check:
                print("  ✗ %-24s 现役缺失" % name)
            made += 1
            if args.write:
                os.makedirs(args.out, exist_ok=True)
                open(dst, "wb").write(data)

    total = len(plan())
    print("")
    print("  几何表共 %d 个切片" % total)
    print("  与现役一致 %d / 不同 %d / 现役缺失 %d" % (same, diff, made))
    if changed and not args.check:
        print("  不同的：%s" % ", ".join(changed[:8]))

    if args.check:
        if diff or made:
            print("")
            print("✗ 校验未通过（%d 个不同 / %d 个缺失）" % (diff, made))
            return 1
        print("")
        print("✓ 全部 %d 个与几何表逐字节一致" % same)
        return 0

    if not args.write:
        print("")
        print("试跑完毕。加 --write 落盘（先备份 %s）。" % args.out)
        return 0

    print("")
    print("✓ 已写入 %s" % args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

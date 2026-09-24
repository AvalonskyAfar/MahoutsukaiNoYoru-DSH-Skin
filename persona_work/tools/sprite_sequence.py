"""立绘标识序列：从 .chs 剧本反查「原作在这一章按顺序引用了哪些立绘」。

为什么这样做（交接文件 §4.4）：`.chs` 是 HunexCompiledScriptVer1.00 字节码，
末尾是**字符串表**（nul 分隔的 UTF-8 串），里面**写着完整的立绘标识**、
精确到「批次_姿态行_表情_变体」，而且**是按原作首次引用顺序排列的**。
所以不需要反编译字节码，就能拿到原作的「立绘调度表」。

> 实测：`2_3.chs` 的字符串表里有 **55 个**立绘标识，与交接文件 §4.4 记录的 55 个一致。

命名：`<角色>_<批次>_<i3 姿态行>_<i4 表情>_<变体>`（另有 `_b` = 全身镜头）。

用法:
    python sprite_sequence.py seq 2_3            # 按出现顺序列出该章立绘标识
    python sprite_sequence.py distinct d_8       # 去重后的标识（+ 文件是否存在）
    python sprite_sequence.py who 2_3 aok        # 只看某个角色
    python sprite_sequence.py rows 2_3           # 该章用到的 (批次, i3 姿态行) 统计
    python sprite_sequence.py sprite aok_a_12_02_01   # 某个标识在哪些章被引用
    python sprite_sequence.py dump               # 全库导出（写 persona_work/agg/sprite_sequence.json）
"""
import os
import re
import sys
import json
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from script_bg import CHS  # noqa: E402

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
AGG = r"D:\QuickLook插件包\moye\persona_work\agg"

# 立绘标识：角色_批次_姿态行_表情_变体（可选 _b 全身镜头）
SPRITE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")
SPRITE_ANY = re.compile(r"\b([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?\b")


# --------------------------------------------------------------------------
# 字符串表提取
# --------------------------------------------------------------------------

def string_pool(data):
    """返回 .chs 末尾字符串表里的全部字符串（按表内顺序）。

    定位方式：从文件末尾向前走，收集「nul 分隔且能按 UTF-8 解码」的串，
    直到遇到非 UTF-8 的字节块为止。前导的那个空串是字符串表的 0 号槽。
    """
    end = len(data)
    while end > 0 and data[end - 1] == 0:
        end -= 1
    i = end
    while i > 0:
        j = data.rfind(b"\x00", 0, i)
        seg = data[j + 1:i]
        if j < 0 or not seg:
            i = j + 1
            break
        try:
            seg.decode("utf-8")
        except UnicodeDecodeError:
            i = j + 1
            break
        i = j
    pool = data[i:]
    out = []
    k = 0
    while k < len(pool):
        j = pool.find(b"\x00", k)
        if j < 0:
            break
        out.append(pool[k:j].decode("utf-8", "replace"))
        k = j + 1
    return out


def chapters():
    """章节名 -> .chs 路径"""
    res = {}
    for dp, _, fs in os.walk(CHS):
        for f in fs:
            if f.lower().endswith(".chs"):
                res[f[:-4].lower()] = os.path.join(dp, f)
    return res


def sequence(chapter):
    """某章出现过的立绘标识（按字符串表顺序，含重复）"""
    p = chapters().get(chapter.lower())
    if not p:
        return []
    data = open(p, "rb").read()
    return [s for s in string_pool(data) if SPRITE.match(s)]


def scan_all():
    """章节 -> [立绘标识...]（全库一次扫描）"""
    res = {}
    for name, p in chapters().items():
        data = open(p, "rb").read()
        sp = [s for s in string_pool(data) if SPRITE.match(s)]
        if sp:
            res[name] = sp
    return res


def file_map():
    """立绘标识 -> 磁盘上的实际文件（相对 hfa_png/out）。

    兼容两种命名：
      标准       aok_a_12_02_01.mzp.png
      带附加后缀 aok_n_00_01_03_02_02.mzp.png（图层差分，同标识取排序第一张）
    """
    res = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            n = f.split(".mzp.png")[0].split(".cbg.png")[0]
            m = SPRITE_ANY.match(n) or SPRITE_ANY.search(n)
            if not m:
                continue
            res[m.group(0)].append(arch + "/" + f)
    return res


# --------------------------------------------------------------------------
# 命令
# --------------------------------------------------------------------------

def cmd_seq(args):
    for ch in args:
        sp = sequence(ch)
        print(f"== {ch}: {len(sp)} 个立绘标识（去重 {len(set(sp))}）")
        for i, s in enumerate(sp):
            print(f"  {i:3d}  {s}")


def cmd_distinct(args):
    fm = file_map()
    for ch in args:
        sp = sequence(ch)
        uniq = list(dict.fromkeys(sp))
        print(f"== {ch}: {len(uniq)} 个不同立绘标识")
        for s in uniq:
            files = fm.get(s, [])
            mark = "✔" if files else "✘缺文件"
            print(f"  {s:20} {mark}  {files[0] if files else ''}")


def cmd_who(args):
    ch, who = args[0], args[1]
    sp = [s for s in sequence(ch) if s.startswith(who + "_")]
    print(f"== {ch} / {who}: {len(sp)} 条（去重 {len(set(sp))}）")
    for s in sp:
        print("  " + s)


def cmd_rows(args):
    for ch in args:
        sp = sequence(ch)
        c = Counter()
        for s in sp:
            m = SPRITE.match(s)
            who, b, i3 = m.group(1), m.group(2), m.group(3)
            c[(who, b, i3)] += 1
        print(f"== {ch}")
        for (who, b, i3), n in sorted(c.items()):
            print(f"   {who}_{b} i3={i3}   x{n}")
        # 每个 (角色, i3) 的批次并集
        agg = defaultdict(set)
        for (who, b, i3) in c:
            agg[(who, i3)].add(b)
        for (who, i3), bs in sorted(agg.items()):
            print(f"   → {who} i3={i3}: 批次 {'/'.join(sorted(bs))}")


def cmd_sprite(args):
    data = scan_all()
    for s in args:
        hits = [ch for ch, sp in data.items() if s in sp]
        print(f"  {s}: {len(hits)} 章  {', '.join(hits)}")


def cmd_dump(args):
    data = scan_all()
    fm = file_map()
    out = {}
    for ch, sp in sorted(data.items()):
        uniq = list(dict.fromkeys(sp))
        out[ch] = {
            "count": len(sp),
            "distinct": len(uniq),
            "sequence": sp,
            "sprites": [
                {
                    "id": s,
                    "who": SPRITE.match(s).group(1),
                    "batch": SPRITE.match(s).group(2),
                    "i3": SPRITE.match(s).group(3),
                    "i4": SPRITE.match(s).group(4),
                    "variant": SPRITE.match(s).group(5),
                    "closeup": not SPRITE.match(s).group(6),
                    "file": (fm.get(s) or [None])[0],
                }
                for s in uniq
            ],
        }
    os.makedirs(AGG, exist_ok=True)
    p = os.path.join(AGG, "sprite_sequence.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    tot = sum(v["distinct"] for v in out.values())
    miss = [s["id"] for v in out.values() for s in v["sprites"] if not s["file"]]
    print(f"{p}: {len(out)} 章, {tot} 条不同立绘标识, 缺文件 {len(miss)}")
    for s in miss[:20]:
        print("   缺:", s)


def cmd_mix(args):
    """完整有序流：把字符串表里的「文本/立绘/背景/音效」按原作顺序打出。

    这就是原作的**调度表**：`T:` 是文本条目、`S:` 是立绘、`B:` 是背景、`E:` 是音效/SE。
    立绘相对文本的位置 = 「这句话时换成这个表情」。
    """
    ch = args[0]
    p = chapters().get(ch.lower())
    if not p:
        print("无此章")
        return
    ss = string_pool(open(p, "rb").read())
    for i, s in enumerate(ss):
        if not s:
            continue
        if SPRITE.match(s):
            print(f"{i:4d} S: {s}")
        elif re.fullmatch(r"img\d{3,4}", s):
            print(f"{i:4d} B: {s}")
        elif re.fullmatch(r"SE[A-Z0-9]+", s, re.I):
            print(f"{i:4d} E: {s}")
        elif re.fullmatch(r"\$0\d{5}(@[a-z])?", s):
            continue  # 名字槽占位符，不是文本
        elif re.fullmatch(r"[A-Za-z]:\\[^\x00]*", s) or s in ("eq", "CC", "START"):
            continue
        elif re.fullmatch(r"[A-Z]\d{2}_[A-Z0-9_]+", s):
            continue  # 标签（B80_WIK_E_0016 之类）
        else:
            print(f"{i:4d} T: {s}")


def cmd_raw(args):
    """把字符串表原样按顺序打出（不过滤）。"""
    for ch in args:
        p = chapters().get(ch.lower())
        if not p:
            print("无此章", ch)
            continue
        for i, s in enumerate(string_pool(open(p, "rb").read())):
            print(f"{i:4d} {s!r}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd, args = sys.argv[1], sys.argv[2:]
    {"seq": cmd_seq, "distinct": cmd_distinct, "who": cmd_who,
     "rows": cmd_rows, "sprite": cmd_sprite, "dump": cmd_dump,
     "mix": cmd_mix, "raw": cmd_raw}[cmd](args)


if __name__ == "__main__":
    main()

"""侦察 .chs 脚本内容：找 BGM 引用 / 楽曲菜单 / 日文文本

交接文档说「在 .chs 里搜 m01…m64 → 0 命中」。这里换几种更宽的搜法：
  - 任何 .hw / mNN / x_mNN 形态
  - 日文（把字节按 UTF-8 / UTF-16 / Shift-JIS 分别试解）
  - 「楽曲」「サウンド」「スタッフロール」等菜单词
先摸清 .chs 到底长什么样。
"""
import os, re, glob, collections

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
files = glob.glob(os.path.join(CHS, "**", "*.chs"), recursive=True)
print(f"共 {len(files)} 个 .chs\n")

# 看一个具体的
for name in ("staffroll.chs", "test_script.chs"):
    p = glob.glob(os.path.join(CHS, "**", name), recursive=True)
    if p:
        d = open(p[0], "rb").read()
        print(f"=== {name}  {len(d):,} B ===")
        print("hex[:200]:", d[:200].hex(" "))
        print("repr[:300]:", repr(d[:300]))
        # 尝试各种编码
        for enc in ("utf-8", "utf-16-le", "shift_jis", "cp932"):
            try:
                s = d.decode(enc)
                jp = sum(1 for c in s if '\u3040' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff')
                print(f"  {enc:<10} 解码成功 长度={len(s)} 日文字符={jp}")
            except Exception as ex:
                print(f"  {enc:<10} 失败: {type(ex).__name__}")
        print()

# 全局：所有 .chs 里搜资源名形态
PAT = {
    "mNN/x_mNN": re.compile(rb"\bm\d{2}\b|\bx_m\d{2}\b"),
    ".hw": re.compile(rb"\.hw"),
    "hw名": re.compile(rb"[\w]{1,20}\.hw"),
    "mu_text": re.compile(rb"mu_text\w*"),
    "data03000": re.compile(rb"data0\d{4}"),
    "imgNNNN": re.compile(rb"img\d{4}"),
}
tot = collections.Counter()
per = {}
for p in files:
    d = open(p, "rb").read()
    rel = os.path.relpath(p, CHS)
    for k, pat in PAT.items():
        h = pat.findall(d)
        if h:
            tot[k] += len(h)
            per.setdefault(k, []).append((rel, collections.Counter(
                x.decode("latin-1") for x in h).most_common(5)))

print("=== 各模式全库命中 ===")
for k in PAT:
    print(f"  {k:<12} {tot[k]:>7}")

print("\n=== 命中明细（前 15 个文件）===")
for k, lst in per.items():
    print(f"\n--- {k} （{len(lst)} 个文件命中）---")
    for rel, ex in lst[:15]:
        print(f"    {rel:<44} {ex}")

# 日文文本：把整个 .chs 当 UTF-8 解，看能不能出日文
print("\n=== 含日文（UTF-8 解）的 .chs ===")
jp_files = []
for p in files:
    d = open(p, "rb").read()
    try:
        s = d.decode("utf-8")
    except UnicodeDecodeError:
        continue
    jp = [c for c in s if '\u3040' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff']
    if jp:
        jp_files.append((os.path.relpath(p, CHS), len(jp)))
jp_files.sort(key=lambda x: -x[1])
for rel, n in jp_files[:20]:
    print(f"    {rel:<50} 日文字符 {n:,}")
print(f"  合计 {len(jp_files)} 个文件含日文")

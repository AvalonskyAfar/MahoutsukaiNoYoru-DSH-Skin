"""检查 .ctd 文本库 —— 这是真正可读的文本数据

data00200.hfa 里有 script_text_{ja,en,zc,zt}.ctd，是剧本对话文本库。
如果「楽曲」菜单的曲名、或片尾名单的文字在这里，就能直接读到。
"""
import os, re, collections

CTD = r"D:\QuickLook插件包\moye\game_scripts\ctd\data00200.hfa"
P = os.path.join(CTD, "script_text_ja.ctd")

d = open(P, "rb").read()
print(f"=== {os.path.basename(P)}  {len(d):,} 字节 ===")
print("hex[:96]:", d[:96].hex(" "))
print("repr[:96]:", repr(d[:96]))

# 各种编码尝试，统计日文/可打印比例
for enc in ("utf-8", "utf-16-le", "shift_jis", "cp932", "utf-16-be"):
    try:
        s = d.decode(enc)
        jp = sum(1 for c in s if '\u3040' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff')
        pr = sum(1 for c in s if c.isprintable() or c in '\r\n\t')
        print(f"  {enc:<10} OK  长度={len(s):>9,}  日文={jp:>8,}  可打印={pr/len(s)*100:.1f}%")
    except Exception as ex:
        print(f"  {enc:<10} FAIL {type(ex).__name__}")

print("\n=== 试 UTF-16LE 抽取可读串 ===")
try:
    s = d.decode("utf-16-le", "replace")
    # 抽取含日文的连续片段
    chunks = re.findall(r"[\u3000-\u30ff\u4e00-\u9fff\uff01-\uff60A-Za-z0-9\s、。「」『』！？…ー～・（）]{6,}", s)
    print(f"  候选文本片段 {len(chunks)} 条，前 25 条：")
    for c in chunks[:25]:
        c = c.strip()
        if c:
            print(f"    {c[:80]!r}")
except Exception as ex:
    print("  失败", ex)

# 直接找曲名
KNOWN = ["魔法使いの夜", "メインテーマ", "蒼崎青子", "久遠寺有珠", "静希草十郎",
         "メイン・OP", "FLAT SNARK", "nostalgia", "Judicare", "きみのはなし",
         "楽曲", "サウンド", "スタッフ"]
print("\n=== 在 4 个 .ctd（含 en/zc/zt）里找关键字 ===")
for fn in sorted(os.listdir(CTD)):
    dd = open(os.path.join(CTD, fn), "rb").read()
    hits = []
    for k in KNOWN:
        for enc in ("utf-8", "utf-16-le"):
            try:
                if k.encode(enc) in dd:
                    hits.append(f"{k}[{enc}]")
            except Exception:
                pass
    print(f"  {fn:<24} {'命中: ' + ', '.join(hits) if hits else '无命中'}")

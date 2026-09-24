"""解剖入口脚本的字节码 —— 找标题画面/片尾的 BGM 指令

已知：staffroll.chs 里出现过 img0408（纯黑场），说明脚本用**数值 id** 引用资源。
     img0408 → 408 = 0x198。所以资源 id 是直接以 u32 出现在字节码里的。

那么 BGM 也可能是直接引用某个数值 id。本脚本：
  1. 把 3 个入口脚本按 u32 全解码，列出所有数值
  2. 找出「看起来像资源 id」的值（< 4096）
  3. 对比 start_script（标题/开场）与 staffroll（片尾）的差异
  4. 把所有可能的候选值列出来，供人工/后续比对
"""
import os, sys, struct, collections
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

FILES = ["start_script.chs", "staffroll.chs", "archive.chs", "test_script.chs"]

for fn in FILES:
    # 找到它属于哪个归档
    data = None
    for arch in ("data01000.hfa",):
        a = Hfa(os.path.join(GAME, arch))
        e = next((x for x in a.entries if x.name == fn), None)
        if e:
            data = a.read(e)
            break
    if data is None:
        print(f"!! 未找到 {fn}")
        continue

    print("=" * 78)
    print(f"### {fn}   {len(data):,} B")
    print("=" * 78)
    print("hex:", data[:64].hex(" "))

    # 跳过 32 字节签名头
    body = data[32:]
    print(f"body {len(body)} B")

    # u32 列表
    u32 = [struct.unpack_from("<I", body, i)[0] for i in range(0, len(body) - 3, 4)]
    print(f"\nu32 序列（共 {len(u32)}）:")
    print("  ", u32[:60])

    # 统计
    c = collections.Counter(u32)
    print(f"\n  出现次数最多的值: {c.most_common(15)}")

    # 小数值 = 疑似资源 id
    small = sorted({v for v in u32 if 0 < v < 8192})
    print(f"\n  疑似资源 id (0<v<8192) 共 {len(small)} 个:")
    print("  ", small)

    # 找 0xF7 / 0xF9 之类的 opcode 模式（按 u16 看）
    u16 = [struct.unpack_from("<H", body, i)[0] for i in range(0, len(body) - 1, 2)]
    c16 = collections.Counter(u16)
    print(f"\n  u16 高频值: {c16.most_common(12)}")
    print()

# ---- 专门对比 start_script vs staffroll ----
print("=" * 78)
print("### 差异对比：start_script / staffroll 各自的全部 u32")
print("=" * 78)
res = {}
for fn in ("start_script.chs", "staffroll.chs"):
    a = Hfa(os.path.join(GAME, "data01000.hfa"))
    e = next(x for x in a.entries if x.name == fn)
    body = a.read(e)[32:]
    res[fn] = [struct.unpack_from("<I", body, i)[0] for i in range(0, len(body) - 3, 4)]

for fn, v in res.items():
    print(f"\n{fn} ({len(v)} 个 u32):")
    print("  ", v)

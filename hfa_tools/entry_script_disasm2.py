"""正确解剖入口脚本 —— 必须先 LenZu 解压

上一版直接读了压缩后的字节，等于在解压流上瞎找数值（无效）。
.chs 在归档里是 LenZuCompressor 压缩的（就是为什么每个 .chs 都以
"LenZuCompressor\\01\\0\\0\\00..." 开头）。

解压后再找：
  - start_script（标题/开场）里的资源 id
  - staffroll（片尾）里的资源 id
  - 已知 img0408 应能在 staffroll 里找到 → 用来校验解析方法对不对
"""
import os, sys, struct, collections
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME
import lenzu


def load(fn, arch="data01000.hfa"):
    a = Hfa(os.path.join(GAME, arch))
    e = next(x for x in a.entries if x.name == fn)
    raw = a.read(e)
    return raw, lenzu.decompress(raw)


for fn in ("start_script.chs", "staffroll.chs"):
    raw, dec = load(fn)
    print("=" * 78)
    print(f"### {fn}   压缩 {len(raw):,} B  ->  解压 {len(dec):,} B")
    print("=" * 78)
    print("解压后 hex[:120]:")
    print(" ", dec[:120].hex(" "))

    # 头部是 HunexCompiledScriptVer1.00\0
    sig = dec[:32]
    print("签名:", repr(sig.split(b'\x00')[0]))
    body = dec[32:]

    # ---- 校验用：找 408（img0408 的 id）----
    found408 = []
    for i in range(0, len(body) - 3):
        if struct.unpack_from("<I", body, i)[0] == 408:
            found408.append(i)
    print(f"\n  查找 u32 == 408 (img0408 的 id): {len(found408)} 处 @ {found408[:10]}")

    # 也按 u16 找
    f16 = [i for i in range(0, len(body) - 1) if struct.unpack_from("<H", body, i)[0] == 408]
    print(f"  查找 u16 == 408: {len(f16)} 处 @ {f16[:10]}")

    # ---- 列出所有数值轴上的候选 ----
    u32 = [struct.unpack_from("<I", body, i)[0] for i in range(0, len(body) - 3)]
    u16 = [struct.unpack_from("<H", body, i)[0] for i in range(0, len(body) - 1)]

    small16 = collections.Counter(v for v in u16 if 0 < v < 4096)
    print(f"\n  u16 在 (0,4096) 的取值频次（前 30）:")
    print("   ", small16.most_common(30))

    print(f"\n  解压后 body 前 200 字节（按 u16 十进制）:")
    print("   ", u16[:100])
    print()

"""测试 .hw 是否只是字节序/简单加扰问题（若属实，BGM 可直接使用）"""
import sys, os, struct, math
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### SCRAMBLE-TEST ###")


def smooth(data, endian="<"):
    """返回 相邻差分均值 / RMS，越小越像平滑波形"""
    s = data[:200000]
    s = s[:len(s) // 2 * 2]
    if len(s) < 4:
        return 99.0
    v = struct.unpack(f"{endian}{len(s)//2}h", s)
    rms = math.sqrt(sum(x * x for x in v) / len(v))
    if rms < 1:
        return 99.0
    m = min(len(v) - 1, 80000)
    dif = sum(abs(v[i + 1] - v[i]) for i in range(m)) / max(m, 1)
    return dif / rms


def byteswap(data):
    data = data[:len(data) // 2 * 2]          # 保证偶数长度
    b = bytearray(len(data))
    b[0::2] = data[1::2]
    b[1::2] = data[0::2]
    return bytes(b)


def bitrev8(data):
    tbl = bytes(int(f"{i:08b}"[::-1], 2) for i in range(256))
    return data.translate(tbl)


def xor_c(data, c):
    return bytes(x ^ c for x in data)


a = Hfa(os.path.join(GAME, "data03000.hfa"))
e = next(x for x in a.entries if x.name == "m01.hw")
d = a.read(e)
hl = struct.unpack("<I", d[:4])[0]
pcm = d[hl:]

print(f"m01.hw  头 {hl}  数据 {len(pcm):,} 字节")
print(f"  {'变换':<26}{'差/RMS':>10}   判定")
tests = [
    ("原始（小端）", pcm),
    ("原始（大端）", pcm),
    ("字节交换后（小端）", byteswap(pcm)),
    ("字节交换后（大端）", byteswap(pcm)),
    ("bit-reverse", bitrev8(pcm)),
    ("XOR 0x80", xor_c(pcm, 0x80)),
    ("XOR 0xFF", xor_c(pcm, 0xFF)),
]
for i, (label, data) in enumerate(tests):
    endian = "<" if i % 2 == 0 or i > 3 else ">"
    if i == 1:
        endian = ">"
    elif i == 3:
        endian = ">"
    r = smooth(data, endian)
    print(f"  {label:<24}{r:>10.3f}   {'✅ 平滑 → 是PCM' if r < 0.5 else '噪声样'}")

# 若字节交换 + 小端能平滑，说明是字节序问题
best = min((smooth(byteswap(pcm), "<"), "字节交换+小端"),
           (smooth(pcm, ">"), "原始+大端"),
           (smooth(pcm, "<"), "原始+小端"))
print(f"\n  最优: {best[1]}  差/RMS={best[0]:.3f}")
print("### END ###")

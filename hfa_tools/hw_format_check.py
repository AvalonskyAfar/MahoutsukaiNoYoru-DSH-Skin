"""判定 .hw 到底是 PCM 还是压缩 —— 对不同大小/用途的文件做统计"""
import sys, os, struct, math
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### HW-FORMAT-CHECK ###")


def stats(pcm, n=200000):
    s = pcm[:n]
    s = s[:len(s) // 2 * 2]
    v = struct.unpack(f"<{len(s)//2}h", s)
    if not v:
        return 0, 0, 0
    rms = math.sqrt(sum(x * x for x in v) / len(v))
    pk = max(abs(x) for x in v)
    m = min(len(v) - 1, 80000)
    dif = sum(abs(v[i + 1] - v[i]) for i in range(m)) / max(m, 1)
    return rms, pk, dif


tests = [
    ("data00300.hfa", "SSEDecided.hw",     "UI音效 小"),
    ("data00300.hfa", "SSETurnedPage.hw",  "UI音效 小"),
    ("data03000.hfa", "m54.hw",            "BGM 最小"),
    ("data03000.hfa", "m01.hw",            "BGM 主主题"),
    ("data03100.hfa", "seed01.hw",         "音效 大"),
    ("data04000.hfa", "b70_2_4_0039.hw",   "语音"),
]
for af, nm, label in tests:
    a = Hfa(os.path.join(GAME, af))
    e = next((x for x in a.entries if x.name == nm), None)
    if not e:
        print(f"  {label:<12} {nm:<20} 未找到")
        continue
    d = a.read(e)
    hl = struct.unpack("<I", d[:4])[0]
    rate = struct.unpack("<I", d[16:20])[0]
    ch = struct.unpack("<I", d[20:24])[0]
    f3 = struct.unpack("<I", d[12:16])[0]
    pcm = d[hl:]
    rms, pk, dif = stats(pcm)
    ratio = dif / max(rms, 1)
    verdict = "PCM(平滑)" if ratio < 0.5 else "非PCM(噪声样)"
    print(f"  {label:<12} {nm:<20} hdr={hl} {rate}Hz {ch}ch "
          f"len={len(pcm):>9,} f3={f3:>10,} RMS={rms:7.1f} 差/RMS={ratio:5.2f} → {verdict}")
print("### END ###")

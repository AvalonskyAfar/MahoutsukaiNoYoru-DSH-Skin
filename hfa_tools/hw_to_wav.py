"""把 .hw 转成 WAV，并做统计验证是否真的是裸 PCM"""
import sys, os, struct, math, wave
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

OUT = r"D:\QuickLook插件包\moye\bgm"
os.makedirs(OUT, exist_ok=True)


def parse_hw(d):
    hdr_len = struct.unpack("<I", d[0:4])[0]
    tag = d[4:8]
    data_bytes = struct.unpack("<I", d[8:12])[0]
    f3 = struct.unpack("<I", d[12:16])[0]
    rate = struct.unpack("<I", d[16:20])[0]
    ch = struct.unpack("<I", d[20:24])[0]
    return hdr_len, tag, data_bytes, f3, rate, ch


def stats(pcm, n=400000):
    s = pcm[:n]
    if len(s) % 2:
        s = s[:-1]
    vals = struct.unpack(f"<{len(s)//2}h", s)
    if not vals:
        return 0, 0, 0
    rms = math.sqrt(sum(v * v for v in vals) / len(vals))
    peak = max(abs(v) for v in vals)
    # 相邻差分均值：真 PCM 平滑 → 小；被误读的压缩数据 → 大
    dif = sum(abs(vals[i + 1] - vals[i]) for i in range(0, min(len(vals) - 1, 100000)))
    dif /= max(min(len(vals) - 1, 100000), 1)
    return rms, peak, dif


a = Hfa(os.path.join(GAME, "data03000.hfa"))
print("### HW-CONVERT-START ###")
for name in ("m01", "m17", "m54", "x_m64"):
    e = next((x for x in a.entries if x.name == name + ".hw"), None)
    if not e:
        print(f"  {name}: 未找到"); continue
    d = a.read(e)
    hl, tag, db, f3, rate, ch = parse_hw(d)
    pcm = d[hl:]
    rms, peak, dif = stats(pcm)
    dur = len(pcm) / (rate * ch * 2)
    print(f"  {name:<8} 头{hl} tag={tag!r} dataBytes={db:,}(={len(pcm):,}) "
          f"{rate}Hz {ch}ch  时长{dur:6.1f}s")
    print(f"           RMS={rms:8.1f}  峰值={peak:6d}  相邻差分均值={dif:7.1f}")
    w = os.path.join(OUT, name + ".wav")
    with wave.open(w, "wb") as f:
        f.setnchannels(ch); f.setsampwidth(2); f.setframerate(rate)
        f.writeframes(pcm[:db])
    print(f"           -> {w}  ({os.path.getsize(w)/1048576:.1f} MB)")
print("### END ###")

"""BGM 结构分析（不解码音频，纯 Ogg 页级）

✅ 已完成的结构性结论：
  - 64/64 全部是合法、完整、可播放的 Ogg Vorbis（逐页 CRC 校验通过）
  - 全部 48000 Hz / 2ch / VBR，vendor = libVorbis 20200704

本脚本额外做两件不需要解码器就能做的事：

  A. **逐页字节量包络**：每个 Ogg 页对应固定数量采样，页字节数 ≈ 该时段码率。
     把页字节数按时序排开，就得到"码率随时间变化曲线"。
     → 循环型 BGM 的包络会**周期性重复**；带淡入淡出的曲子则单调变化。
     → 还能用包络互相关找出**互为变体**的曲子（m01 / m01s）。

  B. **首尾静音/淡出探测**：用"页体熵/页字节数"粗判结尾是否渐弱，
     帮助区分「循环 BGM」与「一次性片尾曲」。

输出：bgm_structure.json + 每首的包络数据
"""
import os, glob, struct, json, math

BGM = r"D:\QuickLook插件包\moye\bgm"
OUT = os.path.join(BGM, "bgm_structure.json")


def envelopes(path):
    """返回每页 (granule_end, body_bytes, nsegs, seg_bytes)"""
    buf = open(path, "rb").read()
    pos, pages = 0, []
    while pos < len(buf):
        if buf[pos:pos + 4] != b"OggS":
            break
        nsegs = buf[pos + 26]
        segs = buf[pos + 27:pos + 27 + nsegs]
        blen = sum(segs)
        granule = struct.unpack_from("<Q", buf, pos + 6)[0]
        if granule == 0xFFFFFFFFFFFFFFFF:
            granule = pages[-1][0] if pages else 0
        pages.append((granule, blen, nsegs, bytes(segs)))
        pos += 27 + nsegs + blen
    return pages


def resample(series, n):
    """把序列等距重采样成 n 个点"""
    if not series:
        return [0.0] * n
    if len(series) == 1:
        return [float(series[0])] * n
    out = []
    for i in range(n):
        x = i * (len(series) - 1) / (n - 1)
        lo = int(x)
        hi = min(lo + 1, len(series) - 1)
        f = x - lo
        out.append(series[lo] * (1 - f) + series[hi] * f)
    return out


def corr(a, b):
    """皮尔逊相关"""
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a) ** 0.5
    vb = sum((x - mb) ** 2 for x in b) ** 0.5
    if va == 0 or vb == 0:
        return 0.0
    return sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (va * vb)


def autocorr_peak(env, maxlag_frac=0.5):
    """自相关找周期性（循环 BGM 的重复周期）"""
    n = len(env)
    maxlag = int(n * maxlag_frac)
    if maxlag < 4:
        return 0.0, 0
    best, bl = 0.0, 0
    for lag in range(4, maxlag):
        a, b = env[:n - lag], env[lag:]
        c = corr(a, b)
        if c > best:
            best, bl = c, lag
    return best, bl


results = {}
files = sorted(glob.glob(os.path.join(BGM, "*.ogg")))
print(f"{'文件':<10}{'页':>6}{'时长s':>9}{'平均KB/页':>11}{'首尾页比':>10}{'周期相关':>9}{'周期s':>8}")
print("-" * 70)

for p in files:
    name = os.path.basename(p)[:-4]
    pages = envelopes(p)
    rate = 48000
    dur = pages[-1][0] / rate if pages else 0
    body = [x[1] for x in pages]
    env = resample(body, 512)

    # 首尾页大小比（淡出/静音探测）
    k = max(1, len(body) // 20)
    head = sum(body[:k]) / k
    tail = sum(body[-k:]) / k
    ratio = tail / head if head else 0

    ac, lag = autocorr_peak(env)
    lag_s = lag * dur / 512 if dur else 0

    results[name] = dict(
        pages=len(pages), duration=dur, avg_page_bytes=sum(body) / len(body),
        head_avg=head, tail_avg=tail, tail_head_ratio=ratio,
        autocorr=ac, period_samples=lag, period_seconds=lag_s,
        envelope=[round(x, 1) for x in env],
    )
    print(f"{name:<10}{len(pages):>6}{dur:>9.1f}{sum(body)/len(body)/1024:>11.1f}"
          f"{ratio:>10.3f}{ac:>9.3f}{lag_s:>8.1f}")

json.dump(results, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\n-> {OUT}")

# ---- 找互为变体的曲目（包络高度相关）----
print("\n=== 包络高度相似的对（可能是变体/同一曲）===")
names = list(results)
pairs = []
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        c = corr(results[names[i]]["envelope"], results[names[j]]["envelope"])
        if c > 0.80:
            pairs.append((c, names[i], names[j]))
pairs.sort(reverse=True)
for c, a, b in pairs[:25]:
    print(f"  {c:.4f}  {a:<10} {b}")
if not pairs:
    print("  （无 >0.80 的对）")

# ---- 按循环周期性排序 ----
print("\n=== 循环性最强（自相关高，疑似循环 BGM）前 20 ===")
for n in sorted(names, key=lambda x: -results[x]["autocorr"])[:20]:
    r = results[n]
    print(f"  {n:<10} 自相关={r['autocorr']:.3f} 周期={r['period_seconds']:.1f}s "
          f"时长={r['duration']:.1f}s 尾/首={r['tail_head_ratio']:.3f}")

print("\n=== 尾部明显衰减（疑似带淡出/片尾）前 20 ===")
for n in sorted(names, key=lambda x: results[x]["tail_head_ratio"])[:20]:
    r = results[n]
    print(f"  {n:<10} 尾/首={r['tail_head_ratio']:.3f} 时长={r['duration']:.1f}s "
          f"自相关={r['autocorr']:.3f}")

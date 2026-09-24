/**
 * 精修对齐 —— 判定 m01s 是否就是 m01 的一段（同录音剪辑）
 *
 * 上一版用"整段包络"做互相关，对**速度/长度不同**的段落会失败。
 * 这版改成分段证据：
 *   1. 在 m01 上滑动，对每个候选偏移取 m01s 的前 N 秒，
 *      在**更细的帧率**下算相关，并找出相关性最高的时刻（不假设全程一致）
 *   2. 报告「m01s 的每一秒在 m01 里最像哪一秒」以看是否有线性关系（能反推速度比）
 *   3. 对 m55/m56 做样本级残差验证（确证是否同一录音）
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WAV = String.raw`D:\QuickLook插件包\moye\bgm\wav`;

function readWavMono(path) {
  const b = readFileSync(path);
  let o = 12, fmt = null, dataOff = -1, dataLen = 0;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(o + 10), sampleRate: b.readUInt32LE(o + 12) };
    else if (id === "data") { dataOff = o + 8; dataLen = sz; break; }
    o += 8 + sz + (sz % 2);
  }
  const n = Math.floor(dataLen / (fmt.channels * 2));
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += b.readInt16LE(dataOff + (i * fmt.channels + c) * 2) / 32768;
    m[i] = s / fmt.channels;
  }
  return { m, sr: fmt.sampleRate, n };
}

function pearsonAt(a, b, offA, offB, len) {
  const L = Math.min(len, a.length - offA, b.length - offB);
  if (L < 512) return { c: 0, L: 0 };
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < L; i++) {
    const x = a[offA + i], y = b[offB + i];
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  const num = L * sab - sa * sb;
  const den = Math.sqrt((L * saa - sa * sa) * (L * sbb - sb * sb));
  return { c: den > 0 ? num / den : 0, L };
}

// ---- m55 / m56：是否同一录音（残差） ----
console.log("### m55 vs m56 —— 同一录音验证 ###");
{
  const a = readWavMono(join(WAV, "m55.wav"));
  const b = readWavMono(join(WAV, "m56.wav"));
  const L = Math.min(a.n, b.n);
  const { c } = pearsonAt(a.m, b.m, 0, 0, L);
  // 残差能量比
  let diff = 0, ref = 0;
  for (let i = 0; i < L; i++) { const d = a.m[i] - b.m[i]; diff += d * d; ref += a.m[i] * a.m[i]; }
  console.log(`  重叠区长度 = ${(L / a.sr).toFixed(2)}s (= m55 全长)`);
  console.log(`  样本级相关 = ${c.toFixed(5)}`);
  console.log(`  残差/参考 能量比 = ${(diff / ref).toFixed(6)}  (0 = 完全相同)`);
  console.log(`  m56 多出的尾巴 = ${((b.n - a.n) / b.sr).toFixed(2)}s`);
  console.log(`  判定: ${c > 0.95 ? "★ 同一录音，m56 = m55 + 额外段落" : c > 0.5 ? "高度相似" : "不同"}`);
}

// ---- m01 vs m01s ----
console.log("\n### m01 vs m01s —— 是否同录音剪辑 ###");
{
  const A = readWavMono(join(WAV, "m01.wav"));   // 304.48s
  const B = readWavMono(join(WAV, "m01s.wav"));  // 199.16s
  console.log(`  m01 = ${(A.n / A.sr).toFixed(2)}s   m01s = ${(B.n / B.sr).toFixed(2)}s`);

  // 1) B 的前 10 秒，在 A 全程滑动，找最像的位置（步进 10ms）
  const win = 10 * A.sr;
  let best = { c: -2, off: 0 };
  for (let off = 0; off + win <= A.n; off += 480) {
    const { c } = pearsonAt(A.m, B.m, off, 0, win);
    if (c > best.c) best = { c, off };
  }
  console.log(`\n  [B 前10s] 在 A 中最佳位置 = ${(best.off / A.sr).toFixed(2)}s   相关 = ${best.c.toFixed(4)}`);

  // 2) B 的中段/尾段 10 秒，各自在 A 中找最佳位置 -> 看是否有线性关系
  console.log(`\n  B 各时间点 → 在 A 中的最佳匹配位置:`);
  const pts = [];
  for (const t of [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 195]) {
    const offB = t * B.sr;
    if (offB + win > B.n) break;
    let bb = { c: -2, off: 0 };
    for (let off = 0; off + win <= A.n; off += 480) {
      const { c } = pearsonAt(A.m, B.m, off, offB, win);
      if (c > bb.c) bb = { c, off };
    }
    pts.push([t, bb.off / A.sr, bb.c]);
    console.log(`    B@${String(t).padStart(3)}s  ->  A@${bb.off / A.sr > 999 ? "N/A" : (bb.off / A.sr).toFixed(2).padStart(7)}s   相关=${bb.c.toFixed(4)}`);
  }

  // 3) 线性拟合，看速度比
  const good = pts.filter((p) => p[2] > 0.5);
  if (good.length >= 3) {
    const n = good.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const [x, y] of good) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const icept = (sy - slope * sx) / n;
    console.log(`\n  线性拟合 A ≈ ${slope.toFixed(4)} × B + ${icept.toFixed(2)}    (样本点 ${n} 个, 相关>0.5)`);
    console.log(`  → 速度比 = ${slope.toFixed(4)}  (1.0 = 同速同录音)`);
  } else {
    console.log(`\n  高置信匹配点只有 ${good.length} 个 —— B 的段落**无法**稳定映射到 A`);
  }

  // 4) 全长最强相关（允许任意偏移，粗步进）
  let g = { c: -2, off: 0 };
  for (let off = 0; off + Math.min(B.n, 30 * A.sr) <= A.n; off += 2400) {
    const { c } = pearsonAt(A.m, B.m, off, 0, 30 * A.sr);
    if (c > g.c) g = { c, off };
  }
  console.log(`\n  B 前30s 对 A 全程最强相关 = ${g.c.toFixed(4)} @ A+${(g.off / A.sr).toFixed(2)}s`);
}

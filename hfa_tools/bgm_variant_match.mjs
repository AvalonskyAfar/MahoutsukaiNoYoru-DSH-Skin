/**
 * 变体关系判定 —— 回答"文件编号是否 = 楽曲菜单序"的关键实验
 *
 * 交接文档观察到：
 *    m01  = 6.33 MB, 5:04   ← 疑似主主题
 *    m01s = 4.17 MB, 3:19   ← "m01 的变体"
 *    x_m64= 5.03 MB, 4:03   ← "m64 的变体"（但没有 m64）
 * 且 **m20 缺失**。
 *
 * 如果 m01s 只是 m01 的**截短版**（同一录音，剪掉一段），
 * 那说明命名规则是「同一曲的不同剪辑」，菜单序号 ≠ 文件编号。
 * 如果 m01s 是**独立的另一首曲子**，则 s 表示别的含义。
 *
 * 做法：把两段 PCM 降采样成粗包络，全偏移互相关找最佳对齐，
 *       再在最佳对齐附近做样本级皮尔逊相关。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BGM = String.raw`D:\QuickLook插件包\moye\bgm`;
const WAV = join(BGM, "wav");

function readWav(path) {
  const b = readFileSync(path);
  // 找 data chunk
  let o = 12;
  let fmt = null, dataOff = -1, dataLen = 0;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") {
      fmt = {
        channels: b.readUInt16LE(o + 10),
        sampleRate: b.readUInt32LE(o + 12),
        bits: b.readUInt16LE(o + 22),
      };
    } else if (id === "data") {
      dataOff = o + 8; dataLen = sz; break;
    }
    o += 8 + sz + (sz % 2);
  }
  const n = Math.floor(dataLen / (fmt.channels * 2));
  const ch = Array.from({ length: fmt.channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      ch[c][i] = b.readInt16LE(dataOff + (i * fmt.channels + c) * 2) / 32768;
    }
  }
  return { ...fmt, n, ch };
}

/** 多声道混单声道 */
function mono(w) {
  const m = new Float32Array(w.n);
  for (let c = 0; c < w.ch.length; c++)
    for (let i = 0; i < w.n; i++) m[i] += w.ch[c][i] / w.ch.length;
  return m;
}

/** 降采样成 hop 长度的 RMS 包络 */
function envelope(m, hop) {
  const nf = Math.floor(m.length / hop);
  const e = new Float32Array(nf);
  for (let f = 0; f < nf; f++) {
    let s = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) s += m[i] * m[i];
    e[f] = Math.sqrt(s / hop);
  }
  return e;
}

function pearson(a, b, offA, offB, len) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < len; i++) {
    const x = a[offA + i], y = b[offB + i];
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  const num = len * sab - sa * sb;
  const den = Math.sqrt((len * saa - sa * sa) * (len * sbb - sb * sb));
  return den > 0 ? num / den : 0;
}

/** 粗对齐：在包络上滑窗找最佳偏移 */
function bestAlign(ea, eb) {
  const hop = 2400; // 50ms @48k
  const len = Math.min(ea.length, eb.length);
  const probe = Math.floor(len * 0.5); // 用一半长度做探针
  let best = { c: -2, off: 0 };
  const maxOff = ea.length - probe;
  for (let off = 0; off <= maxOff; off += 2) {
    const c = pearson(ea, eb, off, 0, probe);
    if (c > best.c) best = { c, off };
  }
  // 细化
  for (let off = Math.max(0, best.off - 3); off <= Math.min(maxOff, best.off + 3); off++) {
    const c = pearson(ea, eb, off, 0, probe);
    if (c > best.c) best = { c, off };
  }
  return { ...best, samples: best.off * hop, seconds: (best.off * hop) / 48000 };
}

/** 样本级相关（用小片段避免太慢） */
function sampleCorr(a, b, offA, offB, len) {
  const L = Math.min(len, a.length - offA, b.length - offB);
  if (L < 1000) return 0;
  return pearson(a, b, offA, offB, L);
}

const PAIRS = [
  ["m01", "m01s"],
  ["m01", "x_m64"],
  ["m01s", "x_m64"],
  ["m01", "m03"],
  ["m55", "m56"],
  ["m57", "m58"],
  ["m54", "m57"],
];

console.log("加载 WAV ...");
const cache = {};
for (const p of PAIRS) for (const n of p) if (!cache[n]) cache[n] = readWav(join(WAV, `${n}.wav`));
const monoCache = {};
for (const n of Object.keys(cache)) monoCache[n] = mono(cache[n]);
console.log("就绪\n");

console.log("=".repeat(78));
for (const [A, B] of PAIRS) {
  const ma = monoCache[A], mb = monoCache[B];
  const ea = envelope(ma, 2400), eb = envelope(mb, 2400);
  const al = bestAlign(ea, eb);
  const durA = ma.length / 48000, durB = mb.length / 48000;

  // 在最佳对齐处做样本级相关（取 20 秒）
  const win = 48000 * 20;
  let sc = 0;
  if (al.samples >= 0 && al.samples + win < ma.length) {
    sc = sampleCorr(ma, mb, al.samples, 0, win);
  }

  // 长度关系
  const ratio = durA / durB;
  const tailMatch = Math.abs(durA - durB);

  console.log(`\n${A} (${durA.toFixed(2)}s)  vs  ${B} (${durB.toFixed(2)}s)`);
  console.log(`  包络最佳对齐: ${B} 相对 ${A} 偏移 ${al.seconds.toFixed(2)}s   包络相关=${al.c.toFixed(4)}`);
  console.log(`  样本级相关(对齐处20s窗口) = ${sc.toFixed(4)}`);
  console.log(`  时长比 A/B = ${ratio.toFixed(3)}   时长差 = ${tailMatch.toFixed(2)}s`);
  const verdict =
    (al.c > 0.85 && Math.abs(sc) > 0.2) ? "★ 极可能是同一首曲子（剪辑/变体）" :
    al.c > 0.6 ? "可能相关（同一首的段落？）" : "不像同一首";
  console.log(`  判定: ${verdict}`);
}
console.log("\n" + "=".repeat(78));

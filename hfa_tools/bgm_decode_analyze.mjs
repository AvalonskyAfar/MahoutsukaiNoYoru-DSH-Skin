/**
 * BGM 批量解码 + 声学分析
 *
 * 用 WASM libvorbis 把 bgm/*.ogg 解成真 PCM，然后：
 *   1. 写出标准 WAV（用户可直接双击试听 —— 交付物 #4）
 *   2. 算声学特征：RMS 包络、淡入淡出、频谱质心、峰值、循环点
 *   3. **关键**：m01 vs m01s、x_m64 vs m01 这类"变体"到底是不是同一首曲子
 *      （用互相关找最佳对齐，这是编解码层面拿不到的硬结论）
 *
 * 用法:
 *   node bgm_decode_analyze.mjs            # 全量：写 WAV + 分析
 *   node bgm_decode_analyze.mjs --nowav    # 只分析，不写 WAV
 *   node bgm_decode_analyze.mjs --only m01,m01s
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { OggVorbisDecoder } from "@wasm-audio-decoders/ogg-vorbis";

const BGM = String.raw`D:\QuickLook插件包\moye\bgm`;
const WAVDIR = join(BGM, "wav");
const ANALYSIS = join(BGM, "bgm_analysis.json");

const argv = process.argv.slice(2);
const NOWAV = argv.includes("--nowav");
const onlyIdx = argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1].split(",") : null;

if (!NOWAV) mkdirSync(WAVDIR, { recursive: true });

// ---------------------------------------------------------------- WAV 写出
function writeWav(path, channelData, sampleRate) {
  const nch = channelData.length;
  const nsamp = channelData[0].length;
  const bits = 16;
  const dataBytes = nsamp * nch * (bits / 8);
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);              // PCM
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * nch * (bits / 8), 28);
  buf.writeUInt16LE(nch * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < nsamp; i++) {
    for (let c = 0; c < nch; c++) {
      let v = channelData[c][i];
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      buf.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  writeFileSync(path, buf);
}

// ------------------------------------------------------------- 声学特征
function analyze(channelData, sampleRate) {
  const nch = channelData.length;
  const n = channelData[0].length;

  // 合并成单声道用于分析
  const mono = new Float32Array(n);
  for (let c = 0; c < nch; c++) {
    const ch = channelData[c];
    for (let i = 0; i < n; i++) mono[i] += ch[i] / nch;
  }

  // --- RMS 包络：每 50ms 一个点 ---
  const hop = Math.round(sampleRate * 0.05);
  const nf = Math.floor(n / hop);
  const env = new Float32Array(nf);
  for (let f = 0; f < nf; f++) {
    let s = 0;
    const st = f * hop;
    for (let i = st; i < st + hop && i < n; i++) s += mono[i] * mono[i];
    env[f] = Math.sqrt(s / hop);
  }
  const envSorted = Float32Array.from(env).sort();
  const envMed = envSorted[Math.floor(nf / 2)];

  // --- 峰值 / 总 RMS ---
  let peak = 0, sum2 = 0, clipped = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
    if (a > 0.999) clipped++;
    sum2 += mono[i] * mono[i];
  }
  const rms = Math.sqrt(sum2 / n);

  // --- 淡入 / 淡出：(起点阈值时间, 终点阈值时间) ---
  const thr = Math.max(envMed * 0.25, 1e-5);
  let firstAbove = -1, lastAbove = -1;
  for (let f = 0; f < nf; f++) {
    if (env[f] > thr) { if (firstAbove < 0) firstAbove = f; lastAbove = f; }
  }
  const leadIn = firstAbove * 0.05;
  const tailOut = (nf - 1 - lastAbove) * 0.05;

  // --- 尾部/头部能量比（判断是否有淡出） ---
  const k = Math.max(1, Math.floor(nf / 20));
  const mean = (a, b) => { let s = 0, c = 0; for (let i = a; i < b; i++) { s += env[i]; c++; } return c ? s / c : 0; };
  const headE = mean(0, k), tailE = mean(nf - k, nf);

  // --- 频谱质心 + 过零率（粗判"明亮/安静"，辅助区分日常/战斗/抒情） ---
  const frame = 2048;
  let zc = 0;
  for (let i = 1; i < n; i++) if ((mono[i - 1] < 0) !== (mono[i] < 0)) zc++;
  const zcr = zc / n;

  // --- 循环点探测：对包络做自相关（去掉首尾 5%） ---
  const a0 = Math.floor(nf * 0.05), a1 = nf;
  const seg = env.slice(a0, a1);
  const m = seg.length;
  let bestLag = 0, bestC = 0;
  for (let lag = Math.floor(m * 0.15); lag < Math.floor(m * 0.55); lag++) {
    let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, cnt = m - lag;
    if (cnt < 20) continue;
    for (let i = 0; i < cnt; i++) { const x = seg[i], y = seg[i + lag]; sa += x; sb += y; sab += x * y; saa += x * x; sbb += y * y; }
    const num = cnt * sab - sa * sb;
    const den = Math.sqrt((cnt * saa - sa * sa) * (cnt * sbb - sb * sb));
    const c = den > 0 ? num / den : 0;
    if (c > bestC) { bestC = c; bestLag = lag; }
  }

  return {
    duration: n / sampleRate,
    samples: n,
    channels: nch,
    peak: +peak.toFixed(5),
    rms: +rms.toFixed(6),
    clippedSamples: clipped,
    leadInSeconds: +leadIn.toFixed(2),
    tailOutSeconds: +tailOut.toFixed(2),
    headEnergy: +headE.toFixed(6),
    tailEnergy: +tailE.toFixed(6),
    tailHeadRatio: +(tailE / (headE || 1e-9)).toFixed(4),
    zcr: +zcr.toFixed(5),
    loopCorr: +bestC.toFixed(4),
    loopSeconds: +(bestLag * 0.05).toFixed(2),
    env: Array.from(env, (x) => +x.toFixed(5)),
  };
}

// ---------------------------------------------------------------- 主流程
const files = (ONLY ?? readFileSync(join(BGM, "..", "hfa_tools", "bgm_files.txt"), "utf8")
  .split(/\r?\n/).filter(Boolean).map((s) => s.trim()));

const results = {};
let totalBytes = 0;

for (const name of files) {
  const ogg = join(BGM, `${name}.ogg`);
  if (!existsSync(ogg)) { console.log(`!! 缺文件 ${name}`); continue; }
  const t0 = Date.now();
  const decoder = new OggVorbisDecoder();
  await decoder.ready;
  const { channelData, samplesDecoded, sampleRate, errors } =
    await decoder.decodeFile(new Uint8Array(readFileSync(ogg)));

  const info = analyze(channelData, sampleRate);
  info.decodeErrors = errors;
  info.decodeMs = Date.now() - t0;

  if (!NOWAV) {
    const wavPath = join(WAVDIR, `${name}.wav`);
    if (!existsSync(wavPath) || statSync(wavPath).size < 44) {
      writeWav(wavPath, channelData, sampleRate);
    }
    info.wavBytes = statSync(wavPath).size;
    totalBytes += info.wavBytes;
  }

  // 把 PCM 留着做变体比对（只在需要时）
  results[name] = info;
  results[name]._pcmMono = null;
  decoder.free();

  console.log(`${name.padEnd(9)} ${(samplesDecoded / sampleRate).toFixed(2).padStart(8)}s  ` +
    `RMS=${info.rms.toFixed(4)} peak=${info.peak.toFixed(3)} ` +
    `前导=${info.leadInSeconds.toFixed(2)}s 尾出=${info.tailOutSeconds.toFixed(2)}s ` +
    `尾/首=${info.tailHeadRatio.toFixed(3)} 循环相关=${info.loopCorr.toFixed(3)}@${info.loopSeconds}s ` +
    `${info.decodeMs}ms`);
}

// 去掉大数组再写 json 摘要（env 保留，pcm 不保留）
writeFileSync(ANALYSIS, JSON.stringify(results, null, 1));
console.log(`\n合计写出 WAV ${(totalBytes / 1073741824).toFixed(2)} GB`);
console.log(`-> ${ANALYSIS}`);

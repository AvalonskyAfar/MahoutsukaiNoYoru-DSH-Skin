/**
 * Ogg Vorbis 解码自检 —— 先确认这个 WASM 解码器在本机真能跑
 *
 * 直接用 b"OggS" 之后的整段 Ogg 数据喂给解码器（就是 bgm/*.ogg 的内容）。
 * 校验点：解出来的采样数 × 1/48000 是否 == .hw 头部声明的时长。
 */
import { readFileSync } from "node:fs";
import { OggVorbisDecoder } from "@wasm-audio-decoders/ogg-vorbis";

const path = process.argv[2] ?? String.raw`D:\QuickLook插件包\moye\bgm\m01.ogg`;

const data = new Uint8Array(readFileSync(path));
console.log(`输入: ${path}`);
console.log(`字节: ${data.length.toLocaleString()}`);

const t0 = Date.now();
const decoder = new OggVorbisDecoder();
await decoder.ready;
console.log(`WASM 就绪，耗时 ${Date.now() - t0} ms`);

const t1 = Date.now();
const { channelData, samplesDecoded, sampleRate, errors } =
  await decoder.decodeFile(data);
const ms = Date.now() - t1;

console.log(`errors       = ${JSON.stringify(errors)}`);
console.log(`sampleRate   = ${sampleRate}`);
console.log(`channels     = ${channelData.length}`);
console.log(`samplesDecoded = ${samplesDecoded.toLocaleString()}`);
console.log(`时长         = ${(samplesDecoded / sampleRate).toFixed(3)} s`);
console.log(`解码耗时     = ${ms} ms  (${(samplesDecoded / sampleRate / (ms / 1000)).toFixed(1)}x 实时)`);

if (channelData[0]) {
  const ch0 = channelData[0];
  let peak = 0, sum = 0;
  for (let i = 0; i < ch0.length; i++) {
    const v = ch0[i];
    if (Math.abs(v) > peak) peak = Math.abs(v);
    sum += v * v;
  }
  console.log(`左声道 peak = ${peak.toFixed(4)}  RMS = ${Math.sqrt(sum / ch0.length).toFixed(5)}`);
}

decoder.free();

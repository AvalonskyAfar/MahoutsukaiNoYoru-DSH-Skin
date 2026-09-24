#!/usr/bin/env node
/**
 * clean-orphan-sprites.mjs —— 删掉 `skin/assets/sprite/` 里**未被 manifest 引用**的立绘。
 *
 * ## 为什么会有孤儿
 * `skin/tools/assemble-assets.mjs` 读的是**旧立绘管线**的 `persona_work/stage/expressions.json`
 * （装的是 `.mzp.png` 名字），而线上 manifest 用的是 `stage_<景>_c<通道>_<帧>.png`（来自
 * `build_stage_sprites.py` + `apply_stage_manifest.py`）。两者不同源。
 * 2026-09-20 有人跑了那个生成器，它**把 157 个旧命名立绘拷进了 assets/sprite/**
 * （manifest 随后被还原，文件没有）→ 30.3 MB 死重量，且会让"立绘多少张"这种统计失真。
 *
 * ## 安全性
 * manifest 是立绘的**唯一引用来源**（`pickSprite()` 只从 `manifest.expressions[景].slots` 取图），
 * 所以未被引用的文件**在运行时永远取不到**。原图都还在 `hfa_png/out/`，可随时重烘。
 *
 * 用法：
 *   node persona_work/tools/clean-orphan-sprites.mjs           # 试跑，只列清单
 *   node persona_work/tools/clean-orphan-sprites.mjs --delete  # 真删（先写清单到 .tmp）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SPRITE = path.join(ROOT, 'skin', 'assets', 'sprite')
const MANIFEST = path.join(ROOT, 'skin', 'data', 'manifest.json')

const mani = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))

/** 收集被引用的**立绘**文件名（只认 `sprite/` 前缀）。
 *  ★ 第一版把 ui/bg 的名字也塞进同一个集合（丢了目录前缀），于是误报 48 个"缺失" —— 分开收集。 */
const referenced = new Set()
for (const e of Object.values(mani.expressions || {})) {
  for (const list of Object.values(e.slots || {})) {
    for (const f of list) referenced.add(String(f).replace(/^sprite\//, ''))
  }
}

const disk = fs.readdirSync(SPRITE)
const orphans = disk.filter((f) => !referenced.has(f))

// 安全闸：只删"没被引用"且"看起来是立绘"的文件，且绝不删 stage_* 之外的意外文件时先报告
const deletable = orphans.filter((f) => /\.png$/i.test(f))
const skipped = orphans.filter((f) => !/\.png$/i.test(f))

let bytes = 0
for (const f of deletable) bytes += fs.statSync(path.join(SPRITE, f)).size

console.log('=== skin/assets/sprite 孤儿审计 ===')
console.log('  manifest 引用唯一文件 :', referenced.size)
console.log('  磁盘文件              :', disk.length)
console.log('  未被引用              :', orphans.length)
console.log('  其中可删（.png）      :', deletable.length, `(${(bytes / 1024 / 1024).toFixed(1)} MB)`)
if (skipped.length) console.log('  非 png、跳过           :', skipped.length, skipped.slice(0, 5).join(' '))

// 引用但缺失 = 更严重的反向问题
const missing = [...referenced].filter((f) => !disk.includes(f))
console.log('  引用但磁盘缺失        :', missing.length, missing.slice(0, 5).join(' '))

const byKind = {}
for (const f of deletable) {
  const k = /\.mzp\.png$/i.test(f) ? '旧命名 <角色>_<批次>_<i3>_<通道>_<帧>.mzp.png'
    : /^stage_/i.test(f) ? 'stage_*（竟然未被引用 —— 要查）' : '其它'
  byKind[k] = (byKind[k] || 0) + 1
}
console.log('\n=== 孤儿分类 ===')
for (const [k, n] of Object.entries(byKind)) console.log(`  ${n.toString().padStart(4)}  ${k}`)

if (!process.argv.includes('--delete')) {
  console.log('\n（试跑：加 --delete 才真删；会先把清单写到 persona_work/tmp/）')
  process.exit(0)
}

const listPath = path.join(ROOT, 'persona_work', 'tmp', 'orphan-sprites-deleted.csv')
fs.mkdirSync(path.dirname(listPath), { recursive: true })
fs.writeFileSync(listPath,
  'name,bytes\n' + deletable.map((f) => `${f},${fs.statSync(path.join(SPRITE, f)).size}`).join('\n'), 'utf8')
for (const f of deletable) fs.unlinkSync(path.join(SPRITE, f))

const after = fs.readdirSync(SPRITE)
console.log('\n已删除', deletable.length, '个文件')
console.log('清单 ->', path.relative(ROOT, listPath))
console.log('删除后磁盘文件 :', after.length)
console.log('引用仍在磁盘   :', [...referenced].filter((f) => after.includes(f)).length, '/', referenced.size)

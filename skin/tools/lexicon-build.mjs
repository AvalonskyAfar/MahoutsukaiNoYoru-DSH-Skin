/**
 * lexicon-build.mjs —— 中文情绪词表的**唯一**生成处。
 * ------------------------------------------------------------------
 * 由 `assemble-assets.mjs`（全量装配）与 `rebuild-lexicon.mjs`（只重算词表）共用，
 * 避免"改了一处、另一处没跟上"。
 *
 * 来源分层（全部来自已交付产物 + 归纳词根，不自创语义）：
 *   1. `cn_predicates.json` 的 `dialogue[].condition_zh`（人写的中文触发条件，权重 30）
 *   2. 同上 `narration[].action_class_zh`（动作类名，如「睨む・横目」，权重 2~6）
 *   3. 同上 `runtime[].condition`（运行时触发，权重 20）
 *   4. 同上 `slot_hints_zh`（12 槽位的中文视觉定义，权重 12）
 *   5. **情绪词根 ROOTS**（本项目手写，权重 40）
 *
 * ★★ 2026-09-19 修掉的三处（原先导致官方简中剧本命中率只有 9.1%）：
 *   A. `bump()` 里一条 `word.length < 2`，把 ROOTS 里手写的单字词根**全部滤掉** ——
 *      「怒/吼/瞪/睨/累/困/倦/羞/慌/吓」一个都没进表。现在：ROOTS 允许单字，
 *      自动抽取的短语仍要求 ≥2 字（防「草十」「十郎」这类人名碎片）。
 *   B. `conditionPhrases()` 长度上限 12，把叙述长句当词收进来
 *      （「草十郎做出超乎常识的举动」「番外篇的恐怖场面」）—— 聊天文本里永远不会出现。
 *      现在：上限降到 8，且**带「的」的短语一律丢**（那类是描述不是谓词）。
 *   C. 最终过滤器 `w.length >= 2` 又把单字滤了第二遍。现在按权重放行（n ≥ 30 的单字允许）。
 */
import { EMOTIONS, GUIDE, LANGUAGE } from './persona-emotions.mjs'

export { GUIDE, LANGUAGE }

/** 情绪词根：**手写**，权重最高。含单字（中文情绪词很多是一字成词）。 */
export const ROOTS = {
  neutral: ['平静', '平淡', '沉默', '无语', '没反应', '面无表情', '寻常', '照常', '如常',
    '普通', '点头', '摇头', '默认', '无视', '淡淡', '随口'],
  smile: ['微笑', '含笑', '嘴角上扬', '嘴角一扬', '笑意', '浅笑', '失笑', '一笑', '笑容', '抿嘴',
    '轻笑', '笑', '笑着说', '笑了笑', '笑眯眯', '笑出声', '开心', '高兴', '愉快', '欣喜', '愉悦', '满意'],
  laugh: ['大笑', '笑出声', '爆笑', '捧腹', '放声', '哄笑', '忍俊不禁', '哈哈', '笑翻',
    '乐不可支', '喷笑', '笑得'],
  angry: ['生气', '发火', '愤怒', '怒气', '不爽', '不悦', '恼', '火大', '吼', '怒', '咬牙',
    '斥', '呵斥', '斥责', '愤', '骂', '埋怨', '抱怨', '不满', '凶', '狠狠', '瞪眼'],
  glare: ['瞪', '瞪视', '睨', '半眼', '锐利', '冰冷', '冷冷', '杀意', '威压', '警告',
    '冷眼', '眯眼', '剜', '斜视', '睥睨'],
  surprised: ['惊讶', '吃惊', '意外', '震惊', '愕然', '睁大眼', '吓', '竟然', '没想到',
    '惊', '愣', '呆', '愕', '惊愕', '惊吓', '措手不及', '惊叫'],
  troubled: ['为难', '困扰', '困惑', '苦笑', '尴尬', '不知所措', '蹙', '蹙眉', '皱眉', '皱着眉',
    '皱了皱眉', '苦恼', '烦', '语塞', '支吾', '纠结', '无奈', '怕', '害怕', '不安'],
  sad: ['悲伤', '失落', '难过', '沮丧', '消沉', '寂寞', '孤独', '叹息', '垂头', '黯淡',
    '悲', '哀', '泪', '哭', '泣', '伤心', '遗憾', '落寞', '黯然', '委屈'],
  serious: ['认真', '严肃', '正色', '坚定', '决意', '郑重', '正视', '沉声', '断言', '坚决'],
  think: ['思考', '琢磨', '沉思', '寻思', '回想', '回忆', '权衡', '考虑', '侧目', '沉吟',
    '犹豫', '思索'],
  tired: ['疲惫', '疲劳', '累', '困', '叹气', '叹了口气', '叹口气', '打哈欠', '打了个哈欠',
    '倦', '无精打采', '熬夜', '厌烦', '乏', '疲', '长叹'],
  shy: ['脸红', '脸红了', '脸都红了', '红着脸', '涨红', '绯红', '害羞', '羞', '不好意思',
    '忸怩', '别扭', '慌', '别开视线', '别开脸', '局促', '低头', '心跳'],
}

/**
 * 角色专属词表：三个人物各自的说法（数据在 `persona-emotions.mjs`，来源是各 skill 的 voice.md）。
 *
 * 为什么单独一层：同一句「哼」在青子嘴里是嘴硬、在有珠嘴里是冷、在金鹿嘴里是吐槽。
 * 客户端按当前角色把这一层**并进**通用词表（`mergeLexicon`），换角色即换口径。
 * 权重 40：角色口癖是强信号（她能说出口的、能被读懂的，就这几句）。
 */
export function buildCharacterLexicons() {
  const out = {}
  for (const [slug, table] of Object.entries(EMOTIONS)) {
    const lx = {}
    for (const [slot, words] of Object.entries(table)) {
      const arr = words.filter((w) => w && w.length)
        .map((w) => ({ w, n: 40 }))
      if (arr.length) lx[slot] = arr
    }
    out[slug] = lx
  }
  return out
}

/** 把角色专属词表并进通用词表（同词取较大权重）。客户端与预览页都用这一份规则。 */
export function mergeLexicon(base, extra) {
  const out = {}
  for (const slot of new Set([...Object.keys(base || {}), ...Object.keys(extra || {})])) {
    const m = new Map()
    for (const e of (base && base[slot]) || []) m.set(e.w, Math.max(m.get(e.w) || 0, e.n))
    for (const e of (extra && extra[slot]) || []) m.set(e.w, Math.max(m.get(e.w) || 0, e.n))
    out[slot] = [...m.entries()].map(([w, n]) => ({ w, n }))
  }
  return out
}

/** 太通用的单字（即便来自 ROOTS 也不收）——避免「的了是我你他」这类全命中。 */export const GENERIC_CHARS = new Set(['的', '了', '是', '我', '你', '他', '她', '它', '在', '有',
  '和', '就', '都', '也', '很', '不', '没', '这', '那', '个', '上', '下', '里', '说', '看', '想'])

/**
 * ★ 语气词 / 感叹词层（2026-09-19 补）。
 *
 * 为什么必须单独一层：实测拿**模型自己的输出**跑管线（`persona_work/tmp/output-probe.mjs`），
 * 43 句只切了 2 次；而最像角色的那段（「哼」「啧」「真是的」「莫迦ね」）命中率只有 10% ——
 * 因为词表里**一个感叹词都没有**。角色式中文的情绪密度大量落在语气词上，这一层是刚需。
 *
 * 权重 18（低于词根的 40）：它们**歧义大**（「哼」可以是不满也可以是得意），
 * 单独出现时 conf = 18/26 ≈ 0.69 刚好过 0.5 门限；与实词同现时由实词主导。
 */
export const ROOTS_SOFT = {
  angry: ['哼', '真是的', '讨厌', '过分', '够了'],
  glare: ['冷冷地', '瞥了一眼', '白了一眼', '不爱搭理'],
  troubled: ['糟糕', '糟了', '怎么办', '不会吧'],
  surprised: ['咦', '咦？', '诶', '诶？', '哎呀', '哇', '天啊', '什么？'],
  sad: ['唉', '呜', '呜呜', '唉声叹气'],
  laugh: ['嘿嘿', '呵呵'],
  smile: ['太好了', '真好', '不错嘛'],
  tired: ['受不了', '好困'],
  shy: ['别看我', '讨厌啦'],
  neutral: ['嘛', '随意', '随便吧'],
}

/** 叙述性噪声标记：带这些的短语是"描述"而不是"可匹配的谓词"。 */
const NARRATIVE_MARK = /(的话题|的场合|的场面|的事件|的时候|的举动|的场景|的事情|方式|场合|场面|篇|章节)/

export const STOP = new Set(['这个', '那个', '没有', '不是', '已经', '还是', '只是', '就是', '这样', '那样',
  '自己', '对方', '然后', '因为', '所以', '但是', '而且', '于是', '一直', '一下', '一点', '出来',
  '起来', '过来', '过去', '时候', '事情', '东西', '样子', '地方', '这里', '那里', '我们', '你们',
  '他们', '什么', '一个', '有些', '没什么', '的事情', '这种事', '的方式', '没什',
  // 新增：叙述长句里混进来的伪词
  '说话', '告知', '移动', '转身', '其他', '一般动作', '手部与身体动作', '长间隔后重新开始'])

/**
 * 把 condition_zh / action_class_zh 这类人写短语切成候选词。
 * 收紧点：长度 2~8；带「的」或叙述标记的一律丢。
 */
export function conditionPhrases(text) {
  const out = []
  const stripped = String(text)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[「」『』]/g, '')
  for (const seg of stripped.split(/[／/、，,。;；|]+/)) {
    const s = seg.trim()
    if (s.length < 2 || s.length > 8) continue
    if (s.includes('的')) continue
    if (NARRATIVE_MARK.test(s)) continue
    out.push(s)
  }
  return out
}

/**
 * @param {object} predicates cn_predicates.json
 * @returns {{lexicon: object, slotSupport: object, keywords: object, stats: object}}
 */
export function buildLexicon(predicates) {
  const lexiconRaw = {}
  const slotSupport = {}
  const bump = (slot, word, n, allowSingle) => {
    if (!word) return
    if (word.length < 2 && !(allowSingle && word.length === 1 && !GENERIC_CHARS.has(word))) return
    if (STOP.has(word)) return
    const m = lexiconRaw[slot] ?? (lexiconRaw[slot] = new Map())
    m.set(word, Math.max(m.get(word) || 0, n))
  }

  for (const node of (predicates.narration || [])) {
    const slot = node.slot
    if (!slot) continue
    slotSupport[slot] = (slotSupport[slot] || 0) + (node.support || 0)
    const w = Math.max(2, Math.round(Math.log2((node.support || 1) + 1)) + 2)
    if (node.action_class_zh) for (const p of conditionPhrases(node.action_class_zh)) bump(slot, p, w, false)
  }
  for (const node of (predicates.dialogue || [])) {
    const slot = node.slot
    if (!slot) continue
    slotSupport[slot] = (slotSupport[slot] || 0) + 20
    if (node.condition_zh) for (const p of conditionPhrases(node.condition_zh)) bump(slot, p, 30, false)
  }
  for (const node of (predicates.runtime || [])) {
    const slot = node.slot
    if (!slot) continue
    slotSupport[slot] = (slotSupport[slot] || 0) + 10
    if (node.condition) for (const p of conditionPhrases(node.condition)) bump(slot, p, 20, false)
  }
  for (const [slot, hint] of Object.entries(predicates.slot_hints_zh || {})) {
    for (const p of conditionPhrases(hint)) bump(slot, p, 12, false)
  }
  // ★ 词根：允许单字（这是本次修的核心）
  for (const [slot, words] of Object.entries(ROOTS)) {
    for (const w of words) bump(slot, w, 40, true)
  }
  // ★ 语气词/感叹词层：权重 18，允许单字
  for (const [slot, words] of Object.entries(ROOTS_SOFT)) {
    for (const w of words) bump(slot, w, 18, true)
  }

  // 跨槽位通用词降权：出现在 ≥3 个槽位的词对判别没有贡献
  const slotCount = {}
  for (const [slot, m] of Object.entries(lexiconRaw)) {
    for (const w of m.keys()) (slotCount[w] ??= new Set()).add(slot)
  }
  const lexicon = {}
  let singleChars = 0
  for (const [slot, m] of Object.entries(lexiconRaw)) {
    const arr = [...m.entries()]
      .filter(([w, n]) => n >= 5 && (w.length >= 2 || n >= 30) && slotCount[w].size <= 2)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 60)
      .map(([w, n]) => ({ w, n }))
    if (arr.length) {
      lexicon[slot] = arr
      singleChars += arr.filter((x) => x.w.length === 1).length
    }
  }
  const keywords = Object.fromEntries(Object.entries(lexicon).map(([k, v]) => [k, v.map((x) => x.w)]))
  const total = Object.values(lexicon).reduce((a, v) => a + v.length, 0)
  return {
    lexicon, slotSupport, keywords,
    stats: { slots: Object.keys(lexicon).length, words: total, singleChars },
  }
}

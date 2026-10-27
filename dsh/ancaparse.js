/**
 * 小脉宝的指标抽取器（六部件之三：dsh/<topic>parse.js）。
 *
 * 输入是 MinerU 的 full.md；输出是**候选**（kind + payload + 原句），不是记录。
 *
 * ANCA 字典只认这个病程里会反复出现的项（与 schema/0001 的 marker CHECK 枚举一致）：
 * PR3-ANCA / MPO-ANCA / 血肌酐 / eGFR / 24h 尿蛋白 / 尿红细胞 / 血沉 / CRP。
 *
 * 四条家族纪律（docs/18 §8）：
 * 1. 表格先 htmlTablesToPipes() 再按表头定位（不按位置硬配，避免列序变化串位）；
 * 2. 单位先剥 LaTeX 外壳（$10^9/L$ → 10^9/L）再比对；
 * 3. 只抄写不推测：参考区间（两数一格）整行放弃；`<0.5` 这类留原文（num=null）；
 * 4. **短缩写必须词边界**：MPO / PR3 / CRP 若做 substring 会命中 ROMO/CPR3 之类噪声
 *    （M4 在试验检索里踩过 mpa→remodeling 的同类坑）。
 */

/** 指标字典：aliases → schema marker 枚举值（与 write-schema CHECKS.marker 一致）。 */
export const LAB_DICT = [
  { marker: 'PR3_ANCA', name: 'PR3-ANCA', aliases: ['PR3-ANCA', 'PR3 ANCA', 'PR3抗体', '抗PR3抗体', 'c-ANCA', 'cANCA'], unit: 'RU/mL' },
  { marker: 'MPO_ANCA', name: 'MPO-ANCA', aliases: ['MPO-ANCA', 'MPO ANCA', 'MPO抗体', '抗MPO抗体', 'p-ANCA', 'pANCA'], unit: 'RU/mL' },
  { marker: 'CREATININE', name: '血肌酐', aliases: ['血肌酐', '肌酐', 'CREA', 'Cr', 'SCr'], unit: 'μmol/L' },
  { marker: 'EGFR', name: 'eGFR', aliases: ['eGFR', 'EGFR', '估算肾小球滤过率', '肾小球滤过率'], unit: 'mL/min/1.73m²' },
  { marker: 'URINE_PROTEIN', name: '尿蛋白定量', aliases: ['24小时尿蛋白', '24h尿蛋白', '尿蛋白定量', '尿蛋白'], unit: 'g/24h' },
  { marker: 'URINE_RBC', name: '尿红细胞', aliases: ['尿红细胞', '红细胞（尿）', 'RBC（尿）', '尿RBC'], unit: '个/μL' },
  { marker: 'ESR', name: '血沉', aliases: ['血沉', '红细胞沉降率', 'ESR'], unit: 'mm/h' },
  { marker: 'CRP', name: 'C 反应蛋白', aliases: ['C反应蛋白', 'C 反应蛋白', '超敏C反应蛋白', 'hs-CRP', 'CRP'], unit: 'mg/L' },
]

/** 治疗线关键词（只用于把整段标成"疑似用药记录"，不抽剂量数值） */
export const DRUG_ALIASES = [
  '泼尼松', '甲泼尼龙', '强的松', '环磷酰胺', '利妥昔单抗', '美罗华',
  '吗替麦考酚酯', '霉酚酸酯', '硫唑嘌呤', '甲氨蝶呤', '他克莫司',
  '阿伐可泮', '美泊利珠单抗', '贝利尤单抗', '血浆置换'
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 词边界匹配：中文别名用前后"非字母数字"断言（\b 对中文无效）；
 * 短拉丁缩写（MPO/PR3/CRP/ESR/Cr）尤其需要——substring 会误命中。
 */
function aliasHit(text, alias) {
  const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(alias)}(?![A-Za-z0-9])`, 'i')
  return re.test(text)
}

const decodeEntities = (text) => String(text)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

/** CSV/TSV → 管道行（化验单常见导出格式；先转再走同一套表头定位） */
export function csvToPipes(text) {
  const src = String(text ?? '')
  if (!src.trim()) return src
  const lines = src.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return src
  const delim = lines[0].includes('\t') ? '\t' : (lines[0].split(',').length > 1 ? ',' : null)
  if (!delim) return src
  const out = []
  for (const line of lines) {
    if (line.trim().startsWith('|')) { out.push(line); continue }
    const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cells.length < 2) continue
    out.push(`| ${cells.join(' | ')} |`)
    if (out.length === 1) out.push(`|${cells.map(() => '---').join('|')}|`)
  }
  return out.join('\n')
}

/** markdown 里的 HTML 表格 → `| a | b |` 管道行。colspan 不补位（宁可少抽不串位）。 */
export function htmlTablesToPipes(md) {
  if (!/<table/i.test(String(md ?? ''))) return String(md ?? '')
  return String(md).replace(/<table[\s\S]*?<\/table>/gi, (block) => {
    const out = []
    for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const tds = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
      if (tds.length) out.push(`| ${tds.join(' | ')} |`)
    }
    return out.join('\n')
  })
}

/** 单位先剥 LaTeX 外壳（$10^9/L$ → 10^9/L）再归一空白。 */
export function normalizeUnit(unit) {
  return String(unit ?? '').trim().replace(/^\$(.+)\$$/, '$1').replace(/\s+/g, '')
}

/* ANCA 化验单常见单位（含 eGFR 的 mL/min/1.73m² 与尿蛋白的 g/24h） */
const UNIT_RE = /^(RU\/mL|U\/mL|AU\/mL|μmol\/L|umol\/L|mg\/dL|mL\/min\/(1\.73m2|1\.73m²)|mL\/min\/1\.73m\^2|g\/24h|g\/L|mg\/24h|个\/μL|个\/uL|\/μL|mm\/h|mg\/L|mg\/dL)$/i

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}
const isTableLine = (line) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim())

const NUM_RE = /^(?:[<>≤≥]\s*)?-?\d+(?:\.\d+)?$/
/** 单一可抄写值：纯数字 / <0.5 这类带比较符的原文；参考区间（两数一格）一律不要。 */
function valueOf(cell) {
  const t = String(cell).replace(/\s/g, '')
  if (!t) return null
  if (/^[<>≤≥]/.test(t)) {
    const m = t.match(/^([<>≤≥])(-?\d+(?:\.\d+)?)$/)
    return m ? { raw: `${m[1]}${m[2]}`, num: null } : null
  }
  if (!NUM_RE.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? { raw: t, num: n } : null
}

/**
 * 从 markdown 抽化验候选。
 * @returns {{candidates: Array, skipped: Array}}
 *   candidates 每项 {kind:'lab', payload:{marker,value,unit,report_quote}, line}
 */
export function extractLabCandidates(markdown) {
  const md = htmlTablesToPipes(csvToPipes(markdown))
  const candidates = []
  const skipped = []
  const seen = new Set()

  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    if (!isTableLine(lines[i])) { i += 1; continue }

    const start = i
    while (i < lines.length && isTableLine(lines[i])) i += 1
    const blockLines = lines.slice(start, i).filter((l) => !isSeparator(l))
    if (blockLines.length < 2) continue

    const header = cells(blockLines[0])
    const idxName = header.findIndex((h) => /项目|指标|名称|检验|item|test/i.test(h))
    const idxVal = header.findIndex((h) => /结果|数值|value|result/i.test(h))
    const idxUnit = header.findIndex((h) => /单位|unit/i.test(h))
    if (idxName === -1 || idxVal === -1) continue

    for (const line of blockLines.slice(1)) {
      const row = cells(line)
      const name = row[idxName] ?? ''
      /* 指标名可能带前缀（如"抗中性粒细胞胞浆抗体 MPO-ANCA"），用整格做别名匹配 */
      const hit = LAB_DICT.find((d) => d.aliases.some((a) => aliasHit(name, a)))
      if (!hit) continue
      const val = valueOf(row[idxVal] ?? '')
      if (!val) { skipped.push({ name, cell: row[idxVal] ?? '', reason: '不是单一数值（参考范围/文字）' }); continue }
      const unitCell = idxUnit >= 0 ? normalizeUnit(row[idxUnit] ?? '') : ''
      if (unitCell && !UNIT_RE.test(unitCell)) { skipped.push({ name, cell: unitCell, reason: '单位不认识' }); continue }
      const dedupe = `${hit.marker}:${val.raw}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      candidates.push({
        kind: 'lab',
        payload: {
          marker: hit.marker,
          value: val.num === null ? 0 : val.num,
          unit: unitCell || hit.unit,
          report_quote: line.trim(),
          value_raw: val.raw,
        },
        line: start + 1,
      })
    }
  }
  return { candidates, skipped }
}

/**
 * 从正文抽"疑似用药记录"候选（note 类型：只存原句，不进治疗版本链）。
 * 治疗版本链必须人确认药名/剂量/起止，抽取器不替用户决定。
 */
export function extractDrugMentions(markdown) {
  const md = htmlTablesToPipes(csvToPipes(markdown))
  const out = []
  for (const line of md.split(/\r?\n/)) {
    const t = line.replace(/^[#>*\-\s]+/, '').trim()
    if (t.length < 6 || t.length > 200) continue
    const hit = DRUG_ALIASES.filter((d) => t.includes(d))
    if (hit.length) out.push({ kind: 'note', payload: { text: `用药提及：${t}`, report_quote: t }, drugs: hit })
  }
  return out
}

/** 报告日期：文件名或正文里的 YYYY-MM-DD / YYYY年M月D日。取不到就是 null（不猜今天）。 */
export function guessReportDate(text, fallback = null) {
  const m = String(text ?? '').match(/(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/)
  if (!m) return fallback
  const [, y, mo, d] = m
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

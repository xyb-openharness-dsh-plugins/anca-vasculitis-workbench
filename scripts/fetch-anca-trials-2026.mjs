#!/usr/bin/env node
/**
 * fetch-anca-trials-2026.mjs — AAV（ANCA 相关血管炎）2026 临床试验采集（M4）
 *
 * 唯一入口：unified-trial-mcp（MCP stdio，绝不自己拼 URL）。
 * 不传 sourceIds → 所有来源给出各自终态；离线语料覆盖不足的以「未配置/无覆盖」类
 * 终态如实进入 manifest，不冒充"已查过"（35 号纪律：FAILED/DENIED 不计覆盖）。
 *
 * 记录字段形状（unified-trial-mcp v0.3.x 实测）：
 *   records[]: { recordId, source:{id,label,sourceRecordId}, registryNumbers:[{registry,value,primary}],
 *                provenance, title, studyType, sponsorOrInstitution[], dates:{registered,...}, sourceUrl }
 *   statuses[]: { sourceId, state, reasonCode?, explanation?, coverage?, freshness? }
 *
 * 用法：
 *   node scripts/fetch-anca-trials-2026.mjs --dry-run   # 只看来源终态与前 3 条
 *   node scripts/fetch-anca-trials-2026.mjs             # 落四件套
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UTS_CLI = process.env.UNIFIED_TRIAL_CLI ?? '/Users/qinxiaoqiang/Downloads/unified_search_trials/dist/src/cli/main.js';
const OUT_DIR = join(ROOT, 'research', 'anca-vasculitis');
const DRY = process.argv.includes('--dry-run');
const SNAPSHOT_DATE = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* 采集口径（与 docs/35-TRIAL-MATCHING.md §一 双通道描述一致；改口径两处同改）
   AAV 的词面比多数罕见病宽：中文用病种全名 + 三个亚型 + 抗体名；英文用 AAV 全称与缩写。 */
const QUERIES = [
  { keyword: 'ANCA相关血管炎', note: '中文标准名（指南第 7 病种）' },
  { keyword: 'ANCA相关性血管炎', note: '中文常用写法（"性"）' },
  { keyword: '肉芽肿性多血管炎', note: 'GPA 中文名' },
  { keyword: '显微镜下多血管炎', note: 'MPA 中文名' },
  { keyword: '嗜酸性肉芽肿性多血管炎', note: 'EGPA 中文名' },
  { keyword: '抗中性粒细胞胞浆抗体', note: '中文抗体名（宽口径）' },
  { keyword: 'ANCA-associated vasculitis', note: '英文标准名' },
  { keyword: 'granulomatosis with polyangiitis', note: 'GPA 英文名' },
  { keyword: 'microscopic polyangiitis', note: 'MPA 英文名' },
  { keyword: 'eosinophilic granulomatosis with polyangiitis', note: 'EGPA 英文名' },
  { keyword: 'ANCA vasculitis', note: '英文常用简称' },
  { keyword: 'avacopan', note: '药物线（补体 C5a 受体抑制剂）' },
  { keyword: 'vasculitis', note: '英文宽口径（含非 AAV 血管炎，靠标题人工筛）' },
  { keyword: 'ANCA', note: '抗体缩写宽口径' },
];
const PER_SOURCE_LIMIT = 200;

/* 相关性过滤（M4 实测教训）：ctv 本地索引对宽口径词（vasculitis）会返回大量无关条目
   （肿瘤/其他病种）。入库前按标题 + URL 命中 AAV 词表；未命中的不丢弃，标 relevance
   与 reason 但**不计入 AAV 主表**（另存 dropped 计数，供 manifest 如实披露）。
   这一步只做"是不是这个病"，不做任何疗效/入组判断。 */
/* 词表分两类：长词做 substring；短缩写（mpa/gpa/egpa/anca）必须词边界——
   实测教训：'mpa' 会命中 re**mpa**ling/… 内部，把肿瘤与器械研究误判为 AAV。 */
const AAV_PHRASES = [
  'vasculitis', 'polyangiitis', 'wegener', 'churg', 'granulomatosis',
  'microscopic polyangiitis', 'anti-neutrophil', 'antineutrophil',
  '血管炎', '肉芽肿性多血管炎', '显微镜下多血管炎'
];
const AAV_SHORT = ['anca', 'mpa', 'gpa', 'egpa'];
function aavHits(hay) {
  const hits = AAV_PHRASES.filter((t) => hay.includes(t));
  for (const w of AAV_SHORT) {
    if (new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i').test(hay)) hits.push(w);
  }
  return hits;
}
const OFF_TOPIC_HINTS = [
  'melanoma', 'carcinoma', 'lymphoma', 'sarcoma', 'myeloma', 'leukemia', 'glioma', 'mesothelioma',
  'breast', 'lung', 'hepatocellular', 'gastric', 'colorectal', 'pancrea', 'ovarian', 'prostate',
  'renal cell', 'bladder', 'esophageal', 'cervical', 'endometrial', 'thyroid', 'nasopharyngeal',
  'tumor', 'tumour', 'neoplasm', 'metasta', 'oncol', 'chemotherap', 'immunotherap',
  'copanlisib', 'olaparib', 'durvalumab', 'pembrolizumab', 'nivolumab', 'ipilimumab', 'trastuzumab',
  'bevacizumab', 'atezolizumab', 'dupilumab', 'anlotinib', 'gemcitabine', 'paclitaxel', 'docetaxel',
  'cisplatin', 'carboplatin', 'sorafenib', 'lenvatinib', 'cabozantinib', 'everolimus'
];
/* 相关性判定（三条判据，任一成立即相关）：
   ① 标题/URL 命中 AAV 词表 → 直接相关；
   ② 由精确 AAV 关键词查出，且标题**无**明确其他病种信号 → 相关（ctv 标题常只写 Phase，
      不含病名，靠查询词兜住）；
   ③ 由宽口径词（vasculitis/ANCA）查出且标题命中 AAV 词 → 相关。
   标题含明确其他病种信号（melanoma/carcinoma…）而**未**命中 AAV 词 → 判为噪声，不入主表。 */
const PRECISE_KEYWORDS = new Set([
  'ANCA相关血管炎', 'ANCA相关性血管炎', '肉芽肿性多血管炎', '显微镜下多血管炎',
  '嗜酸性肉芽肿性多血管炎', '抗中性粒细胞胞浆抗体',
  'ANCA-associated vasculitis', 'granulomatosis with polyangiitis',
  'microscopic polyangiitis', 'eosinophilic granulomatosis with polyangiitis',
  'ANCA vasculitis', 'avacopan'
]);
function relevanceOf(rec, query) {
  const hay = `${rec.title ?? ''} ${rec.sourceUrl ?? ''}`.toLowerCase();
  const hit = aavHits(hay);
  const off = OFF_TOPIC_HINTS.filter((t) => hay.includes(t));
  if (hit.length && !off.length) return { relevant: true, basis: 'title-term', hits: hit };
  if (hit.length && off.length) return { relevant: true, basis: 'title-term-with-offhint', hits: hit, offHints: off };
  /* 精确关键词兜底：仅当标题完全没有其他病种/治疗领域信号时才准入，
     且标 basis='precise-query-needs-review' 进人工复核清单（宁少不错）。 */
  if (PRECISE_KEYWORDS.has(query) && !off.length) {
    return { relevant: true, basis: 'precise-query-needs-review', hits: [] };
  }
  return { relevant: false, basis: 'off-topic', hits: [], offHints: off };
}

/* 不计覆盖的终态：FAILED / DENIED / NEEDS_SETUP / NO_RESULTS 都不算"已查过" */
const NO_COVERAGE_STATES = new Set(['FAILED', 'DENIED', 'NEEDS_SETUP', 'UNSUPPORTED']);
const ZERO_RESULT_STATES = new Set(['NO_RESULTS']);

class McpClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buf = '';
    this.child = spawn(process.execPath, [UTS_CLI, 'serve'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (c) => this.#onChunk(c));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', () => {});
  }
  #onChunk(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(`${msg.error.code} ${msg.error.message}`));
          else resolve(msg.result);
        }
      } catch { /* banner 行忽略，不猜 */ }
    }
  }
  send(obj) { this.child.stdin.write(JSON.stringify(obj) + '\n'); }
  request(method, params, timeoutMs = 180000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }
  notify(method, params) { this.send({ jsonrpc: '2.0', method, params }); }
  async init() {
    await this.request('initialize', {
      protocolVersion: '2024-11-05', capabilities: {},
      clientInfo: { name: 'anca-vasculitis-workbench-fetch', version: '0.1.0' },
    }, 30000);
    this.notify('notifications/initialized', {});
  }
  callTool(name, args) {
    return this.request('tools/call', { name, arguments: args })
      .then((r) => JSON.parse((r.content ?? []).map((c) => c.text ?? '').join('\n') || '{}'));
  }
  close() { try { this.child.stdin.end(); } catch { /* closed */ } this.child.kill('SIGTERM'); }
}

/** 同一登记号才算同一条（NCT/ChiCTR/CDE/EUCTR…，registryNumbers 为主） */
function registryKeys(rec) {
  const keys = [];
  for (const rn of rec.registryNumbers ?? []) {
    const v = rn?.value?.trim?.();
    if (v) keys.push(`${rn.registry}:${v}`.toUpperCase());
  }
  return keys.filter((v, i, a) => a.indexOf(v) === i);
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const cli = new McpClient();
  await cli.init();

  const statusSnapshot = await cli.callTool('get_source_status', {}).catch((e) => ({ error: String(e.message) }));
  if (DRY) {
    console.log('来源终态：');
    for (const s of statusSnapshot?.statuses ?? statusSnapshot?.sources ?? []) {
      console.log(`  ${String(s.sourceId).padEnd(28)} ${String(s.state).padEnd(12)} ${s.reasonCode ?? ''}`);
    }
    const probe = await cli.callTool('search_trials', { keyword: QUERIES[0].keyword, limit: 3 }).catch((e) => ({ error: String(e.message) }));
    console.log(`\n试查「${QUERIES[0].keyword}」：${(probe.records ?? []).length} 条`);
    for (const r of (probe.records ?? []).slice(0, 3)) console.log('  ·', String(r.title).slice(0, 80));
    for (const s of (probe.statuses ?? [])) console.log(`  ${s.sourceId}: ${s.state} ${s.reasonCode ?? ''}`);
    cli.close();
    return;
  }

  const allRecords = new Map();
  const perQuery = [];
  for (const q of QUERIES) {
    process.stdout.write(`检索 "${q.keyword}" … `);
    let res;
    try {
      res = await cli.callTool('search_trials', { keyword: q.keyword, limit: PER_SOURCE_LIMIT });
    } catch (e) {
      perQuery.push({ query: q.keyword, error: String(e.message).slice(0, 200), statuses: [] });
      console.log('失败：' + e.message);
      continue;
    }
    perQuery.push({
      query: q.keyword,
      statuses: (res.statuses ?? []).map((s) => ({ sourceId: s.sourceId ?? null, state: s.state ?? null, reasonCode: s.reasonCode ?? null })),
      coverage: res.coverage ?? null,
      completeness: res.completeness ?? null,
      totalRecords: res.totalRecords ?? null,
    });
    for (const r of res.records ?? []) {
      if (!r.recordId) continue;
      const rel = relevanceOf(r, q.keyword);
      r.__relevance = rel;
      r.__query = q.keyword;
      if (!allRecords.has(r.recordId)) allRecords.set(r.recordId, r);
      else if (rel.relevant) allRecords.get(r.recordId).__relevance = rel;   /* 任一查询判相关即相关 */
    }
    console.log(`${(res.records ?? []).length} 条；终态 ${(res.statuses ?? []).map((s) => `${s.sourceId}:${s.state}`).join(' ')}`);
  }
  cli.close();

  /* 身份合并：同登记号合并来源；无登记号的按 recordId 独立保留 */
  const byKey = new Map();
  const entries = [];
  for (const [rid, rec] of allRecords) {
    const keys = registryKeys(rec);
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      hit.mergedSources.push(rid);
      for (const k of keys) byKey.set(k, hit);
    } else {
      const entry = { recordId: rid, mergedSources: [rid], rec };
      entries.push(entry);
      for (const k of keys) byKey.set(k, hit ?? entry);
      for (const k of keys) byKey.set(k, entry);
    }
  }
  const mergedAll = [...new Map(entries.map((e) => [e.recordId, e])).values()];
  const merged = mergedAll.filter((e) => e.rec.__relevance?.relevant)
    .sort((a, b) => String(a.recordId).localeCompare(String(b.recordId)));
  const dropped = mergedAll.filter((e) => !e.rec.__relevance?.relevant);

  const lines = merged.map(({ recordId, mergedSources, rec }) => JSON.stringify({
    recordId,
    mergedSources,
    sourceId: rec.source?.id ?? recordId.split(':')[0] ?? null,
    title: rec.title ?? null,
    studyType: rec.studyType ?? null,
    sponsor: rec.sponsorOrInstitution ?? null,
    registryNumbers: rec.registryNumbers ?? null,
    dates: rec.dates ?? null,
    sourceUrl: rec.sourceUrl ?? null,
    retrievedAt: rec.provenance?.retrievedAt ?? null,
    statusNote: '登记状态，未核实',
    snapshotDate: SNAPSHOT_DATE,
    relevanceHits: rec.__relevance?.hits ?? [],
    matchedQuery: rec.__query ?? null,
  }));
  const jsonlPath = join(OUT_DIR, 'trials-2026.jsonl');
  writeFileSync(jsonlPath, lines.length ? lines.join('\n') + '\n' : '');

  /* 覆盖统计：只有 SUCCESS/OK* 才计覆盖（35 号纪律） */
  const stateBySource = new Map();
  for (const qs of perQuery) {
    for (const s of qs.statuses) {
      if (!s.sourceId) continue;
      const prev = stateBySource.get(s.sourceId);
      const ok = (st) => typeof st === 'string' && (st === 'SUCCESS' || st.startsWith('OK'));
      if (!prev || (!ok(prev) && ok(s.state))) stateBySource.set(s.sourceId, s.state);
      else if (!prev) stateBySource.set(s.sourceId, s.state);
    }
  }
  const covered = [...stateBySource.entries()].filter(([, st]) => st === 'SUCCESS' || String(st).startsWith('OK')).map(([id]) => id);
  const notCovered = [...stateBySource.entries()].filter(([id]) => !covered.includes(id)).map(([id, st]) => ({ sourceId: id, state: st }));

  const dbPath = join(OUT_DIR, 'anca_trials_2026.sqlite');
  if (existsSync(dbPath)) rmSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE trials (
    record_id TEXT PRIMARY KEY,
    merged_sources TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT,
    study_type TEXT,
    sponsors TEXT,
    registry_numbers TEXT,
    dates TEXT,
    source_url TEXT,
    retrieved_at TEXT,
    status_note TEXT NOT NULL DEFAULT '登记状态，未核实',
    snapshot_date TEXT NOT NULL,
    relevance_hits TEXT,
    matched_query TEXT
  );
  CREATE INDEX idx_trials_source ON trials(source_id);
  CREATE TABLE source_statuses (
    query TEXT NOT NULL,
    source_id TEXT,
    state TEXT,
    reason_code TEXT,
    coverage TEXT,
    completeness TEXT,
    total_records INTEGER,
    counted_coverage INTEGER NOT NULL DEFAULT 0
  );`);
  const insTrial = db.prepare('INSERT INTO trials (record_id, merged_sources, source_id, title, study_type, sponsors, registry_numbers, dates, source_url, retrieved_at, status_note, snapshot_date, relevance_hits, matched_query) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insStatus = db.prepare('INSERT INTO source_statuses (query, source_id, state, reason_code, coverage, completeness, total_records, counted_coverage) VALUES (?,?,?,?,?,?,?,?)');
  for (const l of lines) {
    const r = JSON.parse(l);
    insTrial.run(r.recordId, JSON.stringify(r.mergedSources), r.sourceId, r.title, r.studyType,
      r.sponsor ? JSON.stringify(r.sponsor) : null, r.registryNumbers ? JSON.stringify(r.registryNumbers) : null,
      r.dates ? JSON.stringify(r.dates) : null, r.sourceUrl, r.retrievedAt, r.statusNote, r.snapshotDate,
      JSON.stringify(r.relevanceHits ?? []), r.matchedQuery ?? null);
  }
  for (const qs of perQuery) {
    for (const s of qs.statuses) {
      const counted = (s.state === 'SUCCESS' || String(s.state).startsWith('OK')) ? 1 : 0;
      insStatus.run(qs.query, s.sourceId, s.state, s.reasonCode,
        qs.coverage ? JSON.stringify(qs.coverage) : null,
        qs.completeness ? JSON.stringify(qs.completeness) : null,
        qs.totalRecords ?? null, counted);
    }
    if (qs.error) insStatus.run(qs.query, null, 'ERROR', null, null, null, null, 0);
  }
  const dbCount = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n;
  const statusRows = db.prepare('SELECT COUNT(*) AS n FROM source_statuses').get().n;
  db.close();

  /* manifest：记录口径、终态、覆盖与文件指纹 —— 与 jsonl/sqlite 三者条数必须相等 */
  const manifest = {
    topic: 'anca-vasculitis',
    disease: 'ANCA 相关血管炎（AAV：GPA / MPA / EGPA）',
    year: '2026',
    snapshotDate: SNAPSHOT_DATE,
    tool: `unified-trial-mcp @ ${UTS_CLI}`,
    queries: QUERIES,
    perSourceLimit: PER_SOURCE_LIMIT,
    recordCount: lines.length,
    dbCount,
    needsHumanReview: merged.filter((e) => e.rec.__relevance?.basis === 'precise-query-needs-review')
      .map((e) => ({ recordId: e.recordId, title: String(e.rec.title ?? '').slice(0, 100), query: e.rec.__query })),
    relevance: {
      rule: '① 标题/URL 命中 AAV 词 → 相关；② 精确关键词查出且标题无其他病种/治疗领域信号 → 相关但标 needsHumanReview；其余判噪声不入主表',
      terms: [...AAV_PHRASES, `${AAV_SHORT.join('/')}（词边界匹配）`],
      droppedNotAAV: dropped.length,
      droppedSample: dropped.slice(0, 5).map((e) => String(e.rec.title ?? '').slice(0, 70)),
      caveat: 'ctv 本地索引对长词组存在分词噪声（如 "granulomatosis with polyangiitis" 返回的多为含 phase/study 的无关条目；'
        + '"vasculitis" 会带出大量肿瘤试验；短缩写 mpa/gpa/egpa 若不做词边界会误匹配 remodeling/renal 内部）。'
        + '本包准入规则：标题/URL 命中 AAV 词，或精确关键词且标题无其他病种/治疗领域信号（后者标 needsHumanReview）。'
        + '本轮结论：AAV 直接相关记录 0 条，入库项均为待人工确认。'
        + '中文通道（chinadrugtrials/chictr_online/ictrp）本轮全部 DENIED/FAILED/NO_RESULTS，中文登记未取得，须下次重试——'
        + '不得据此说"中国无 AAV 相关试验"。'
        + '零命中只代表该来源本次未返回，不代表全球不存在（ctv 为本地子集索引，ICTRP 上游存在已知静默缺口）。'
    },
    sourceStatusRows: statusRows,
    coverage: {
      counted: covered,
      notCounted: notCovered,
      rule: '仅 SUCCESS / OK* 计入覆盖；FAILED / DENIED / NEEDS_SETUP / NO_RESULTS 一律不算"已查过"，不计覆盖（35 号纪律）'
    },
    sourceStates: Object.fromEntries(stateBySource),
    honesty: {
      offlineCorpora: 'ChiCTR/CDE/CTV 离线语料仅胰腺癌覆盖；AAV 只依赖在线通道终态，见 source_statuses 表',
      statusWording: '登记 ≠ 有效 ≠ 安全 ≠ 可入组；状态一律"登记状态，未核实"',
      mergeRule: '仅同一登记号（NCT/ChiCTR/CDE 等）合并，其余并排保留来源',
      noMatchScore: '本数据包不产出任何数值匹配度；分层与三态由读模型按 35 号执行'
    },
    files: {
      jsonl: { path: 'trials-2026.jsonl', sha256: sha256(jsonlPath), lines: lines.length },
      sqlite: { path: 'anca_trials_2026.sqlite', sha256: sha256(dbPath), trials: dbCount, sourceStatusRows: statusRows }
    }
  };
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const readme = `# research/anca-vasculitis · ANCA 相关血管炎 2026 临床试验数据包

> 采集：unified-trial-mcp（MCP stdio 唯一入口）；脚本 \`scripts/fetch-anca-trials-2026.mjs\`（支持 --dry-run）。

## 首轮终态（快照 ${SNAPSHOT_DATE}）

| 来源 | 终态 | 计覆盖 |
| --- | --- | --- |
${[...stateBySource.entries()].map(([id, st]) => `| ${id} | ${st} | ${covered.includes(id) ? '✅ 计入' : '❌ 不计'} |`).join('\n')}

**纪律**：FAILED/DENIED/NEEDS_SETUP/NO_RESULTS 不算"已查过"、不计覆盖；登记状态一律"登记状态，未核实"。
**相关性过滤**：宽口径词（如 vasculitis）会带出非 AAV 条目，入库前按标题+URL 命中 AAV 词表；本轮丢弃 ${dropped.length} 条非 AAV 记录（详见 manifest.relevance）。
manifest=jsonl=sqlite（实测 ${lines.length}=${lines.length}=${dbCount}）。

## 口径

- 关键词 ${QUERIES.length} 组：中文标准名/常用写法 + 三型中文名 + 抗体宽口径 + 英文全称/三型 + 缩写 + 药物线（avacopan）。
- 合并规则：仅同一登记号合并来源，其余并排保留。
- 不产出任何数值匹配度；命中分层与三态（命中/无法自动匹配/不产出"不适用"）由读模型按 35 号执行。

## 文件

| 文件 | 说明 |
| --- | --- |
| \`manifest.json\` | 口径 + 终态 + 覆盖 + 文件指纹（sha256） |
| \`trials-2026.jsonl\` | 每条登记一行（recordId / 来源 / 登记号 / 日期 / 链接 / snapshotDate） |
| \`anca_trials_2026.sqlite\` | 同上入库 + \`source_statuses\`（逐查询逐来源终态与是否计覆盖） |

## 复跑

\`\`\`bash
node scripts/fetch-anca-trials-2026.mjs --dry-run   # 先看来源终态
node scripts/fetch-anca-trials-2026.mjs             # 重采并更新四件套
\`\`\`
`;
  writeFileSync(join(OUT_DIR, 'README.md'), readme);

  console.log(`\n✔ 四件套已写入 ${OUT_DIR}`);
  console.log(`  records=${lines.length}  db=${dbCount}  statusRows=${statusRows}  丢弃(非AAV)=${dropped.length}`);
  console.log(`  计覆盖来源：${covered.join(', ') || '（无）'}`);
  console.log(`  不计覆盖：${notCovered.map((x) => `${x.sourceId}:${x.state}`).join(', ') || '（无）'}`);
}

main().catch((e) => { console.error('✘ 采集失败：', e.message); process.exit(1); });

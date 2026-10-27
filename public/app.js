'use strict';
/* 小脉宝 VasPal v0.2.1 — ANCA 相关血管炎（AAV）患者工作台交互原型。
   数据唯一来源 demo-data.js（合成演示）；不读写真实文件、不调用模型或宿主 API。
   一级导航 10 线 key 与 docs/INTERACTION-DESIGN.md §五逐字一致（IP3）：
   dashboard / titer / treatment / relapse / sideeffect / pathology / calendar / visit / records / oneshow。
   看板入口文案逐字用 INTERACTION-DESIGN §二入口列：「记一次复查」「记一次事件」「记一次用药变更」
   「记一条副作用」「准备复诊」「存一份报告」；主体切换逐字「替家人记」。
   红线（DEV-REQUIREMENTS T1–T7 + IP1–IP10）：
   T1 无判读列——指标只显示 值+单位+日期+报告原句引用，零 复发/缓解/控制/建议 判定词；滴度回升不与复发连线；
   T2 PR3 与 MPO 分列；滴度轨与肾功/尿检/炎症轨分列，永不加总成一个分数；
   T3 复发事件独立档案（relapse_event），不复用肿瘤 recurrence 命名，不判定"是不是复发"；
   T4 治疗版本链：开始/结束/变更原因原文，旧版本不覆盖；零调量建议与停药暗示文案；
   T5 激素副作用分节（骨/糖代谢/感染/眼与其他），分类副作用不进滴度趋势；
   T6 双主体 recorder（本人/家属代记），visibility=private 三出口（看板/一图秀/导出与 AI 上下文）统一过滤；
   T7 随访节奏只记医嘱原文，不推算"该查了"；急症提示固定通用、不判分诊。
   AI 协助入口为 anca:agent-draft 协议链接（34 号：嵌入式形态携带预写提示词+已核对上下文直接发送；
   独立打开时复制提示词并说明没有会话面板，页面不自建聊天窗/输入框/发送键）。候选逐项核对才入事实层；拒收零副作用（IP5）。
   手工通道「⋯ 更多」收敛：每页显式编辑 ≤1、表单 ≤6 字段、数字用键盘组件（IP6/IP7）。
   全站无裸删除文案（IP8）：更正 = 新增版本，旧版本永远可查（IP9）。 */

const APP_INFO = {
  version: '0.2.11', build: '2026-10-27',
  channelLabel: '交互原型 · 未接入 DSH / AI',
  brand: '小脉宝 VasPal', en: 'anca-vasculitis', proto: 'anca'
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uidSeq = 0;
const uid = (p) => p + (++uidSeq);
const DAY = 86400000;

/* ---------------- 探针合同（scripts/check-probe-coverage.mjs） ---------------- */
var ROUTES = ['dashboard', 'titer', 'treatment', 'relapse', 'sideeffect', 'pathology', 'calendar', 'visit', 'records', 'oneshow'];

/* ---------------- 导航（10 一级 / key 逐字 = INTERACTION-DESIGN §五） ---------------- */
const icons = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  drip: 'M12 3v6m0 0a5 5 0 1 0 5 5M7 21h10M12 9V3m-3 0h6',
  flag: 'M5 21V4m0 1h12l-2.5 4L17 13H5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  scan: 'M4 8V4h4M20 8V4h-4M4 16v4h4m12-4v4h-4M7 12h10',
  calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2m4 0h2',
  visit: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16M9 15l2 2 4-4',
  folder: 'M4 6h6l2 2h8v11H4ZM4 6v13',
  chart: 'M4 20V5m0 15h16M8 16l3-5 3 3 4-7'
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[k]}"/></svg>`;

const PAGES = [
  ['dashboard', '看板', 'home'],
  ['titer', '滴度与肾功时间线', 'pulse'],
  ['treatment', '治疗与用药', 'drip'],
  ['relapse', '复发事件', 'flag'],
  ['sideeffect', '激素副作用分节', 'shield'],
  ['pathology', '病理与影像', 'scan'],
  ['calendar', '随访日历', 'calendar'],
  ['visit', '复诊与资料', 'visit'],
  ['records', '病情整理', 'folder'],
  ['oneshow', '病情一图秀', 'chart']
];
/* 二级页（(view,sub) 全集 = ROUTE_MANIFEST，IP2 双向覆盖） */
const SUBPAGES = {
  titer: [['trend', 'PR3·MPO 曲线'], ['renal', '肌酐与尿检'], ['labmeta', '检测口径与实验室']],
  treatment: [['current', '当前方案'], ['phases', '诱导与维持'], ['dosechain', '剂量与变更链'], ['tolerance', '用药耐受']],
  relapse: [['events', '事件档案'], ['organs', '受累器官'], ['evidence', '确认依据原文'], ['review', '事件回顾']],
  sideeffect: [['bone', '骨与关节'], ['glucose', '糖代谢'], ['infection', '感染'], ['eye', '眼与其他']],
  pathology: [['biopsy', '肾活检'], ['imaging', '影像'], ['reports', '报告原文与术语']],
  calendar: [['rhythm', '随访节奏'], ['upcoming', '近期安排'], ['plan', '检查计划']],
  visit: [['summary', '复诊摘要'], ['questions', '问题清单'], ['reports', '报告与任务']],
  records: [['library', '资料库'], ['drafts', '整理草稿与核对'], ['profile', '病情档案'], ['metrics', '指标检测'], ['summary', '病情汇总']],
  oneshow: [['curves', '数值曲线'], ['events', '事件与节点'], ['meta', '数据口径']]
};
const SUBTITLES = {
  dashboard: '把今天能做的一件事放在最前面；只整理不判定——判读归主诊团队。',
  titer: 'PR3 与 MPO 分列；滴度与肌酐/尿检分轨；单位随报告原文。',
  treatment: '方案按段记录：开始、暂停、停用都留痕，旧方案不覆盖。',
  relapse: '事件只记事实：日期、受累器官、确认依据原文；是否复发由医生判断。',
  sideeffect: '骨、糖代谢、感染、眼各归各节；分类副作用不进滴度趋势。',
  pathology: '肾活检与影像只引用报告原文；术语解释不含严重度判断。',
  calendar: '复查节奏以医嘱原文为准；本页只登记与提醒，不推算"该查了"。',
  visit: '复诊摘要 + 问题清单 + 资料导出；摘要只汇总事实。',
  records: '原件永远保留，接受之前都只是候选。',
  oneshow: '数值与事件放回同一段时间给医生看；private 记录不出现在本页。'
};

/* 各二级页描述（页头副标题由 render 集中提供，键 = view/sub） */
const SUBDESC = {
  'titer/trend': '滴度轨独立展示：PR3 与 MPO 分列、各自真实纵轴；肾功/尿检在「肌酐与尿检」页。',
  'titer/renal': '肾功轨与尿检轨并列展示；单位与参考区间随报告原文，本台不解读箭头。',
  'titer/labmeta': '每次检测的机构、方法与单位口径；跨院比较数值前先看这里。',
  'treatment/current': '按最近医嘱原文展示；剂量与疗程以主诊团队为准，本台零调整建议。',
  'treatment/phases': '按医嘱原文里的阶段词分组；阶段划分以医生记录为准。',
  'treatment/dosechain': '每条记录都是版本：旧的永远可查；更正 = 新增一条版本并注明原因。',
  'treatment/tolerance': '用药期间的身体反应与检查所见，按原文记录；归因由医生判断。',
  'relapse/events': '复发事件独立建档：日期、受累器官、确认依据原文、科室；不复用肿瘤"复发转移"结构，也不判定"是不是复发"。',
  'relapse/organs': '按事件档案里登记的器官汇总次数；只是统计，不构成病情判断。',
  'relapse/evidence': '每次事件"当时凭什么确认"的原文，可带去复诊；不做核对结论。',
  'relapse/review': '事件与前后化验放回同一段时间；两条事实轨并列，不画因果箭头（T1）。',
  'sideeffect/bone': '骨与关节：分节记录症状与检查所见原文；归因由医生判断，分类数据不进滴度趋势。',
  'sideeffect/glucose': '糖代谢：分节记录症状与检查所见原文；归因由医生判断，分类数据不进滴度趋势。',
  'sideeffect/infection': '感染：分节记录症状与检查所见原文；归因由医生判断，分类数据不进滴度趋势。',
  'sideeffect/eye': '眼与其他：分节记录症状与检查所见原文；归因由医生判断，分类数据不进滴度趋势。',
  'pathology/biopsy': '报告原文 + 术语卡；本台不做病理分级、不给严重度。',
  'pathology/imaging': '影像报告原文引用；「新出现/较前」等是报告用词，含义请医生解释。',
  'pathology/reports': '全部病理/影像原句汇总，可整段复制带去复诊。',
  'calendar/rhythm': '节奏以医嘱原文为准；本台只登记，不推算"该查了"。',
  'calendar/upcoming': '下一次复诊的科室、要查项目、要带材料。',
  'calendar/plan': '按下次复诊的"要查"拆成清单；完成后在复诊后回填结果。',
  'visit/summary': '按时间范围汇总事实（180 天），逐条勾选后生成；不生成结论。',
  'visit/questions': '复诊前想问的问题；医生答复后标记，原话照记。',
  'visit/reports': '导出快照、资料清单与临床研究入口（三态）。',
  'records/library': '原件清单与出处；私密条目只在这里可见。',
  'records/drafts': '导入/口述产生的候选都先停在这里；接受之前不进事实层。',
  'records/profile': '主体与照护者；亚型/血清型只存原文，不判定。',
  'records/metrics': '本台登记的指标目录与轨道归属；只有数值型检验进趋势白名单。',
  'records/summary': '各线记录数统计；只数数，不判断。',
  'oneshow/curves': '每个指标一块独立面板、真实纵轴；private 不出现，分类副作用不进来。',
  'oneshow/events': '事件与滴度节点并列；两条轨分开画，不连线、不判定。',
  'oneshow/meta': '这一页给医生看之前，先说清数据怎么来的。'
};
/* (view,sub) 全集，供探针与 X1 穷举使用 */
const ROUTE_MANIFEST = [
  ['titer', 'trend'], ['titer', 'renal'], ['titer', 'labmeta'],
  ['treatment', 'current'], ['treatment', 'phases'], ['treatment', 'dosechain'], ['treatment', 'tolerance'],
  ['relapse', 'events'], ['relapse', 'organs'], ['relapse', 'evidence'], ['relapse', 'review'],
  ['sideeffect', 'bone'], ['sideeffect', 'glucose'], ['sideeffect', 'infection'], ['sideeffect', 'eye'],
  ['pathology', 'biopsy'], ['pathology', 'imaging'], ['pathology', 'reports'],
  ['calendar', 'rhythm'], ['calendar', 'upcoming'], ['calendar', 'plan'],
  ['visit', 'summary'], ['visit', 'questions'], ['visit', 'reports'],
  ['records', 'library'], ['records', 'drafts'], ['records', 'profile'], ['records', 'metrics'], ['records', 'summary'],
  ['oneshow', 'curves'], ['oneshow', 'events'], ['oneshow', 'meta']
];

/* 场景直达（INTERACTION-DESIGN §二 S01–S07，走查锚点；covers 供 X1 穷举） */
const SCENES = [
  { id: 'S01', label: '记一次复查', entry: 'card-titer', view: 'titer', sub: 'trend', covers: ['titer/trend', 'titer/renal', 'titer/labmeta', 'oneshow/curves', 'oneshow/meta'] },
  { id: 'S02', label: '记一次事件', entry: 'card-relapse', view: 'relapse', sub: 'events', covers: ['relapse/events', 'relapse/organs', 'relapse/evidence', 'relapse/review', 'oneshow/events'] },
  { id: 'S03', label: '记一次用药变更', entry: 'card-treatment', view: 'treatment', sub: 'current', covers: ['treatment/current', 'treatment/phases', 'treatment/dosechain', 'treatment/tolerance'] },
  { id: 'S04', label: '记一条副作用', entry: 'card-sideeffect', view: 'sideeffect', sub: 'bone', covers: ['sideeffect/bone', 'sideeffect/glucose', 'sideeffect/infection', 'sideeffect/eye'] },
  { id: 'S05', label: '准备复诊', entry: 'card-visit', view: 'visit', sub: 'summary', covers: ['visit/summary', 'visit/questions', 'visit/reports', 'calendar/rhythm', 'calendar/upcoming', 'calendar/plan', 'records/summary'] },
  { id: 'S06', label: '存一份报告', entry: 'card-pathology', view: 'pathology', sub: 'biopsy', covers: ['pathology/biopsy', 'pathology/imaging', 'pathology/reports', 'records/library', 'records/drafts', 'records/profile', 'records/metrics'] },
  { id: 'S07', label: '替家人记', entry: 'actor-toggle', view: 'dashboard', sub: '', covers: ['dashboard'] }
];

/* ---------------- 指标目录（T2：分轨；只有数值型检验进趋势白名单） ---------------- */
const MARKERS = {
  PR3_ANCA: { name: 'PR3-ANCA', track: '滴度', unitCtx: 'RU/mL 与 U/mL 混现，单位随报告原文', color: '#3E7C8F' },
  MPO_ANCA: { name: 'MPO-ANCA', track: '滴度', unitCtx: 'RU/mL 与 U/mL 混现，单位随报告原文', color: '#2B5A69' },
  CREATININE: { name: '血肌酐', track: '肾功', unitCtx: 'μmol/L', color: '#D97B29' },
  EGFR: { name: 'eGFR', track: '肾功', unitCtx: 'mL/min/1.73m²', color: '#E09A55' },
  URINE_PROTEIN: { name: '尿蛋白定量', track: '尿检', unitCtx: 'g/24h', color: '#64818C' },
  URINE_RBC: { name: '尿红细胞', track: '尿检', unitCtx: '个/μL', color: '#8FA6AD' },
  ESR: { name: '血沉', track: '炎症', unitCtx: 'mm/h', color: '#7E9C77' },
  CRP: { name: 'C 反应蛋白', track: '炎症', unitCtx: 'mg/L', color: '#5F8763' }
};
const TRACKS = { 滴度: '滴度轨（PR3 与 MPO 分列）', 肾功: '肾功轨', 尿检: '尿检轨', 炎症: '炎症轨' };
const SIDE_SECTIONS = { bone: '骨与关节', glucose: '糖代谢', infection: '感染', eye: '眼与其他', other: '其他' };

/* ---------------- state ---------------- */
/* 数据层（开发版）：先向 /api/anca-vasculitis/bootstrap 要真数据，拿不到才回退 window.DEMO_DATA。
   原型与开发版是同一份渲染代码：这里只改"数据从哪来"，不改任何视图函数。
   三态：api（本机库）/ demo（离线演示，横幅提醒）/ empty（库通了但为空，显示空态，
   不拿演示档案把空工作区填满——否则用户会以为数据被写进来了）。 */
let DATA = (typeof DEMO_DATA !== 'undefined') ? DEMO_DATA : { profiles: [], meta: {}, trialSnapshot: null };
let TODAY = DATA.meta?.today || new Date().toISOString().slice(0, 10);
let DATA_SOURCE = 'pending';
function apiBase() {
  const m = location.pathname.match(/^(.*)\/ui(?:\/|$)/);
  return m ? m[1] : '';
}
async function loadBootstrap() {
  const url = apiBase() + '/bootstrap';
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return 'demo';
    const data = await res.json();
    if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {
      DATA = { profiles: [], meta: data?.meta ?? {}, trialSnapshot: null };
      TODAY = DATA.meta?.today || TODAY;
      return 'empty';
    }
    DATA = data;
    TODAY = DATA.meta?.today || TODAY;
    return 'api';
  } catch { return 'demo'; }
}
const state = {
  page: 'dashboard', sub: {},
  profileIdx: 0,
  chartSel: null,
  chartRange: 'all',
  actor: 'PATIENT',
  cfg: { root: '/Users/demo/Documents/VasPal（演示）', storeState: '就绪', defaultVisibility: 'normal' },
  mem: { labs: [], events: [], treatments: [], sideEffects: [], docs: [], questions: null, candidates: [], summaries: [], followups: [], tolerance: [], profiles: {} }
};
/* 写入适配层（M5）：原型只写内存；开发版由 scripts/build-public.mjs 注入服务端实现。
   两条通道（手工表单 / AI 候选确认）都走这里 —— 同源写同一事实层（IP9）。 */
let PERSIST = null;
async function persist(kind, payload) {
  if (typeof PERSIST === 'function') {
    try {
      const res = await PERSIST(kind, payload);
      if (res && res.ok === false) { toast('未保存：' + (res.error || '服务端拒绝')); return false; }
      return true;
    } catch (e) {
      toast('未保存：本机服务不可达（' + String(e.message || e).slice(0, 40) + '）');
      return false;
    }
  }
  return true;
}

const mem = () => state.mem;
const profile = () => DATA.profiles[state.profileIdx] || (state.emptyProfile ||= { id: `profile_${uid('new')}`, name: '', age: '', sex: '', subtypeText: '', serologyText: '', dxDate: null, meta: '尚未建档', caregiverLabel: '', caregiver: '', labQuoteNote: '', labs: {}, treatmentVersions: [], relapseEvents: [], sideEffects: {}, pathology: [], imaging: [], followups: [], upcoming: [], documents: [], notes: [], visit: { nextDate: null, nextDept: '', questions: [], summaries: [] }, savedTrials: [] });
const added = (k) => { if (!mem()[k]) mem()[k] = []; return mem()[k]; };
const questions = () => { if (!mem().questions) mem().questions = (profile().visit.questions || []).map((q) => ({ ...q })); return mem().questions; };
const privateNotes = () => (profile().notes || []).filter((n) => n.visibility === 'private');
const fmtDate = (d) => String(d || '').replace(/-/g, '.');
const shortDate = (d) => String(d || '').slice(5).replace('-', '.');
const recorderTag = (r) => r === 'FAMILY' ? pill('家属代记', 'mist') : pill('本人自记', 'blue');
const visTag = (v) => v === 'private' ? pill('私密', 'warn') : '';

/* ---------------- 通用 UI ---------------- */
const btn = (text, action, cls = '', attr = '') => `<button class="${cls}" data-action="${action}" ${attr}>${text}</button>`;
const go = (text, page, sub = '', cls = '', attr = '') => btn(text, 'go', cls, `data-page="${page}" data-sub="${esc(sub)}"${attr ? ' ' + attr : ''}`);
const pill = (text, cls = '') => `<span class="pill ${cls}">${esc(text)}</span>`;
const section = (title, desc = '', action = '') => `<div class="section-title"><div><h2>${title}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div><div class="actions">${action}</div></div>`;
const backRow = () => state.page === 'dashboard' ? '' : `<div class="back-row">${btn('← 回到看板', 'go', 'text-button', 'data-page="dashboard"')}</div>`;
const head = (title, desc, action = '') => `<div class="page-head"><div><span class="eyebrow">VASPAL / ANCA WORKBENCH</span><h1>${title}</h1><p>${esc(desc)}</p></div><div class="actions">${action}</div></div>`;
const moreMenu = (items) => `<details class="more-menu"><summary aria-label="更多操作">⋯ 更多</summary><div class="menu">${items.map(([t, a, attr]) => `<button data-action="${a}" ${attr || ''}>${esc(t)}</button>`).join('')}</div></details>`;
const quote = (q, src) => `<span class="tag-quote"><b>报告原文</b> ${esc(q)}${src ? ` <small>—— ${esc(src)}</small>` : ''}</span>`;

function toast(t, opts = {}) {
  const el = $('#toast');
  const cta = opts.cta ? `<button class="toast-cta" data-action="${opts.cta.action}" ${opts.cta.page ? `data-page="${opts.cta.page}"` : ''} ${opts.cta.sub ? `data-sub="${opts.cta.sub}"` : ''}>${esc(opts.cta.text)}</button>` : '';
  el.innerHTML = esc(t) + cta;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
function openModal(title, body, foot = '', eyebrow = '小脉宝 · 交互演示') {
  $('#dialog-eyebrow').textContent = eyebrow;
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = body;
  $('#dialog-foot').innerHTML = foot;
  $('#dialog').showModal();
}
const closeModal = () => { if ($('#dialog').open) $('#dialog').close(); };

function navigate(page, sub) {
  if (!ROUTES.includes(page)) page = 'dashboard';
  state.page = page;
  state.sub[page] = sub || (SUBPAGES[page] ? SUBPAGES[page][0][0] : '');
  render();
  $('#main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ---------------- AI 协助（34 号：anca:agent-draft；候选=候选，核对才入事实层） ---------------- */
const EMBEDDED = (() => { try { return window.parent && window.parent !== window } catch { return false } })();

function confirmedContext() {
  const p = profile();
  const latest = (k) => { const a = allLabs(k); return a.length ? `${MARKERS[k].name} 最近一次 ${a[a.length - 1].v} ${a[a.length - 1].unit}（${a[a.length - 1].d}）` : ''; };
  const rows = [
    latest('PR3_ANCA'), latest('MPO_ANCA'), latest('CREATININE'),
    p.treatmentVersions ? '当前方案：' + currentTreatments().map((t) => `${t.drug}（${t.dose}）`).join('；') : '',
    p.relapseEvents ? `复发事件 ${p.relapseEvents.length} 次（最近 ${p.relapseEvents[p.relapseEvents.length - 1]?.d || '—'}）` : ''
  ].filter(Boolean);
  return rows.join('；') || '（暂无已核对记录）';
}
function aiPromptFor(sceneId) {
  const s = SCENES.find((x) => x.id === sceneId) || SCENES[0];
  return `我在用小脉宝登记「${s.label}」。请把我下面口述/照片里的内容整理成结构化候选（逐字段列出：字段名、候选值、原文依据），不要生成任何判断或建议；我核对后才入库。\n已核对的病情上下文（private 已过滤）：${confirmedContext()}\n（示例提示词，正式版本在开发版接通原生会话）`;
}
const aiLink = (sceneId = 'S01', label = 'AI 协助') =>
  `<a class="ai-link" href="${APP_INFO.proto}:agent-draft?prompt=${encodeURIComponent(aiPromptFor(sceneId))}" data-action="agent-draft" data-scene="${sceneId}">✦ ${esc(label)}<small>（候选→核对→入库）</small></a>`;

/* 页内只把提示词交给宿主原生会话：嵌入式 postMessage anca:agent-draft；
   独立打开复制到剪贴板并明说没有会话面板。页面里不渲染聊天窗/输入框/发送键。 */
function copyPromptText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => false);
    }
  } catch { /* 剪贴板不可用：由调用方如实提示手动复制 */ }
  return Promise.resolve(false);
}

function handleAgentDraft(sceneId) {
  const prompt = aiPromptFor(sceneId);
  if (EMBEDDED) {
    let sent = true;
    try { window.parent.postMessage({ type: `${APP_INFO.proto}:agent-draft`, prompt, send: true }, location.origin); } catch { sent = false; }
    if (!sent) {
      void copyPromptText(prompt).then((ok) => toast(ok ? '未送达原生会话：已复制提示词，请手动粘贴' : '未送达原生会话：请手动复制提示词后粘贴'));
    } else toast('已把预写提示词发送到 AI 会话（候选需逐项核对后才入库）');
    openCandidateDemo(sceneId);
  } else {
    void copyPromptText(prompt).then((ok) => toast(ok
      ? '已复制预写提示词；独立打开没有 AI 会话面板，请粘贴到宿主会话'
      : '独立打开没有 AI 会话面板；请手动复制提示词后粘贴到宿主会话'));
    openCandidateDemo(sceneId);
  }
}

/* 示例候选流（IP5 演示）：候选→逐项核对→确认入库；拒收零副作用 */
const CAND_DEMOS = {
  S01: () => ({ key: 'labs', title: '化验候选（示例）', rows: [
    { f: '指标', v: 'MPO-ANCA' }, { f: '数值', v: '16.4' }, { f: '单位', v: 'RU/mL' },
    { f: '日期', v: '2026-10-26' }, { f: '实验室', v: '某某市人民医院' }, { f: '报告原句', v: '"MPO-ANCA 16.4 RU/mL"' }
  ] }),
  S02: () => ({ key: 'events', title: '复发事件候选（示例）', rows: [
    { f: '日期', v: '2026-10-20' }, { f: '受累器官', v: '关节' }, { f: '症状', v: '双膝酸痛一周' },
    { f: '确认依据原文', v: '"门诊记录：双膝压痛，建议复查炎症指标"' }, { f: '科室', v: '风湿科' }
  ] }),
  S03: () => ({ key: 'treatments', title: '用药变更候选（示例）', rows: [
    { f: '药名', v: '吗替麦考酚酯胶囊' }, { f: '剂量原文', v: '"0.5g 每日两次"' }, { f: '途径', v: '口服' },
    { f: '开始日期', v: '2026-10-26' }, { f: '变更原因原文', v: '"复诊医嘱：维持方案不变"' }
  ] }),
  S04: () => ({ key: 'sideEffects', title: '副作用候选（示例）', rows: [
    { f: '分节', v: '骨与关节' }, { f: '症状/事项', v: '晨僵约 10 分钟' },
    { f: '检查/所见原文', v: '"骨密度报告：腰椎骨密度低值范围"' }, { f: '日期', v: '2026-10-26' }
  ] }),
  S06: () => ({ key: 'docs', title: '报告候选（示例）', rows: [
    { f: '名称', v: '眼科复查报告 2026-10-26' }, { f: '类型', v: '检查报告' },
    { f: '日期', v: '2026-10-26' }, { f: '原句摘录', v: '"双眼晶状体轻度混浊，建议随访"' }
  ] })
};
function openCandidateDemo(sceneId) {
  const gen = CAND_DEMOS[sceneId];
  if (!gen) { toast('该场景以手工通道为准（红线实体不做 AI 通道）'); return; }
  const demo = gen();
  const body = `<div class="notice plain">这是<b>候选演示</b>：真机中候选由 Desktop 原生会话生成。候选不是事实——逐项核对后点「确认入库」；「拒收」零副作用。</div>`
    + demo.rows.map((r, i) => `<div class="cand" id="cand-${i}"><div class="cand-head"><b>${esc(r.f)}</b><span>${esc(r.v)}</span><span style="margin-left:auto">${btn('接受', 'cand-accept', 'text-button', `data-cid="${i}"`)}${btn('拒收', 'cand-reject', 'text-button', `data-cid="${i}"`)}</span></div><div class="kv"><b>依据</b><span>示例原文（演示）</span></div></div>`).join('')
    + `<p class="small-note">private 条目不会进入导出与 AI 上下文（三出口同源过滤）。</p>`;
  state._cand = { demo, rejected: {} };
  openModal(demo.title, body,
    btn('全部拒收', 'cand-all-reject', '') + btn('确认入库', 'cand-commit', 'primary'));
}

/* ---------------- 化验读取（T2：marker 分列 + mem 合并，按日期升序） ---------------- */
function allLabs(marker) {
  const own = (profile().labs || {})[marker] || [];
  const extra = added('labs').filter((x) => x.marker === marker);
  return own.concat(extra).slice().sort((a, b) => a.d < b.d ? -1 : 1);
}
function latestLab(marker) { const a = allLabs(marker); return a.length ? a[a.length - 1] : null; }
function currentTreatments() {
  const vs = allTreatments();
  const open = vs.filter((t) => !t.end);
  return open.length ? open : vs.slice(-1);
}
function allTreatments() { return (profile().treatmentVersions || []).concat(added('treatments')); }
function allEvents() { return (profile().relapseEvents || []).concat(added('events')).slice().sort((a, b) => a.d < b.d ? -1 : 1); }
function allSide(sectionKey) {
  return ((profile().sideEffects || {})[sectionKey] || []).concat(added('sideEffects').filter((x) => x.section === sectionKey))
    .slice().sort((a, b) => a.d < b.d ? -1 : 1);
}
function allDocs() { return (profile().documents || []).concat(added('docs')); }

/* ---------------- 趋势图（SVG；各序列按自身范围归一，仅看走势） ---------------- */
function sparkSVG(values, color) {
  const vs = values.slice(-6);
  if (vs.length < 2) return `<svg class="spark" viewBox="0 0 200 56" aria-hidden="true"></svg>`;
  const min = Math.min(...vs), max = Math.max(...vs), span = (max - min) || 1;
  const pts = vs.map((v, i) => `${8 + i * (184 / (vs.length - 1))},${48 - ((v - min) / span) * 38}`).join(' ');
  return `<svg class="spark" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true"><path d="M${pts}" stroke="${color}"/></svg>`;
}
/* ---------------- 趋势图（小面板 · 各面板独立真实纵轴，不做归一化误导） ---------------- */
function monotonePath(pts) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}
function chartRangeButtons() {
  const opts = [['all', '全部'], ['365', '近 1 年'], ['180', '近 6 个月']]
  return `<div class="range-grp" role="group" aria-label="时间范围">${opts.map(([v, t]) =>
    `<button data-action="chart-range" data-range="${v}" aria-pressed="${state.chartRange === v}">${t}</button>`).join('')}</div>`
}
function chartSVG(keys) {
  const cutoff = state.chartRange === 'all' ? null : isoShift(TODAY, -Number(state.chartRange))
  const series = keys
    .map((k) => ({ k, pts: allLabs(k).filter((x) => !cutoff || x.d >= cutoff) }))
    .filter((s) => s.pts.length)
  if (!series.length) return `<div class="empty">所选范围内还没有数值记录</div>`
  const allDates = series.flatMap((s) => s.pts.map((x) => Date.parse(x.d)))
  const t0 = Math.min(...allDates), t1 = Math.max(...allDates)
  const W = 420, H = 190, L = 52, R = 14, T = 16, B = 30
  const xOf = (t) => L + (t - t0) / Math.max(1, t1 - t0) * (W - L - R)
  const fmtY = (v) => v >= 1000 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString()
  const panels = series.map(({ k, pts }) => {
    const m = MARKERS[k]
    const vs = pts.map((x) => x.v)
    const min = Math.min(...vs), max = Math.max(...vs)
    const pad = (max - min) === 0 ? Math.max(1, Math.abs(max) * 0.1) : (max - min) * 0.12
    let lo = min - pad, hi = max + pad
    if (min >= 0) lo = Math.max(0, lo)   // 化验值非负：纵轴不下探负值
    const yOf = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
    const P = pts.map((x) => ({ x: xOf(Date.parse(x.d)), y: yOf(x.v), ...x }))
    const path = monotonePath(P)
    const area = P.length > 1 ? `${path}L${P[P.length - 1].x.toFixed(1)},${H - B}L${P[0].x.toFixed(1)},${H - B}Z` : ''
    const dots = P.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${m.color}"><title>${p.d} · ${p.v} ${p.unit}${p.lab ? ' · ' + p.lab : ''}</title></circle>`).join('')
    const last = pts[pts.length - 1]
    const midT = new Date((t0 + t1) / 2).toISOString().slice(0, 7)
    return `<div class="chart-panel"><h4><i class="dot" style="background:${m.color}"></i><b>${esc(m.name)}</b>${pill(m.track + '轨', 'mist')}<small class="num">${esc(m.unitCtx)}</small></h4>
    <svg class="panel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.name)} 趋势（真实纵轴）">
      ${[0, .5, 1].map((f) => `<line class="gridline" x1="${L}" x2="${W - R}" y1="${(T + f * (H - T - B)).toFixed(1)}" y2="${(T + f * (H - T - B)).toFixed(1)}"/>`).join('')}
      <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/><line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${area ? `<path d="${area}" fill="${m.color}" opacity="0.07"/>` : ''}
      <path d="${path}" fill="none" stroke="${m.color}" stroke-width="2.2" stroke-linecap="round"/>${dots}
      <text class="ylab" x="${L - 6}" y="${T + 8}" text-anchor="end">${fmtY(hi)}</text>
      <text class="ylab" x="${L - 6}" y="${H - B}" text-anchor="end">${fmtY(lo)}</text>
      <text class="ylab" x="${L - 6}" y="${T + 8 + (H - T - B) / 2}" text-anchor="end">${fmtY((lo + hi) / 2)}</text>
      <text class="ylab" x="${L}" y="${H - 10}">${new Date(t0).toISOString().slice(0, 7)}</text>
      <text class="ylab" x="${(L + (W - L - R) / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">${midT}</text>
      <text class="ylab" x="${W - R}" y="${H - 10}" text-anchor="end">${new Date(t1).toISOString().slice(0, 7)}</text>
      <text x="${(P[P.length - 1].x - 6).toFixed(1)}" y="${(P[P.length - 1].y - 8).toFixed(1)}" text-anchor="end" fill="${m.color}" font-size="11" font-weight="600">${fmtY(last.v)} ${esc(last.unit)}</text>
    </svg><p class="small-note">n=${pts.length} · 纵轴为真实数值范围 · 悬停圆点看每次原值</p></div>`
  }).join('')
  return `<div class="chart-grid">${panels}</div>`
}
function chartControls(trackLock) {
  let keys = Object.keys(MARKERS).filter((k) => allLabs(k).length)
  if (trackLock) keys = keys.filter((k) => MARKERS[k].track === trackLock)
  if (!state.chartSel || (trackLock && !state.chartSel.every((k) => MARKERS[k].track === trackLock)))
    state.chartSel = [profile().serologyText.includes('PR3') ? 'PR3_ANCA' : 'MPO_ANCA'].filter((k) => keys.includes(k))
  const groups = {}
  keys.forEach((k) => { const tr = MARKERS[k].track; (groups[tr] = groups[tr] || []).push(k) })
  return `<div class="chart-controls">${Object.entries(groups).map(([tr, ks]) =>
    `<fieldset class="track-group"><legend>${esc(TRACKS[tr])}</legend>${ks.map((k) =>
      `<label class="opt"><input type="checkbox" data-action="chart-sel" value="${k}" ${state.chartSel.includes(k) ? 'checked' : ''}>${esc(MARKERS[k].name)}</label>`).join('')}</fieldset>`).join('')}
  </div>`
}

/* ---------------- 看板 ---------------- */
function metricFlipCard(markerKey, extra) {
  const m = MARKERS[markerKey]; const a = allLabs(markerKey);
  const last = a[a.length - 1];
  const front = `<div class="flip" id="flip-${markerKey}">
    <div class="flip-inner"><div class="flip-face">
      <h3>${esc(m.name)} ${pill(m.track + '轨', 'mist')}</h3>
      ${last ? `<div class="kpi"><b class="num">${esc(String(last.v))}</b><span class="unit num">${esc(last.unit)} · ${fmtDate(last.d)}</span></div><p class="hint">${esc(last.lab || '')}</p>` : `<div class="empty">暂无记录</div>`}
      <div class="card-actions">${btn('翻面看走势', 'flip', 'text-button', `data-target="flip-${markerKey}"`)}${go('查看曲线', 'titer', 'trend', 'text-button')}</div>
    </div><div class="flip-face back">
      <h3>${esc(m.name)} · 近次走势</h3>
      ${sparkSVG(a.map((x) => x.v), m.color)}
      <p class="hint">各次单位与原句见「化验记录」；走势按自身范围归一。</p>
      <div class="card-actions">${btn('翻回正面', 'flip', 'text-button', `data-target="flip-${markerKey}"`)}${go('看数值表', 'titer', 'renal', 'text-button')}</div>
    </div></div></div>${extra || ''}`;
  return front;
}
/* ---------------- 看板状态卡（36 号 §2.6：四件结构，天数由锚点日派生） ---------------- */
function phaseInfo() {
  const p = profile();
  /* 锚点日：确诊日（Day 0）——与 T1 一致：只取档案原文记录的日期，不推断分期 */
  const anchor = p.dxDate && /\d{4}-\d{2}/.test(p.dxDate) ? `${p.dxDate.length === 7 ? p.dxDate + '-01' : p.dxDate}` : null;
  const days = anchor ? Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(anchor)) / DAY)) : null;
  const nextUp = (p.upcoming || [])[0] || null;
  const toNext = nextUp ? Math.round((Date.parse(nextUp.d) - Date.parse(TODAY)) / DAY) : null;
  const cur = currentTreatments();
  /* 阶段名取"当前方案"的医嘱原因原文（诱导/维持），无则显示待补 */
  const phaseRaw = cur.map((t) => t.reason || '').find((r) => r.includes('维持') || r.includes('诱导')) || '';
  const phase = phaseRaw.includes('维持') ? '维持期' : (phaseRaw.includes('诱导') ? '诱导期' : '');
  return { anchor, days, nextUp, toNext, phase, phaseRaw };
}
function statusCard() {
  const { anchor, days, nextUp, toNext, phase } = phaseInfo();
  if (!anchor || days === null) {
    return `<div class="card status-card" id="status-card">
      <div class="sc-head"><span class="eyebrow">状态卡 · 待初始化</span></div>
      <p class="sc-empty">还没有可用于计算天数的锚点日（确诊日）。</p>
      <p class="hint">在「病情整理 → 病情档案」里补确診日期与当前方案原文，本卡自动按天派生。</p>
      <div class="card-actions">${btn('去补档案', 'go', 'primary', 'data-page="records" data-sub="profile"')}${btn('疾病概要：ANCA 相关血管炎是什么？', 'primer-open', '', 'data-primer-open aria-haspopup="dialog"')}</div>
    </div>`;
  }
  const headTxt = toNext !== null && toNext >= 0
    ? `D+${days} 状态卡 · 距下次复查 ${toNext} 天`
    : `D+${days} 状态卡 · 下次复查日期待登记`;
  const statusLine = phase
    ? `当前阶段：<b>${esc(phase)}</b>（取自医嘱原文）`
    : `当前阶段：<b>待补</b>（治疗方案里还没有阶段原文）`;
  const nextLine = nextUp
    ? `下次：<b class="num">${fmtDate(nextUp.d)}</b>（${esc(nextUp.dept)} · ${esc(nextUp.items)}）`
    : `下次：<b>待登记</b>（随访日历）`;
  const mainBtn = phase === '维持期'
    ? go('看当前方案 →', 'treatment', 'current', 'primary')
    : go('看诱导与维持 →', 'treatment', 'phases', 'primary');
  return `<div class="card status-card" id="status-card">
    <div class="sc-head"><span class="eyebrow">${esc(headTxt)}</span></div>
    <div class="sc-days"><b class="num">第 ${days} 天</b><span>自确诊日 ${esc(fmtDate(anchor))} 起</span></div>
    <p class="sc-line">${statusLine}</p>
    <p class="sc-line">${nextLine}</p>
    <div class="card-actions">${mainBtn}${btn('疾病概要：ANCA 相关血管炎是什么？', 'primer-open', '', 'data-primer-open aria-haspopup="dialog"')}</div>
  </div>`;
}

function pageDashboard() {
  if (!DATA.profiles.length) return head('开始使用小脉宝', '本机资料目录已连接，但还没有档案。可建立档案或导入自己的资料；不会自动显示示例患者。')
    + `<div class="card empty-onboarding"><span class="eyebrow">本机资料目录 · 已连接</span><h2>先建立一个病情档案</h2><p>称呼为必填；确诊日期、亚型和血清型可先留空，之后可从已核对的报告补充。</p><div class="card-actions">${go('建立档案', 'records', 'profile', 'primary')}${go('导入文件或粘贴文本', 'records', 'drafts', '')}</div><p class="small-note">资料库当前为空，不会自动填入演示患者数据。</p></div>`;
  const p = profile();
  const nextUp = (p.upcoming || [])[0];
  const recentEvent = allEvents()[allEvents().length - 1];
  const actionCard = (cardName, sceneId, desc, extraBtn) => `
    <div class="card"><h3>${cardName} ${recorderTag(state.actor)}</h3><p class="hint">${esc(desc)}</p>
      <div class="card-actions">${btn(sceneLabel(sceneId), 'scene', 'primary', `data-scene="${sceneId}"`)}${aiLink(sceneId, 'AI 协助')}${extraBtn || ''}</div></div>`;
  const cards = statusCard() + `
    <div class="grid cols-3" style="margin-top:14px">
      ${String(p.serologyText || '').includes('PR3') ? metricFlipCard('PR3_ANCA') : metricFlipCard('MPO_ANCA')}
      ${metricFlipCard('CREATININE')}
      <div class="card"><h3>下次复诊</h3>
        ${nextUp ? `<div class="kpi"><b class="num">${fmtDate(nextUp.d)}</b><span class="unit">${esc(nextUp.dept)}</span></div><p class="hint">要查：${esc(nextUp.items)}；带：${esc(nextUp.bring)}</p>` : `<div class="empty">还没有登记下次复诊</div>`}
        <div class="card-actions">${btn(sceneLabel('S05'), 'scene', 'primary', 'data-scene="S05"')}${go('随访日历', 'calendar', 'upcoming', 'text-button')}</div>
      </div>
    </div>
    <div class="grid cols-3" style="margin-top:14px">
      ${actionCard('滴度与肾功', 'S01', '把每次复查的数值、单位与报告原句记在一起；PR3/MPO 分列。')}
      ${actionCard('复发事件', 'S02', '日期、受累器官、确认依据原文；是否复发由医生判断。', go('事件档案', 'relapse', 'events', 'text-button'))}
      ${actionCard('治疗与用药', 'S03', '方案按段留痕：开始、结束、变更原因原文。', go('当前方案', 'treatment', 'current', 'text-button'))}
    </div>
    <div class="grid cols-3" style="margin-top:14px">
      ${actionCard('激素副作用', 'S04', '骨/糖代谢/感染/眼各归各节；分类不进滴度趋势。', go('分节总览', 'sideeffect', 'bone', 'text-button'))}
      ${actionCard('病理与影像', 'S06', '肾活检与影像报告原文 + 术语解释（不含严重度判断）。', go('肾活检', 'pathology', 'biopsy', 'text-button'))}
      <div class="card"><h3>最近事件</h3>
        ${recentEvent ? `<div class="kpi"><b class="num">${fmtDate(recentEvent.d)}</b><span class="unit">${esc((recentEvent.organs || []).join(' · '))}</span></div><p class="hint">${esc(recentEvent.symptoms)}</p>` : `<div class="empty">还没有事件记录</div>`}
        <div class="card-actions">${go('事件回顾', 'relapse', 'review', 'text-button')}${go('病情一图秀', 'oneshow', 'events', 'text-button')}</div>
      </div>
    </div>
    <div class="notice plain" style="margin-top:14px"><b>提示</b>：出现医生曾告知过的急症症状、或病情骤变时，请尽快联系主诊团队或急诊——本台不判断严重程度、不做分诊。</div>
    ${privateNotes().length ? `<p class="small-note" style="margin-top:8px">另有 ${privateNotes().length} 条私密记录不显示在导出与一图秀（可在「病情整理 → 资料库」查看）。</p>` : ''}`;
  return cards;
}
const sceneLabel = (id) => (SCENES.find((s) => s.id === id) || {}).label || id;

/* ---------------- 滴度与肾功时间线 ---------------- */
function pageTiterTrend() {
  return `<div class="notice plain" style="margin-bottom:12px">数值变化不等于结论：是否复发、是否调药，由主诊团队判断（T1）。</div>`
    + chartControls('滴度') + chartSVG(state.chartSel || [])
    + section('化验记录', '每条只有 值 + 单位 + 日期 + 报告原句', moreMenu([['手工补一条化验', 'form-lab', '']]))
    + labTable(state.chartSel || [], true);
}
function labTable(keys, withQuote) {
  const rows = keys.flatMap((k) => allLabs(k).map((x) => ({ ...x, k }))).sort((a, b) => b.d < a.d ? -1 : 1);
  if (!rows.length) return `<div class="empty">还没有数值记录；可用右上「⋯ 更多 → 手工补一条化验」登记</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>日期</th><th>指标</th><th>值</th><th>单位</th><th>实验室 / 方法</th><th>记录人</th>${withQuote ? '<th>报告原句</th>' : ''}</tr></thead><tbody>
    ${rows.map((r) => `<tr><td class="num">${fmtDate(r.d)}</td><td>${esc(MARKERS[r.k].name)}</td><td class="num"><b>${esc(String(r.v))}</b></td><td class="num">${esc(r.unit)}</td><td>${esc(r.lab || '—')}</td><td>${recorderTag(r.recorder)}</td>${withQuote ? `<td>${esc(r.quote || '')}</td>` : ''}</tr>`).join('')}
  </tbody></table><p class="scroll-hint">表格可横向滚动 →</p></div>`;
}
function pageTiterRenal() {
  return section('肾功轨') + labTable(['CREATININE', 'EGFR'], false)
    + section('尿检轨') + labTable(['URINE_PROTEIN', 'URINE_RBC'], false)
    + section('炎症轨', '血沉与 CRP 常见于复查单，只记数值。') + labTable(['ESR', 'CRP'], false)
    + `<p class="small-note">参考区间各实验室不同，一律以报告原文为准；本台不显示"正常/异常"判定。</p>`;
}
function pageTiterLabmeta() {
  const rows = Object.keys(MARKERS).flatMap((k) => allLabs(k).slice(-1).map((x) => ({ k, x }))).filter((r) => r.x);
  return `<div class="table-wrap"><table><thead><tr><th>指标</th><th>最近一次</th><th>实验室 / 方法</th><th>单位口径</th></tr></thead><tbody>
    ${rows.map(({ k, x }) => `<tr><td>${esc(MARKERS[k].name)}</td><td class="num">${fmtDate(x.d)} · <b>${esc(String(x.v))}</b> ${esc(x.unit)}</td><td>${esc(x.lab || '—')}</td><td>${esc(MARKERS[k].unitCtx)}</td></tr>`).join('')}
    </tbody></table></div>`
    + `<div class="notice plain" style="margin-top:12px">${esc(profile().labQuoteNote || '')} 不同方法学（免疫印迹 / 化学发光 / 免疫荧光）数值不可直接互换比较。</div>`;
}

/* ---------------- 治疗与用药（T4 版本链） ---------------- */
function treatRow(t) {
  return `<tr><td class="num">${fmtDate(t.start)}${t.end ? ` – <span class="num">${fmtDate(t.end)}</span>` : ' – 至今'}</td>
    <td><b>${esc(t.drug)}</b><br><small>${esc(t.dose)}</small></td><td>${esc(t.route)}</td>
    <td>${esc(t.reason || '')}<br><small>来源：${esc(t.source || '—')}</small></td><td>${recorderTag(t.recorder)}</td></tr>`;
}
function pageTreatmentCurrent() {
  const cur = currentTreatments();
  return (cur.length ? `<div class="grid cols-2">${cur.map((t) => `<div class="card"><h3>${esc(t.drug)} ${pill(t.route, 'blue')}</h3>
      <p class="hint num">${fmtDate(t.start)} 开始${t.end ? ` · ${fmtDate(t.end)} 结束` : ' · 进行中'}</p>
      <span class="tag-quote"><b>医嘱原文口径</b> ${esc(t.dose)}</span>
      <p class="hint">来源：${esc(t.source || '—')}</p></div>`).join('')}</div>` : `<div class="empty">还没有用药记录</div>`)
    + section('全部用药记录', '只增不改；换药/停用都是新增一条', moreMenu([['手工记一次用药变更', 'form-treat', '']]))
    + `<div class="table-wrap"><table><thead><tr><th>起止</th><th>药与剂量</th><th>途径</th><th>变更原因 / 来源</th><th>记录人</th></tr></thead><tbody>${allTreatments().slice().reverse().map(treatRow).join('')}</tbody></table></div>`;
}
function pageTreatmentPhases() {
  const vs = allTreatments().slice().sort((a, b) => a.start < b.start ? -1 : 1);
  const phaseOf = (t) => (t.reason || '').includes('维持') ? '维持期' : '诱导期';
  const groups = {};
  vs.forEach((t) => { (groups[phaseOf(t)] = groups[phaseOf(t)] || []).push(t); });
  return ['诱导期', '维持期'].map((ph) => section(ph, groups[ph] ? `${groups[ph].length} 条版本` : '暂无该阶段记录')
      + (groups[ph] ? `<div class="table-wrap"><table><thead><tr><th>起止</th><th>药与剂量</th><th>变更原因 / 来源</th></tr></thead><tbody>${groups[ph].slice().reverse().map(treatRow).join('')}</tbody></table></div>` : `<div class="empty">暂无</div>`)).join('');
}
function pageTreatmentDosechain() {
  const vs = allTreatments().slice().sort((a, b) => a.start < b.start ? -1 : 1);
  const menu = section('更多', '更正 = 新增一条版本并注明原因', moreMenu([['手工记一次用药变更', 'form-treat', ''], ['查看复发事件档案', 'go', 'data-page="relapse" data-sub="events"']]));
  return `<ol class="tl">${vs.map((t) => `<li><div class="what"><span class="when num">${fmtDate(t.start)}</span><b>${esc(t.drug)}</b>${recorderTag(t.recorder)}</div>
      <p class="hint">${esc(t.dose)}${t.end ? ` · ${fmtDate(t.end)} 结束` : ''}</p>
      <span class="tag-quote"><b>变更原因原文</b> ${esc(t.reason || '—')}</span>${t.source ? `<p class="small-note">来源：${esc(t.source)}</p>` : ''}</li>`).join('')}</ol>` + menu;
}
function pageTreatmentTolerance() {
  const entries = added('tolerance');
  const sections = Object.entries(SIDE_SECTIONS).flatMap(([k, label]) => allSide(k).map((x) => ({ ...x, sectionLabel: label })));
  return (entries.length || sections.length ? `<div class="table-wrap"><table><thead><tr><th>日期</th><th>事项</th><th>原文</th><th>分节</th><th>记录人</th></tr></thead><tbody>
      ${sections.map((x) => `<tr><td class="num">${fmtDate(x.d)}</td><td>${esc(x.text)}</td><td>${esc(x.quote)}</td><td>${esc(x.sectionLabel)}</td><td>${recorderTag(x.recorder)}</td></tr>`).join('')}
      ${entries.map((x) => `<tr><td class="num">${fmtDate(x.d)}</td><td>${esc(x.text)}</td><td>${esc(x.quote || '')}</td><td>${esc(x.sectionLabel || '耐受')}</td><td>${recorderTag(x.recorder)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">暂无记录</div>`)
    + section('更多', '', moreMenu([['手工记一条耐受记录', 'form-tolerance', '']]))
    + `<p class="small-note">本页与「激素副作用分节」同源；分节分类不进滴度趋势（T5）。</p>`;
}

/* ---------------- 复发事件（T3 独立档案） ---------------- */
function eventCard(ev) {
  return `<div class="card"><h3><span class="num">${fmtDate(ev.d)}</span> ${recorderTag(ev.recorder)}</h3>
    <div class="kv" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">${(ev.organs || []).map((o) => pill(o, 'orange')).join('')} ${pill(ev.dept, 'blue')}</div>
    <p>${esc(ev.symptoms)}</p>
    ${quote(ev.confirm)}
    <p class="hint">医生结论原文：${esc(ev.quote || '—')}</p></div>`;
}
function pageRelapseEvents() {
  const evs = allEvents();
  return (evs.length ? `<div class="grid cols-2">${evs.slice().reverse().map(eventCard).join('')}</div>` : `<div class="empty">还没有事件记录</div>`)
    + section('更多', '', moreMenu([['手工记一次事件', 'form-event', '']]));
}
function pageRelapseOrgans() {
  const evs = allEvents();
  const counts = {};
  evs.forEach((e) => (e.organs || []).forEach((o) => { counts[o] = (counts[o] || 0) + 1; }));
  return (Object.keys(counts).length ? `<div class="section-cards">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([o, n]) =>
      `<div class="mini"><b>${esc(o)}</b><span class="cnt">${n}</span> 次<br><small>出自事件档案原文</small></div>`).join('')}</div>` : `<div class="empty">还没有事件记录</div>`)
    + `<p class="small-note">器官清单来自每次事件的"受累器官"字段（多选）。</p>`;
}
function pageRelapseEvidence() {
  const evs = allEvents();
  return (evs.length ? evs.map((e) => `<div class="card" style="margin-bottom:12px"><h3><span class="num">${fmtDate(e.d)}</span> ${esc(e.dept)}</h3>${quote(e.confirm)}<p class="small-note">记录人：${e.recorder === 'FAMILY' ? '家属代记' : '本人自记'}</p></div>`).join('') : `<div class="empty">还没有事件记录</div>`);
}
function pageRelapseReview() {
  const evs = allEvents();
  const marks = evs.map((e) => ({ d: e.d, text: `<b>事件</b>${esc((e.organs || []).join('·'))}：${esc(e.symptoms)}` }));
  const labMarks = ['MPO_ANCA', 'PR3_ANCA', 'CREATININE'].flatMap((k) => allLabs(k).slice(-4).map((x) => ({ d: x.d, text: `<b>${esc(MARKERS[k].name)}</b>${esc(String(x.v))} ${esc(x.unit)}` })));
  const all = marks.concat(labMarks).sort((a, b) => a.d < b.d ? -1 : 1);
  return (all.length ? `<ol class="tl">${all.map((x) => `<li><div class="what"><span class="when num">${fmtDate(x.d)}</span>${x.text}</div></li>`).join('')}</ol>` : `<div class="empty">暂无</div>`)
    + `<div class="notice plain" style="margin-top:12px">滴度回升 ≠ 复发预告：本台不建立两者之间的因果连线。</div>`;
}

/* ---------------- 激素副作用分节（T5） ---------------- */
function sidePage(key) {
  const label = SIDE_SECTIONS[key];
  const list = allSide(key);
  return (list.length ? list.map((x) => `<div class="card" style="margin-bottom:12px"><h3><span class="num">${fmtDate(x.d)}</span> ${esc(x.text)} ${recorderTag(x.recorder)} ${visTag(x.visibility)}</h3>${quote(x.quote, x.src)}</div>`).join('') : `<div class="empty">本节暂无记录</div>`)
    + section('更多', '', moreMenu([[`手工记一条${label}记录`, 'form-side', `data-section="${key}"`]]));
}

/* ---------------- 病理与影像（T1 只引原文） ---------------- */
const TERMS = {
  '新月体': '病理描述用词：指肾小球内某些细胞增生成月牙样结构的形态描述。具体含义与分级请主诊团队解释。',
  '寡免疫复合物': '病理描述用词：免疫荧光下沉积很少的一类表现，常在血管炎相关肾炎报告中出现。',
  '纤维素样坏死': '病理描述用词：血管壁的一种损伤形态描述。',
  '斑片影': '影像描述用词：片子上一片一片的影子，成因多样，需医生结合临床解释。'
};
function pagePathologyBiopsy() {
  const list = profile().pathology || [];
  const menu = section('更多', '', moreMenu([['存一份报告（手工）', 'form-doc', 'data-type="病理报告"']]));
  return (list.length ? list.map((x) => `<div class="card" style="margin-bottom:12px"><h3>${esc(x.type)} · <span class="num">${fmtDate(x.d)}</span></h3>${quote(x.quote, x.src)}<div style="margin-top:8px">${(x.terms || []).map((t) => pill(t, 'blue')).join(' ')}</div></div>`).join('') : `<div class="empty">本档案没有肾活检记录（如做过，可从「存一份报告」补录）</div>`)
    + menu
    + section('术语卡', '点开只解释词义，不解释"你的报告严不严重"')
    + Object.entries(TERMS).map(([t, d]) => `<details class="card" style="margin-bottom:8px"><summary><b>${esc(t)}</b></summary><p class="hint">${esc(d)}</p></details>`).join('');
}
function pagePathologyImaging() {
  const list = profile().imaging || [];
  return (list.length ? list.map((x) => `<div class="card" style="margin-bottom:12px"><h3>${esc(x.type)} · <span class="num">${fmtDate(x.d)}</span></h3>${quote(x.quote, x.src)}</div>`).join('') : `<div class="empty">暂无影像报告</div>`)
    + section('更多', '', moreMenu([['存一份报告（手工）', 'form-doc', 'data-type="影像报告"']]));
}
function pagePathologyReports() {
  const all = (profile().pathology || []).concat(profile().imaging || []);
  return (all.length ? all.map((x) => `<div class="card" style="margin-bottom:12px"><h3>${esc(x.type)} · <span class="num">${fmtDate(x.d)}</span></h3>${quote(x.quote, x.src)}</div>`).join('') : `<div class="empty">暂无</div>`);
}

/* ---------------- 随访日历（T7） ---------------- */
function pageCalendarRhythm() {
  const fs = profile().followups || [];
  const menu = section('更多', '', moreMenu([['手工登记随访安排', 'form-follow', '']]));
  return (fs.length ? `<div class="grid cols-2">${fs.map((f) => `<div class="card"><h3>${esc(f.dept)}</h3><p>${esc(f.text)}</p><p class="small-note">来源：${esc(f.source)}</p></div>`).join('')}</div>` : `<div class="empty">还没有登记随访节奏</div>`) + menu;
}
function pageCalendarUpcoming() {
  const ups = profile().upcoming || [];
  const menu = section('更多', '', moreMenu([['手工登记一次安排', 'form-follow', '']]));
  return (ups.length ? `<div class="table-wrap"><table><thead><tr><th>日期</th><th>科室</th><th>要查</th><th>要带</th></tr></thead><tbody>
      ${ups.map((u) => `<tr><td class="num"><b>${fmtDate(u.d)}</b></td><td>${esc(u.dept)}</td><td>${esc(u.items)}</td><td>${esc(u.bring)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">还没有安排</div>`) + menu;
}
function pageCalendarPlan() {
  const ups = profile().upcoming || [];
  return (ups.length ? `<ol class="tl">${ups[0].items.split('、').map((it) => `<li><div class="what"><b>${esc(it)}</b><span class="when"> · ${esc(ups[0].dept)} · ${fmtDate(ups[0].d)}</span></div></li>`).join('')}</ol>` : `<div class="empty">暂无</div>`);
}

/* ---------------- 复诊与资料 ---------------- */
function buildSummaryItems(days) {
  const p = profile();
  const from = isoShift(TODAY, -days);
  const items = [];
  Object.keys(MARKERS).forEach((k) => allLabs(k).forEach((x) => { if (x.d >= from) items.push(`${fmtDate(x.d)} ${MARKERS[k].name} ${x.v} ${x.unit}（${x.lab || ''}）`); }));
  allEvents().forEach((e) => { if (e.d >= from) items.push(`${fmtDate(e.d)} 事件：${(e.organs || []).join('·')} —— ${e.symptoms}`); });
  allTreatments().forEach((t) => { if (t.start >= from) items.push(`${fmtDate(t.start)} 用药变更：${t.drug}（${t.dose}）`); });
  (p.sideEffects ? Object.values(p.sideEffects).flat() : []).concat(added('sideEffects')).forEach((x) => { if (x.d >= from && x.visibility !== 'private') items.push(`${fmtDate(x.d)} 副作用/耐受：${x.text}`); });
  (p.notes || []).forEach((n) => { if (n.d >= from && n.visibility !== 'private') items.push(`${fmtDate(n.d)} 记录：${n.text}`); });
  return items;
}
function isoShift(d, n) { return new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10); }
function pageVisitSummary() {
  const p = profile();
  const items = buildSummaryItems(180);
  const saved = added('summaries');
  return `<div class="notice plain">汇总范围：最近 180 天 · 就诊科室：${esc(p.visit.nextDept || '—')} · ${fmtDate(p.visit.nextDate || '')}（private 已过滤）</div>`
    + (items.length ? `<div class="card">${items.map((t, i) => `<label class="check-row"><input type="checkbox" data-action="sum-sel" value="${i}"><span>${esc(t)}</span></label>`).join('')}</div>` : `<div class="empty">近 180 天没有可汇总的记录</div>`)
    + section('已生成的摘要', saved.length ? `${saved.length} 份` : '', moreMenu([['手工加一条问题', 'form-question', '']]))
    + (saved.length ? saved.map((s) => `<div class="card" style="margin-bottom:10px"><h3><span class="num">${fmtDate(s.d)}</span> ${pill(s.range, 'blue')}</h3><ol class="tl" style="margin-top:8px">${s.items.map((t) => `<li><div class="what">${esc(t)}</div></li>`).join('')}</ol></div>`).join('') : `<div class="empty">还没有生成过摘要</div>`);
}
function pageVisitQuestions() {
  const qs = questions();
  const menu = section('更多', '', moreMenu([['手工加一条问题', 'form-question', '']]));
  return (qs.length ? qs.map((q) => `<div class="card" style="margin-bottom:10px"><h3>${esc(q.text)} ${q.status === 'done' ? pill('已问', 'mist') : pill('待问', 'orange')}</h3>
      <div class="card-actions">${btn(q.status === 'done' ? '标回待问' : '标为已问', 'question-toggle', 'text-button', `data-qid="${q.id}"`)}</div></div>`).join('') : `<div class="empty">还没有问题；点「⋯ 更多」添加</div>`) + menu;
}
function trialThreeStates() {
  const snap = DATA.trialSnapshot;
  if (!snap) return `<div class="tri"><div class="tri-item unmatched"><b>未配置</b><p class="hint">试验库尚未接入（M4）。</p></div></div>`;
  const saved = added('savedTrials');
  return `<div class="notice plain">快照日期 <b class="num">${esc(snap.snapshotDate)}</b> · ${esc(snap.source)} · 快照会过期</div>
    <div class="tri">${snap.entries.map((t) => `<div class="tri-item match-${t.match}"><b>${esc(t.title)}</b>
      <div class="tri-meta">${pill(t.status, 'blue')}${pill(t.phase, 'mist')}<span>${esc(t.center)}</span></div>
      <p class="hint">${esc(t.hit)}</p>
      <div class="tri-meta"><span>来源通道：本地快照 · 终态：SUCCESS（演示）</span><span>登记状态，未核实</span></div>
      <div class="card-actions">${saved.includes(t.id) ? btn('取消收藏', 'trial-unsave', 'text-button', `data-tid="${t.id}"`) : btn('收藏线索', 'trial-save', 'text-button', `data-tid="${t.id}"`)}</div></div>`).join('')}
    ${snap.unmatched.map((u) => `<div class="tri-item unmatched"><b>无法自动匹配：${esc(u.item)}</b><p class="hint">${esc(u.reason)}</p></div>`).join('')}</div>
    <p class="small-note">已收藏 ${saved.length} 条（收藏/取消零副作用；不参与匹配计算）</p>
    <p class="small-note">${esc(snap.disclaimer)} 本台不产出数值匹配度。</p>`;
}
function exportMarkdown() {
  const p = profile();
  const L = [];
  L.push(`# ${p.name} · 病情摘要（导出于 ${TODAY}）`);
  L.push(`> 小脉宝 VasPal ${APP_INFO.version} · 只汇总事实，不做判断；private 条目已过滤。`);
  L.push(`\n## 最近化验`);
  Object.keys(MARKERS).forEach((k) => { const a = allLabs(k).slice(-3); a.forEach((x) => L.push(`- ${fmtDate(x.d)} ${MARKERS[k].name}：${x.v} ${x.unit}（${x.lab || ''}）`)); });
  L.push(`\n## 当前与近期用药`);
  allTreatments().slice(-4).forEach((t) => L.push(`- ${fmtDate(t.start)}${t.end ? '–' + fmtDate(t.end) : ''} ${t.drug}（${t.dose}；来源：${t.source || '—'}）`));
  L.push(`\n## 复发事件`);
  allEvents().forEach((e) => L.push(`- ${fmtDate(e.d)} ${(e.organs || []).join('·')}：${e.symptoms}（依据：${e.confirm}）`));
  L.push(`\n## 待问问题`);
  questions().forEach((q) => L.push(`- ${q.text}`));
  L.push(`\n## 下次复诊`);
  (p.upcoming || []).forEach((u) => L.push(`- ${fmtDate(u.d)} ${u.dept}：${u.items}；带：${u.bring}`));
  return L.join('\n');
}
function pageVisitReports() {
  const docs = allDocs().filter((d) => d.visibility !== 'private');
  return section('导出', 'private 默认不进导出', btn('生成导出快照', 'export', 'primary'))
    + section('资料清单', '原件在「病情整理 → 资料库」')
    + (docs.length ? `<div class="table-wrap"><table><thead><tr><th>名称</th><th>类型</th><th>日期</th></tr></thead><tbody>${docs.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.type)}</td><td class="num">${fmtDate(d.d)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">暂无</div>`)
    + section('临床研究（线索，非推荐）', '35 号三态：命中 / 无法自动匹配 / 不产出"不适用"')
    + trialThreeStates();
}

/* ---------------- 病情整理 ---------------- */
function pageRecordsLibrary() {
  const docs = allDocs();
  const menu = section('更多', '原件在本机资料目录；私密条目默认折叠', moreMenu([['存一份报告（手工）', 'form-doc', ''], ['查看候选核对', 'go', 'data-page="records" data-sub="drafts"']]));
  return (docs.length ? `<div class="table-wrap"><table><thead><tr><th>名称</th><th>类型</th><th>日期</th><th>可见性</th></tr></thead><tbody>
      ${docs.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.type)}</td><td class="num">${fmtDate(d.d)}</td><td>${visTag(d.visibility) || pill('常规', 'mist')}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">还没有资料；点「⋯ 更多 → 存一份报告」</div>`)
    + section('个人记录', '本人/家属的随手记；私密条目默认折叠，展开才显示')
    + (profile().notes || []).map((n) => n.visibility === 'private'
      ? `<details class="card" style="margin-bottom:10px"><summary><b>私密记录</b> · <span class="num">${fmtDate(n.d)}</span> ${recorderTag(n.recorder)} ${visTag(n.visibility)}</summary><p>${esc(n.text)}</p></details>`
      : `<div class="card" style="margin-bottom:10px"><h3><span class="num">${fmtDate(n.d)}</span> ${recorderTag(n.recorder)}</h3><p>${esc(n.text)}</p></div>`).join('')
    + menu;
}
/* 解析任务三态（18 号）：解析中 / 失败(如实错误码) / 成功(产出候选) */
function parseJobsBlock() {
  const jobs = (state.mem.parseJobs || []);
  if (!jobs.length) return '';
  return section('解析记录', '每次导入一行；失败如实记录，原件保留可重试')
    + `<div class="table-wrap"><table><thead><tr><th>文件</th><th>状态</th><th>错误码 / 说明</th><th>时间</th></tr></thead><tbody>
    ${jobs.slice().reverse().map((j) => `<tr>
      <td>${esc(j.filename || '—')}</td>
      <td>${j.status === 'parsed' ? pill('已解析', 'blue') : j.status === 'failed' ? pill('失败', 'warn') : j.status === 'unsupported' ? pill('不支持', 'mist') : pill('解析中', 'orange')}</td>
      <td>${esc(j.error_code || j.note || '—')}</td>
      <td class="num">${esc((j.at || '').slice(11, 19) || '—')}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function pageRecordsDrafts() {
  const cands = added('candidates');
  const list = cands.length
    ? cands.map((c) => `<div class="cand ${c.rejected ? 'rejected' : ''}" style="margin-bottom:10px"><div class="cand-head"><b>${esc(c.title)}</b>${c.rejected ? pill('已拒收', 'warn') : pill('待核对', 'orange')}</div><div class="kv">${c.rows.map((r) => `<span><b>${esc(r.f)}：</b>${esc(r.v)}</span>`).join('')}</div>
      ${c.rejected ? '' : `<div class="cand-actions">${btn('确认入库', 'draft-accept', 'primary', `data-cid="${c.id}"`)}${btn('拒收', 'draft-reject', '', `data-cid="${c.id}"`)}</div>`}</div>`).join('')
    : `<div class="empty">暂无待核对候选</div>`;
  return `<div class="card" style="margin-bottom:12px"><h3>导入一份报告</h3>
    <p class="hint">PDF / 图片走 MinerU 云端解析；CSV / TXT / MD 本地解析（不花额度）。原件永远保留，候选逐项核对后才入库。</p>
    <div class="card-actions">
      <label class="btn-like">${btn('选择文件导入', 'doc-upload', 'primary')}</label>
      ${btn('粘贴文本解析', 'form-paste', '')}
    </div>
    <p class="small-note">解析器状态：<span id="mineru-state">检查中…</span></p></div>`
    + list + parseJobsBlock();
}
function pageRecordsProfile() {
  const p = profile();
  const isNew = DATA.profiles.length === 0;
  const menu = section('更多', '', moreMenu([[isNew ? '建立档案（手工）' : '修改档案（手工）', 'form-profile', '']]));
  if (isNew) return `<div class="card empty-onboarding"><h2>建立病情档案</h2><p>称呼为必填；年龄、确诊日期、亚型、血清型和照护者称呼均可留空。</p><div class="card-actions">${btn('建立档案', 'form-profile', 'primary')}</div><p class="small-note">只保存在当前本机资料目录，不会自动上传或创建示例患者。</p></div>` + menu;
  return `<div class="grid cols-2"><div class="card"><h3>${esc(p.name)} ${pill((p.sex || '') + (p.age ? ' · ' + p.age + ' 岁' : ''), 'mist')}</h3>
      <p class="hint">${esc(p.meta || '本机档案')}</p><hr class="sep">
      <div class="cfg-row"><span class="k">亚型（原文）</span><span class="v">${esc(p.subtypeText || '未填写')}</span></div>
      <div class="cfg-row"><span class="k">血清型（原文）</span><span class="v">${esc(p.serologyText || '未填写')}</span></div>
      <div class="cfg-row"><span class="k">确诊时间</span><span class="v num">${esc(p.dxDate || '未填写')}</span></div>
      <div class="cfg-row"><span class="k">照护者</span><span class="v">${esc(p.caregiverLabel || '未填写')}</span></div></div>
      <div class="card"><h3>记录主体</h3><p class="hint">当前以「${state.actor === 'FAMILY' ? '家属代记（' + esc(p.caregiverLabel || '') + '）' : '本人自记'}」身份记录；代记条目保留记录人标识。</p>
      <div class="card-actions">${btn('切换为' + (state.actor === 'FAMILY' ? '本人' : '替家人记'), 'actor-toggle', '', '')}</div>
      <hr class="sep"><h3>私密分级</h3><p class="hint">默认可见性：${state.cfg.defaultVisibility === 'private' ? '私密' : '常规'}；private 三出口过滤（看板/一图秀/导出与 AI 上下文）。</p></div></div>` + menu;
}
function pageRecordsMetrics() {
  return `<div class="table-wrap"><table><thead><tr><th>指标</th><th>轨道</th><th>单位口径</th><th>进趋势</th></tr></thead><tbody>
    ${Object.entries(MARKERS).map(([k, m]) => `<tr><td>${esc(m.name)}</td><td>${esc(TRACKS[m.track])}</td><td>${esc(m.unitCtx)}</td><td>${allLabs(k).length ? pill('是（数值型）', 'blue') : pill('暂无数据', 'mist')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="notice plain" style="margin-top:12px">副作用分节（骨/糖代谢/感染/眼）与其他分类记录<b>不进趋势</b>（T5）；趋势白名单只放数值型化验。</div>`;
}
function pageRecordsSummary() {
  const p = profile();
  const labCount = Object.keys(MARKERS).reduce((n, k) => n + allLabs(k).length, 0);
  const stats = [
    ['化验记录', labCount], ['用药版本', allTreatments().length], ['复发事件', allEvents().length],
    ['副作用条目', Object.keys(SIDE_SECTIONS).reduce((n, k) => n + allSide(k).length, 0)],
    ['报告/影像', (p.pathology || []).length + (p.imaging || []).length], ['资料', allDocs().length],
    ['私密条目', privateNotes().length + allDocs().filter((d) => d.visibility === 'private').length], ['待问问题', questions().filter((q) => q.status !== 'done').length]
  ];
  return `<div class="section-cards">${stats.map(([k, n]) => `<div class="mini"><b>${esc(k)}</b><span class="cnt">${n}</span></div>`).join('')}</div>`;
}

/* ---------------- 病情一图秀 ---------------- */
function pageOneshowCurves() {
  const keys = Object.keys(MARKERS).filter((k) => allLabs(k).length);
  if (!state.chartSel) state.chartSel = profile().serologyText.includes('PR3') ? ['PR3_ANCA', 'CREATININE'] : ['MPO_ANCA', 'CREATININE'];
  return chartControls() + chartSVG(state.chartSel || []);
}
function pageOneshowEvents() {
  const evs = allEvents();
  const labs = ['MPO_ANCA', 'PR3_ANCA'].flatMap((k) => allLabs(k).map((x) => ({ ...x, k })));
  return `<ol class="tl">${evs.map((e) => `<li><div class="what"><span class="when num">${fmtDate(e.d)}</span><b>事件</b>${(e.organs || []).map((o) => pill(o, 'orange')).join(' ')}<p class="hint">${esc(e.symptoms)}</p></div></li>`).join('')}
      ${labs.map((x) => `<li><div class="what"><span class="when num">${fmtDate(x.d)}</span><b>${esc(MARKERS[x.k].name)}</b>${esc(String(x.v))} ${esc(x.unit)}</div></li>`).join('')}</ol>`;
}
function pageOneshowMeta() {
  return `<div class="notice plain"><b>口径</b>：所有数值照抄报告原文（含单位）；各序列在图中按自身范围归一化，仅看走势。PR3 与 MPO 分列；滴度与肾功/尿检分轨。private 条目不出现在本页与导出。</div>
    <div class="notice warn" style="margin-top:10px"><b>免责</b>：本台整理记录，不构成医疗意见；判读请以主诊团队为准。</div>`;
}

/* ---------------- 渲染分派 ---------------- */
const RENDERERS = {
  dashboard: () => pageDashboard(),
  titer: { trend: pageTiterTrend, renal: pageTiterRenal, labmeta: pageTiterLabmeta },
  treatment: { current: pageTreatmentCurrent, phases: pageTreatmentPhases, dosechain: pageTreatmentDosechain, tolerance: pageTreatmentTolerance },
  relapse: { events: pageRelapseEvents, organs: pageRelapseOrgans, evidence: pageRelapseEvidence, review: pageRelapseReview },
  sideeffect: { bone: () => sidePage('bone'), glucose: () => sidePage('glucose'), infection: () => sidePage('infection'), eye: () => sidePage('eye') },
  pathology: { biopsy: pagePathologyBiopsy, imaging: pagePathologyImaging, reports: pagePathologyReports },
  calendar: { rhythm: pageCalendarRhythm, upcoming: pageCalendarUpcoming, plan: pageCalendarPlan },
  visit: { summary: pageVisitSummary, questions: pageVisitQuestions, reports: pageVisitReports },
  records: { library: pageRecordsLibrary, drafts: pageRecordsDrafts, profile: pageRecordsProfile, metrics: pageRecordsMetrics, summary: pageRecordsSummary },
  oneshow: { curves: pageOneshowCurves, events: pageOneshowEvents, meta: pageOneshowMeta }
};
function subnav() {
  const subs = SUBPAGES[state.page];
  if (!subs) return '';
  const cur = state.sub[state.page];
  return `<nav class="subnav" aria-label="二级页签">${subs.map(([k, label]) =>
    `<button data-action="go" data-page="${state.page}" data-sub="${k}" aria-current="${cur === k ? 'true' : 'false'}">${esc(label)}</button>`).join('')}</nav>`;
}
const subLabel = (page) => (PAGES.find((p) => p[0] === page) || [])[1] || page;
function pageHeadFor(desc, action = '') {
  const title = subLabel(state.page);
  return head(title, desc, (action ? action + ' ' : '') + aiLink(SCENES.find((s) => s.view === state.page)?.id || 'S01')) + subnav();
}
function render() {
  const page = state.page;
  let html;
  if (page === 'dashboard') html = pageDashboard();
  else {
    const subs = RENDERERS[page];
    const fn = typeof subs === 'function' ? subs : (subs || {})[state.sub[page]] || Object.values(subs || {})[0];
    const desc = SUBDESC[`${page}/${state.sub[page]}`] || SUBTITLES[page] || '';
    html = backRow() + pageHeadFor(desc) + (fn ? fn() : `<div class="empty">本页签尚未实现</div>`);
  }
  const activeProfile = DATA.profiles[state.profileIdx];
  if (activeProfile?.isSyntheticExample || String(activeProfile?.name || '').includes('合成示例')) {
    html = `<div class="notice warn synthetic-banner" role="note"><b>合成示例资料</b>：当前虚拟档案及化验、用药、事件均为编写示例，不对应真实患者，不可作为诊疗依据。</div>` + html;
  }
  $('#main').innerHTML = html;
  if (state.page === 'records' && state.sub.records === 'drafts') setTimeout(refreshMineruState, 0);
  $('#breadcrumb').textContent = subLabel(page);
  $$('#nav .nav-button').forEach((b) => b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'));
  document.title = `${subLabel(page)} · ${APP_INFO.brand} · ANCA 工作台原型 ${APP_INFO.version}`;
}

/* ---------------- 设置（目录 / 主体 / 私密分级） ---------------- */
function openSettings(tab) {
  const p = profile();
  const body = `
    <div class="tabs">${['资料目录', '记录主体', '私密分级'].map((t, i) => `<button data-action="cfg-tab" data-tab="${i}" aria-selected="${(tab || 0) == i ? 'true' : 'false'}">${t}</button>`).join('')}</div>
    <div id="cfg-body"></div>`;
  openModal('设置', body, btn('关闭', 'close', ''));
  renderCfg(tab || 0);
}
function renderCfg(i) {
  const p = profile();
  const el = $('#cfg-body');
  if (i === 0) el.innerHTML = `
    <div class="cfg-row"><span class="k">资料目录</span><span class="v">${esc(state.cfg.root)}</span></div>
    <div class="cfg-row"><span class="k">状态</span><span class="v">${esc(state.cfg.storeState)}（演示固定值；真机以后端初始化结果为准）</span></div>
    <div class="cfg-row"><span class="k">切换</span><span class="v">原型内不提供切换；真机在设置中完成，取消不产生副作用</span></div>`;
  if (i === 1) el.innerHTML = `
    <div class="cfg-row"><span class="k">当前档案</span><span class="v">${esc(p.name)} · ${esc(p.meta)}</span></div>
    <div class="cfg-row"><span class="k">记录主体</span><span class="v">${state.actor === 'FAMILY' ? '家属代记（' + esc(p.caregiverLabel) + '）' : '本人自记'}</span></div>
    <div class="cfg-row"><span class="k">切换档案</span><span class="v">${DATA.profiles.map((x, idx) => btn(x.name, 'switch-profile', 'text-button', `data-idx="${idx}"`)).join(' · ')}</span></div>`;
  if (i === 2) el.innerHTML = `
    <div class="cfg-row"><span class="k">新记录默认可见性</span><span class="v">${state.cfg.defaultVisibility === 'private' ? '私密' : '常规'}</span></div>
    <div class="cfg-row"><span class="k">private 三出口</span><span class="v">看板/一图秀不显示 · 导出排除 · AI 上下文排除</span></div>
    <p class="small-note">原型内默认可见性在表单里逐条选择。</p>`;
}

/* ---------------- 导出（private 过滤） ---------------- */
function openExport() {
  const md = exportMarkdown();
  openModal('导出快照', `<div class="notice plain">private 条目已过滤；本快照只汇总事实。</div><pre class="prompt-text" style="white-space:pre-wrap">${esc(md)}</pre>`,
    btn('复制文本', 'copy-export', '') + btn('关闭', 'close', ''));
  state._export = md;
}

/* ---------------- 手工表单（「⋯ 更多」收敛口；每页显式编辑 ≤1；字段 ≤6；IP6/IP7） ---------------- */
const field = (label, inner, req, hint) => `<label class="${req ? 'req' : ''}"><span>${esc(label)}</span>${inner}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
function keypad(name, initial) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  return `<div class="keypad-view" id="kv-${name}" data-value="${esc(initial || '')}">${esc(initial || '0')}</div>
  <div class="keypad" role="group" aria-label="数字键盘">${keys.map((k) => `<button type="button" data-action="key" data-key="${k}" data-target="kv-${name}" ${k === '⌫' ? 'class="wide"' : ''}>${k === '⌫' ? '删除' : k}</button>`).join('')}</div>`;
}
function formDialog(title, body, commitAction) {
  openModal(title, `<div class="form-grid">${body}</div>`,
    btn('取消', 'close', '') + btn('保存', commitAction, 'primary'));
}

/* 上传/解析（18 号六部件之六：前端三态）。原型内只做演示；开发版注入真实上传。 */
let UPLOAD_DOC = null;   // 开发版注入：async (file, meta) => { status, job, candidates, skipped }
async function uploadDocument(file) {
  const p = profile();
  if (!state.mem.parseJobs) state.mem.parseJobs = [];
  const at = new Date().toISOString();
  if (typeof UPLOAD_DOC === 'function') {
    state.mem.parseJobs.push({ filename: file.name, status: 'parsing', at });
    render();
    try {
      const r = await UPLOAD_DOC(file, { profileId: p.id, recorder: state.actor });
      const last = state.mem.parseJobs[state.mem.parseJobs.length - 1];
      last.status = r?.job?.status || (r?.ok ? 'parsed' : 'failed');
      last.error_code = r?.job?.error_code || '';
      last.note = r?.note || '';
      for (const c of (r?.candidates || [])) added('candidates').push({ id: uid('cd'), key: c.kind, title: `解析候选 · ${file.name}`, rows: Object.entries(JSON.parse(c.payload)).filter(([k]) => !['profile_id','recorder','visibility','source_kind','source_doc_id'].includes(k)).map(([k,v]) => ({ f: k, v: String(v) })), remoteId: c.id, rejected: false });
      render();
      toast(last.status === 'parsed' ? `解析完成：${(r?.candidates || []).length} 条候选待核对` : `解析${last.status === 'failed' ? '失败' : '未完成'}：${last.error_code || '见解析记录'}`);
    } catch (e) {
      const last = state.mem.parseJobs[state.mem.parseJobs.length - 1];
      last.status = 'failed'; last.error_code = 'UPLOAD_FAILED'; last.note = String(e.message || e).slice(0, 80);
      render(); toast('上传失败：' + String(e.message || e).slice(0, 40));
    }
    return;
  }
  /* 原型演示态 */
  state.mem.parseJobs.push({ filename: file.name, status: 'failed', error_code: 'DEMO_ONLY', note: '原型不发起真实解析（开发版走 /parse/document）', at });
  render();
  toast('原型演示：不发起真实解析（开发版可用）');
}
async function refreshMineruState() {
  const el = document.getElementById('mineru-state');
  if (!el) return;
  if (typeof PERSIST !== 'function') { el.textContent = '原型演示（未接通解析服务）'; return; }
  try {
    const r = await fetch(apiBasePersist() + '/settings/mineru', { credentials: 'same-origin' });
    const d = await r.json();
    el.textContent = d.configured ? `已配置（${d.masked || ''}）· ${d.source}` : '未配置 Token：PDF/图片解析将如实失败，CSV/TXT 可本地解析';
  } catch { el.textContent = '解析服务不可达'; }
}
let PERSIST_BASE = null;
function apiBasePersist() {
  if (PERSIST_BASE !== null) return PERSIST_BASE;
  const m = location.pathname.match(/^(.*)\/ui(?:\/|$)/);
  PERSIST_BASE = m ? m[1] : '';
  return PERSIST_BASE;
}

/* ---------------- 事件处理 ---------------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (t) t.closest('details.more-menu')?.removeAttribute('open');
  if (!t) return;
  const a = t.dataset.action;
  const act = {
    'go': () => navigate(t.dataset.page, t.dataset.sub),
    'close': () => closeModal(),
    'flip': () => { const el = document.getElementById(t.dataset.target); if (el) el.classList.toggle('flipped'); },
    'agent-draft': (ev) => { ev.preventDefault(); handleAgentDraft(t.dataset.scene || 'S01'); },
    'scene': () => runScene(t.dataset.scene),
    'settings': () => openSettings(0),
    'cfg-tab': () => renderCfg(Number(t.dataset.tab)),
    'switch-profile': () => { state.profileIdx = Number(t.dataset.idx); state.chartSel = null; mem().questions = null; renderProfileChip(); render(); toast('已切换演示档案（数据独立）'); closeModal(); },
    'actor-toggle': () => { state.actor = state.actor === 'PATIENT' ? 'FAMILY' : 'PATIENT'; renderProfileChip(); render(); toast(state.actor === 'FAMILY' ? '已切换为「替家人记」：条目将标为家属代记' : '已切换回本人自记'); },
    'more-close': () => {},
    'chart-sel': () => { /* change 事件处理 */ },
    'chart-range': () => { state.chartRange = t.dataset.range; render(); },
    'primer-open': () => {
      /* primer.js 只监听 [data-primer-open] 的点击；此处直接走它暴露的 API，避免依赖属性绑定 */
      if (window.DiseasePrimer?.open) { window.DiseasePrimer.open(t); return; }
      toast('疾病概要模块未加载（primer.js）');
    },
    'cand-accept': () => { const row = t.closest('.cand'); row.classList.add('accepted'); row.classList.remove('rejected'); },
    'cand-reject': () => { const row = t.closest('.cand'); row.classList.add('rejected'); row.classList.remove('accepted'); toast('已拒收：未写入任何数据（零副作用）'); },
    'cand-all-reject': () => { closeModal(); toast('已全部拒收：未写入任何数据（零副作用）'); },
    'cand-commit': () => commitCandidates(),
    'draft-accept': () => { const c = added('candidates').find((x) => x.id === t.dataset.cid); if (c) { writeCandidate(c); toast('候选已核对入库（写入事实层）'); render(); } },
    'draft-reject': () => { const c = added('candidates').find((x) => x.id === t.dataset.cid); if (c) { c.rejected = true; render(); toast('已拒收：未写入任何数据'); } },
    'doc-upload': () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt,.md';
      inp.onchange = () => { const f = inp.files?.[0]; if (f) uploadDocument(f); };
      inp.click();
    },
    'form-paste': () => formPaste(),
    'form-lab': () => formLab(),
    'form-event': () => formEvent(),
    'form-treat': () => formTreat(),
    'form-side': () => formSide(t.dataset.section || 'bone'),
    'form-doc': () => formDoc(t.dataset.type || ''),
    'form-question': () => formQuestion(),
    'form-follow': () => formFollow(),
    'form-tolerance': () => formTolerance(),
    'form-profile': () => formProfile(),
    'key': () => keyPress(t),
    'trial-save': () => { const arr = added('savedTrials'); if (!arr.includes(t.dataset.tid)) arr.push(t.dataset.tid); render(); toast('已收藏线索（零副作用，可取消）'); },
    'trial-unsave': () => { const arr = added('savedTrials'); const i = arr.indexOf(t.dataset.tid); if (i >= 0) arr.splice(i, 1); render(); toast('已取消收藏'); },
    'question-toggle': () => { const q = questions().find((x) => x.id === t.dataset.qid); if (q) { q.status = q.status === 'done' ? 'open' : 'done'; render(); } },
    'sum-commit': () => commitSummary(),
    'export': () => openExport(),
    'copy-export': () => { try { navigator.clipboard.writeText(state._export || ''); toast('已复制（演示剪贴板）'); } catch { toast('复制失败，请手动选择文本'); } },
    'about': () => openModal('关于 '+APP_INFO.brand, '<p>交互原型 '+APP_INFO.version+'（'+APP_INFO.build+'）· '+APP_INFO.channelLabel+'</p><p>演示数据全部为虚构示例；不读写真实文件，不调用模型或宿主 API。</p><p>一级导航 10 线、二级 32 页与已签认交互路径文档逐字一致（IP3）；候选核对、版本链、private 三出口为合同行为。</p>', btn('关闭','close','primary')),
    'help': () => openModal('原型操作说明', `<p>本页为交互原型：数据为虚构示例，刷新即重置。</p><p>· 左侧为 10 条一级线；顶部面包屑与「小脉宝」一键回看板。</p><p>· 写操作默认走「AI 协助」候选演示，手工通道收在「⋯ 更多」。</p><p>· 顶部「替家人记」切换记录主体；「大字 Aa」切换大字。</p><p>· 红线：不生成判定、不建议调药；滴度与事件分轨展示。</p>`, btn('知道了', 'close', 'primary'))
  }[a];
  if (act) act(e);
});
document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-action="chart-sel"]');
  if (t) {
    const k = t.value;
    const set = new Set(state.chartSel || []);
    if (t.checked) {
      set.add(k);
    } else if (set.size > 1) {
      set.delete(k);
    } else {
      /* 下限分支必须"说 + 改回去 + 重渲染"：回滚勾选再提示，避免界面 N+1 而数据只有 N */
      t.checked = true;
      toast('至少保留一条序列（先勾上另一条再取消）');
      render();
      return;
    }
    state.chartSel = [...set];
    render();
  }
  const vis = e.target.closest('[data-role="visibility"]');
  if (vis) state._vis = vis.value;
});
function keyPress(t) {
  const view = document.getElementById(t.dataset.target);
  if (!view) return;
  let v = view.dataset.value || '';
  const k = t.dataset.key;
  if (k === '⌫') v = v.slice(0, -1);
  else if (k === '.' && v.includes('.')) { toast('小数点只能有一个'); return; }
  else v = (v === '0' && k !== '.') ? k : v + k;
  view.dataset.value = v;
  view.textContent = v || '0';
}
function runScene(id) {
  const s = SCENES.find((x) => x.id === id);
  if (!s) return;
  if (id === 'S07') { state.actor = state.actor === 'PATIENT' ? 'FAMILY' : 'PATIENT'; renderProfileChip(); render(); toast('已切换主体'); return; }
  navigate(s.view, s.sub);
  const gen = CAND_DEMOS[id];
  if (gen) openCandidateDemo(id);
  else if (id === 'S05') openSummaryCommit();
}
function renderProfileChip() {
  const p = profile();
  $('#profile-name').textContent = p.name ? `${p.name}的资料` : '尚未建立档案';
  $('#profile-meta').textContent = p.name ? `${p.age ? p.age + ' 岁 · ' : ''}${p.meta || '本机档案'}` : '先建立档案或导入资料';
  $('#profile-avatar').textContent = p.name ? p.name[0] : '＋';
  const chip = $('#actor-chip');
  if (chip) {
    chip.setAttribute('aria-pressed', String(state.actor === 'FAMILY'));
    chip.textContent = state.actor === 'FAMILY' ? '切回本人' : '替家人记';
  }
}
function writeCandidate(c) {
  if (c.key === 'labs') added('labs').push({ id: uid('l'), d: c.rows.find((r) => r.f === '日期')?.v || TODAY, v: Number(c.rows.find((r) => r.f === '数值')?.v || 0), unit: c.rows.find((r) => r.f === '单位')?.v || '', lab: c.rows.find((r) => r.f === '实验室')?.v || '', quote: c.rows.find((r) => r.f === '报告原句')?.v || '', marker: (Object.entries(MARKERS).find(([, m]) => (c.rows.find((r) => r.f === '指标')?.v || '').includes(m.name)) || [])[0] || 'MPO_ANCA', recorder: state.actor });
  if (c.key === 'events') added('events').push({ id: uid('re'), d: c.rows.find((r) => r.f === '日期')?.v || TODAY, organs: (c.rows.find((r) => r.f === '受累器官')?.v || '').split(/[,，、]/).filter(Boolean), symptoms: c.rows.find((r) => r.f === '症状')?.v || '', confirm: c.rows.find((r) => r.f === '确认依据原文')?.v || '', dept: c.rows.find((r) => r.f === '科室')?.v || '', recorder: state.actor });
  if (c.key === 'treatments') added('treatments').push({ id: uid('t'), drug: c.rows.find((r) => r.f === '药名')?.v || '', dose: c.rows.find((r) => r.f === '剂量原文')?.v || '', route: c.rows.find((r) => r.f === '途径')?.v || '口服', start: c.rows.find((r) => r.f === '开始日期')?.v || TODAY, end: '', reason: c.rows.find((r) => r.f === '变更原因原文')?.v || '', source: 'AI 候选核对入库（演示）', recorder: state.actor });
  if (c.key === 'sideEffects') added('sideEffects').push({ id: uid('s'), d: c.rows.find((r) => r.f === '日期')?.v || TODAY, text: c.rows.find((r) => r.f === '症状/事项')?.v || '', quote: c.rows.find((r) => r.f === '检查/所见原文')?.v || '', section: (c.rows.find((r) => r.f === '分节')?.v || '').includes('骨') ? 'bone' : 'other', recorder: state.actor });
  if (c.key === 'docs') added('docs').push({ id: uid('d'), name: c.rows.find((r) => r.f === '名称')?.v || '未命名报告', type: c.rows.find((r) => r.f === '类型')?.v || '检查报告', d: c.rows.find((r) => r.f === '日期')?.v || TODAY, visibility: state._vis || state.cfg.defaultVisibility });
}
function commitCandidates() {
  const { demo, rejected } = state._cand || {};
  if (!demo) return;
  const accepted = demo.rows.filter((_, i) => { const row = document.getElementById(`cand-${i}`); return row && !row.classList.contains('rejected'); });
  if (!accepted.length) { closeModal(); toast('全部拒收：未写入任何数据（零副作用）'); return; }
  added('candidates').push({ id: uid('cd'), key: demo.key, title: demo.title, rows: demo.rows.filter((r) => accepted.includes(r)), rejected: false });
  closeModal();
  toast('候选已进入「整理草稿与核对」，确认入库才写事实层', { cta: { text: '去核对', action: 'go' } });
  const c = added('candidates')[added('candidates').length - 1];
  document.querySelector(`#toast .toast-cta`)?.setAttribute('data-page', 'records');
  document.querySelector(`#toast .toast-cta`)?.setAttribute('data-sub', 'drafts');
  render();
}
function commitSummary() {
  const sel = $$('input[data-action="sum-sel"]:checked');
  if (!sel.length) { toast('先勾选要带的条目（勾选零副作用）'); return; }
  const items = buildSummaryItems(180).filter((_, i) => sel.some((s) => Number(s.value) === i));
  added('summaries').push({ id: uid('vs'), d: TODAY, range: '近 180 天', items });
  closeModal();
  toast('摘要已生成（只汇总事实）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } });
  navigate('visit', 'summary');
}
function openSummaryCommit() {
  const items = buildSummaryItems(180);
  if (!items.length) { toast('近 180 天没有可汇总的记录'); return; }
  openModal('生成复诊摘要（候选）', `<div class="notice plain">逐条勾选要带去复诊的内容；不生成结论。</div>` +
    items.map((t, i) => `<label class="check-row"><input type="checkbox" data-action="sum-sel" value="${i}"><span>${esc(t)}</span></label>`).join(''),
    btn('取消', 'close', '') + btn('生成摘要', 'sum-commit', 'primary'));
}

/* ---------------- 表单（≤6 字段；数字用键盘组件） ---------------- */
const MARKER_OPTS = Object.entries(MARKERS).map(([k, m]) => [k, m.name]);
function formPaste() {
  formDialog('粘贴文本解析', [
    field('文件类型', `<select id="f-fname"><option value="粘贴.txt">纯文本 .txt</option><option value="粘贴.md">Markdown .md</option><option value="粘贴.csv">CSV .csv</option></select>`, true, '文本类在本地解析，不花云端额度'),
    field('内容', `<textarea id="f-text" rows="8" placeholder="把化验单/报告里的表格或正文粘进来"></textarea>`, true),
  ], 'save-paste');
}
function savePaste() {
  const text = $('#f-text').value;
  if (!text.trim()) { toast('内容为空；未解析'); return; }
  const fname = $('#f-fname').value;
  closeModal();
  const file = new File([text], fname, { type: 'text/plain' });
  uploadDocument(file);
}
function formLab() {
  formDialog('手工补一条化验', [
    field('指标', `<select id="f-marker">${MARKER_OPTS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`, true),
    field('数值', keypad('lab', ''), true, '键盘输入；照抄报告原文'),
    field('单位', `<input id="f-unit" value="RU/mL">`, true),
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('实验室 / 方法', `<input id="f-lab" placeholder="如：某某市人民医院 · 化学发光法">`, false),
    field('报告原句', `<textarea id="f-quote" rows="2" placeholder="照抄化验单原文"></textarea>`, true)
  ], 'save-lab');
}
async function saveLab() {
  const marker = $('#f-marker').value, kv = $('#kv-lab');
  const v = Number(kv?.dataset.value || NaN);
  if (Number.isNaN(v)) { toast('数值还没输（键盘输入）；未保存'); return; }
  const dupDate = $('#f-date').value || TODAY;
  if (allLabs(marker).some((x) => x.d === dupDate)) { toast('该指标同日已有记录；如需更正请另记一条并注明原因（未保存本条）'); return; }
  if (!(await persist('lab', { profile_id: profile().id, marker, value: v, unit: $('#f-unit').value.trim() || '—', measured_at: dupDate, lab_name: $('#f-lab').value.trim() || null, report_quote: $('#f-quote').value.trim(), recorder: state.actor, visibility: 'normal', source_kind: 'manual' }))) return;
  added('labs').push({ id: uid('l'), marker, v, unit: $('#f-unit').value.trim() || '—', d: $('#f-date').value || TODAY, lab: $('#f-lab').value.trim(), quote: $('#f-quote').value.trim(), recorder: state.actor });
  closeModal(); toast('化验已记录（值+单位+日期+原句，无判定）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('titer', 'trend');
}
function formEvent() {
  formDialog('记一次事件', [
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('受累器官（可多选）', `<div style="display:flex;gap:10px;flex-wrap:wrap">${['肾脏', '耳鼻喉', '肺', '关节', '皮肤', '神经'].map((o) => `<label class="check-row" style="border:0;padding:2px 0"><input type="checkbox" class="f-organ" value="${o}">${o}</label>`).join('')}</div>`, true),
    field('当时症状', `<textarea id="f-sym" rows="2"></textarea>`, true),
    field('确认依据原文', `<textarea id="f-confirm" rows="2" placeholder="医生记录/检验/影像/病理的原句；还没有可留空"></textarea>`, false, '还没有依据时留空（显式 NULL），不写"疑似"'),
    field('就诊科室', `<input id="f-dept" placeholder="如：风湿科 / 肾内科">`, false)
  ], 'save-event');
}
async function saveEvent() {
  const organs = $$('.f-organ:checked').map((x) => x.value);
  if (!organs.length) { toast('至少选一个受累器官；未保存'); return; }
  if (!(await persist('relapse', { profile_id: profile().id, event_date: $('#f-date').value || TODAY, organs, symptoms_text: $('#f-sym').value.trim(), confirmation_text: $('#f-confirm').value.trim() || null, department: $('#f-dept').value.trim() || null, recorder: state.actor, visibility: 'normal', source_kind: 'manual' }))) return;
  added('events').push({ id: uid('re'), d: $('#f-date').value || TODAY, organs, symptoms: $('#f-sym').value.trim(), confirm: $('#f-confirm').value.trim(), dept: $('#f-dept').value.trim() || '—', recorder: state.actor });
  closeModal(); toast('事件已记录（依据原文，不判定是否复发）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('relapse', 'events');
}
function formTreat() {
  formDialog('记一次用药变更', [
    field('药名', `<input id="f-drug" list="drug-list" placeholder="如：吗替麦考酚酯胶囊"><datalist id="drug-list"><option>泼尼松片</option><option>甲泼尼龙</option><option>环磷酰胺</option><option>利妥昔单抗</option><option>吗替麦考酚酯胶囊</option><option>硫唑嘌呤片</option></datalist>`, true),
    field('剂量原文', `<textarea id="f-dose" rows="2" placeholder="照抄医嘱原文，如：0.5g 每日两次"></textarea>`, true),
    field('途径', `<select id="f-route"><option>口服</option><option>静脉</option><option>皮下</option><option>肌注</option></select>`, true),
    field('开始日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('变更原因原文', `<textarea id="f-reason" rows="2" placeholder="照抄医嘱/记录原文"></textarea>`, false),
    field('来源单据', `<input id="f-src" placeholder="如：风湿科门诊记录 2026-10-26">`, false)
  ], 'save-treat');
}
async function saveTreat() {
  if (!$('#f-drug').value.trim()) { toast('药名必填；未保存'); return; }
  if (!$('#f-date').value) { toast('开始日期必填（缺日期按"待补"处理：请补日期后再保存）；未保存'); return; }
  if (!(await persist('treatment', { profile_id: profile().id, drug: $('#f-drug').value.trim(), dose_text: $('#f-dose').value.trim(), route: $('#f-route').value, start_date: $('#f-date').value, change_reason_text: $('#f-reason').value.trim() || null, source_label: $('#f-src').value.trim() || null, recorder: state.actor, visibility: 'normal', source_kind: 'manual' }))) return;
  added('treatments').push({ id: uid('t'), drug: $('#f-drug').value.trim(), dose: $('#f-dose').value.trim(), route: $('#f-route').value, start: $('#f-date').value || TODAY, end: '', reason: $('#f-reason').value.trim(), source: $('#f-src').value.trim(), recorder: state.actor });
  closeModal(); toast('用药版本已新增（旧版本保留可查）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('treatment', 'dosechain');
}
function formSide(sectionKey) {
  formDialog(`记一条${SIDE_SECTIONS[sectionKey]}记录`, [
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('症状 / 事项', `<input id="f-text">`, true),
    field('检查 / 所见原文', `<textarea id="f-quote" rows="2" placeholder="报告或医嘱原句"></textarea>`, false),
    field('来源单据', `<input id="f-src">`, false),
    field('可见性', `<select id="f-vis" data-role="visibility"><option value="normal">常规</option><option value="private">私密</option></select>`, false)
  ], 'save-side');
  state._sideSection = sectionKey;
}
async function saveSide() {
  if (!$('#f-text').value.trim()) { toast('症状/事项必填；未保存'); return; }
  if (!(await persist('side-effect', { profile_id: profile().id, section: state._sideSection || 'bone', event_date: $('#f-date').value || TODAY, symptom_text: $('#f-text').value.trim(), report_quote: $('#f-quote').value.trim() || null, test_text: $('#f-src').value.trim() || null, recorder: state.actor, visibility: state._vis || 'normal', source_kind: 'manual' }))) return;
  added('sideEffects').push({ id: uid('s'), d: $('#f-date').value || TODAY, text: $('#f-text').value.trim(), quote: $('#f-quote').value.trim(), src: $('#f-src').value.trim(), section: state._sideSection || 'bone', recorder: state.actor, visibility: state._vis || 'normal' });
  state._vis = null;
  closeModal(); toast('副作用条目已记录（分节存放，不进趋势）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('sideeffect', state._sideSection || 'bone');
}
function formTolerance() {
  formDialog('记一条耐受记录', [
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('相关用药', `<input id="f-drug" placeholder="如：环磷酰胺">`, false),
    field('反应 / 所见原文', `<textarea id="f-quote" rows="2"></textarea>`, true),
    field('来源单据', `<input id="f-src">`, false)
  ], 'save-tolerance');
}
async function saveTolerance() {
  if (!$('#f-quote').value.trim()) { toast('原文必填；未保存'); return; }
  if (!(await persist('tolerance', { profile_id: profile().id, note_date: $('#f-date').value || TODAY, drug_hint: $('#f-drug').value.trim() || null, quote_text: $('#f-quote').value.trim(), recorder: state.actor, visibility: 'normal', source_kind: 'manual' }))) return;
  added('tolerance').push({ id: uid('to'), d: $('#f-date').value || TODAY, text: $('#f-drug').value.trim() || '用药期间', quote: $('#f-quote').value.trim(), src: $('#f-src').value.trim(), recorder: state.actor });
  closeModal(); toast('耐受记录已保存', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('treatment', 'tolerance');
}
function formDoc(type) {
  formDialog('存一份报告', [
    field('名称', `<input id="f-name" placeholder="如：眼科复查报告 2026-10-26">`, true),
    field('类型', `<select id="f-type"><option>检查报告</option><option>病理报告</option><option>影像报告</option><option>门诊记录</option><option>出院记录</option><option>个人材料</option></select>`, true),
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('原句摘录', `<textarea id="f-quote" rows="2" placeholder="报告里最重要的一句原文"></textarea>`, false),
    field('可见性', `<select id="f-vis" data-role="visibility"><option value="normal">常规</option><option value="private">私密</option></select>`, false)
  ], 'save-doc');
  if (type) setTimeout(() => { const s = $('#f-type'); if (s) [...s.options].forEach((o) => { if (o.text === type) s.value = o.value; }); }, 0);
}
async function saveDoc() {
  if (!$('#f-name').value.trim()) { toast('名称必填；未保存'); return; }
  if (!(await persist('document', { profile_id: profile().id, name: $('#f-name').value.trim(), doc_type: $('#f-type').value, doc_date: $('#f-date').value || TODAY, report_quote: $('#f-quote').value.trim() || null, recorder: state.actor, visibility: state._vis || 'normal' }))) return;
  added('docs').push({ id: uid('d'), name: $('#f-name').value.trim(), type: $('#f-type').value, d: $('#f-date').value || TODAY, quote: $('#f-quote').value.trim(), visibility: state._vis || 'normal' });
  state._vis = null;
  closeModal(); toast('资料已入库（原件在真机中保留在本机资料目录）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('records', 'library');
}
function formQuestion() {
  formDialog('加一条问题', [
    field('问题', `<textarea id="f-q" rows="2" placeholder="复诊时想问什么"></textarea>`, true)
  ], 'save-question');
}
async function saveQuestion() {
  if (!$('#f-q').value.trim()) { toast('问题必填；未保存'); return; }
  if (!(await persist('question', { profile_id: profile().id, text: $('#f-q').value.trim(), status: 'open', recorder: state.actor, visibility: 'normal' }))) return;
  questions().push({ id: uid('q'), text: $('#f-q').value.trim(), status: 'open' });
  closeModal(); toast('问题已加入清单', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('visit', 'questions');
}
function formFollow() {
  formDialog('登记随访安排', [
    field('科室', `<input id="f-dept" placeholder="如：风湿免疫科">`, true),
    field('日期', `<input id="f-date" type="date" value="${TODAY}">`, true),
    field('要查项目（顿号分隔）', `<textarea id="f-items" rows="2" placeholder="照抄医嘱原文"></textarea>`, true),
    field('要带材料', `<input id="f-bring">`, false),
    field('医嘱原文', `<textarea id="f-quote" rows="2" placeholder="节奏以医嘱原文为准"></textarea>`, false)
  ], 'save-follow');
}
async function saveFollow() {
  if (!$('#f-dept').value.trim()) { toast('科室必填；未保存'); return; }
  if (!(await persist('followup', { profile_id: profile().id, department: $('#f-dept').value.trim(), planned_date: $('#f-date').value || null, items_text: $('#f-items').value.trim() || null, bring_text: $('#f-bring').value.trim() || null, source_text: $('#f-quote').value.trim() || '本次登记（医嘱原文）', recorder: state.actor, visibility: 'normal' }))) return;
  const p = profile();
  p.upcoming = p.upcoming || [];
  p.upcoming.unshift({ id: uid('up'), d: $('#f-date').value || TODAY, dept: $('#f-dept').value.trim(), items: $('#f-items').value.trim(), bring: $('#f-bring').value.trim() });
  if ($('#f-quote').value.trim()) { p.followups = p.followups || []; p.followups.unshift({ id: uid('f'), dept: $('#f-dept').value.trim(), text: $('#f-quote').value.trim(), source: '本次登记（医嘱原文）' }); }
  closeModal(); toast('随访安排已登记（不推算"该查了"）', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } }); navigate('calendar', 'upcoming');
}
function formProfile() {
  const p = profile();
  const isNew = DATA.profiles.length === 0;
  formDialog(isNew ? '建立病情档案' : '修改病情档案', [
    field('称呼（例如昵称）', `<input id="f-name" value="${esc(p.name || '')}" placeholder="本人称呼或昵称">`, true),
    field('年龄（可留空）', keypad('age', p.age ? String(p.age) : ''), false),
    field('确诊日期（可留空）', `<input id="f-dx" type="date" value="${esc(p.dxDate || '')}">`, false),
    field('亚型（按报告原文，可留空）', `<input id="f-sub" value="${esc(p.subtypeText || '')}" placeholder="照抄报告/出院记录原文">`, false),
    field('血清型（按报告原文，可留空）', `<input id="f-sero" value="${esc(p.serologyText || '')}" placeholder="PR3-ANCA / MPO-ANCA（以原文为准）">`, false),
    field('照护者称呼（可留空）', `<input id="f-cg" value="${esc(p.caregiverLabel || '')}">`, false)
  ], 'save-profile');
}
async function saveProfile() {
  const isNew = DATA.profiles.length === 0;
  const p = profile();
  const name = $('#f-name').value.trim();
  if (!name) { toast('称呼必填；未保存'); return; }
  const age = Number($('#kv-age')?.dataset.value || p.age || 0) || null;
  const birthDate = age ? `${new Date().getFullYear() - age}-01-01` : null;
  const dxDate = $('#f-dx')?.value || p.dxDate || null;
  const payload = { id: p.id, name, birth_date: birthDate, gender: p.sex || null,
    subtype_text: $('#f-sub').value.trim() || null, serology_text: $('#f-sero').value.trim() || null,
    dx_date: dxDate, caregiver_label: $('#f-cg').value.trim() || null };
  if (!(await persist('profile', payload))) return;
  Object.assign(p, { name, age: age || '', birth_date: birthDate, dxDate,
    subtypeText: payload.subtype_text || '', serologyText: payload.serology_text || '',
    caregiverLabel: payload.caregiver_label || '', caregiver: payload.caregiver_label || '', meta: '本机档案' });
  for (const k of ['labs','treatmentVersions','relapseEvents','pathology','imaging','followups','upcoming','documents','notes','savedTrials']) if (!p[k]) p[k] = [];
  if (!p.sideEffects) p.sideEffects = {};
  if (!p.visit) p.visit = { nextDate: null, nextDept: '', questions: [], summaries: [] };
  if (isNew) DATA.profiles.push(p);
  state.profileIdx = Math.max(0, DATA.profiles.findIndex((x) => x.id === p.id));
  state.chartSel = null;
  renderProfileChip(); closeModal();
  toast(isNew ? '档案已在本机建立' : '档案已保存到本机', { cta: { text: '回到看板', action: 'go', page: 'dashboard' } });
  navigate('dashboard', '');
}
const SAVES = { 'save-paste': savePaste, 'save-lab': saveLab, 'save-event': saveEvent, 'save-treat': saveTreat, 'save-side': saveSide, 'save-tolerance': saveTolerance, 'save-doc': saveDoc, 'save-question': saveQuestion, 'save-follow': saveFollow, 'save-profile': saveProfile };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (t && SAVES[t.dataset.action]) SAVES[t.dataset.action]();
});

/* ---------------- 启动 ---------------- */
function buildNav() {
  $('#nav').innerHTML = PAGES.map(([key, label, ic]) =>
    `<button class="nav-button" data-action="go" data-page="${key}" ${key === 'dashboard' ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(label)}</span></button>`).join('');
}
function init() {
  buildNav();
  renderProfileChip();
  render();
  $('#font-toggle')?.addEventListener('click', () => {
    const b = $('#font-toggle');
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('large', on);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target?.classList?.contains('flip')) e.target.click();
  });
}
PERSIST = async (kind, payload) => {
  const res = await fetch(apiBase() + '/records/' + kind, {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); return { ok: false, error: e.message || e.error || ('HTTP ' + res.status) }; }
  const data = await res.json().catch(() => ({}));
  return { ok: true, row: data.row || null };
};
UPLOAD_DOC = async (file, meta) => {
  const buf = await file.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  const b64 = btoa(bin);
  const res = await fetch(apiBase() + '/parse/document', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ profileId: meta.profileId, filename: file.name, mime: file.type || '',
      contentBase64: b64, recorder: meta.recorder || 'PATIENT' }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, job: data.job || null, document: data.document || null,
    candidates: data.candidates || [], skipped: data.skipped || [], note: data.note || (data.error ? data.error + ': ' + (data.message||'') : '') };
};
(async function bootDev() {
  DATA_SOURCE = await loadBootstrap();
  if (DATA_SOURCE !== 'api') {
    const bar = document.querySelector('.prototype-bar span:first-child');
    if (bar) bar.innerHTML = DATA_SOURCE === 'empty'
      ? '<b>本机资料目录为空</b> · 界面显示空态（不拿演示档案填充）'
      : '<b>离线演示数据</b> · 未连上本机服务，以下内容不是你的资料';
  }
  init();
})();

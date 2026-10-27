#!/usr/bin/env node
/**
 * 生成 public/（开发版前端，四件套 + 36 号 primer 三件套）：从 prototypes/v0.2 产出。
 *
 * 对齐纪律：public 页面与原型逐字符对齐——style.css 与 demo-data.js 原样复制；
 * index.html 只改两处版本字符串（title / 顶部说明条）；app.js 只改"数据从哪来"
 * （先向 /api/anca-vasculitis/bootstrap 要真数据，拿不到才回退 window.DEMO_DATA），
 * 不改任何视图函数。原型与开发版必须是同一份渲染代码（parity 要求）。
 * primer.js / primer.css / primer-data.js 由 public/index.html 直接相对引用，必须原样随 public 发出。
 *
 * 用法：
 *   node scripts/build-public.mjs           写入
 *   node scripts/build-public.mjs --check   只校验，不同步退出码 1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'prototypes', 'v0.2')
const OUT = join(root, 'public')
const checkOnly = process.argv.includes('--check')

const read = (name) => readFileSync(join(SRC, name), 'utf8')

function fail(messages) {
  for (const m of messages) console.error(`✗ ${m}`)
  process.exit(1)
}

/* ---------------- index.html：只改版本字符串 ---------------- */

function patchIndex(html, version) {
  /* 原型标题里的版本号随原型改动而变，用正则匹配，不硬编码（否则升版后 build 把旧号带回来） */
  const titleRe = /<title>小脉宝 VasPal · ANCA 相关血管炎工作台原型 v[\d.]+<\/title>/
  const titleTo = `<title>小脉宝 VasPal · ANCA 相关血管炎工作台 v${version}</title>`
  const barRe = /<div class="prototype-bar"><span><b>交互原型 v[\d.]+<\/b> · 全部为模拟资料<\/span><span>仅本页演示 · 刷新重置 · 未接入 DSH \/ AI<\/span><\/div>/
  const barTo = `<div class="prototype-bar"><span><b>开发版 v${version}</b> · 演示资料直到连接本机资料目录</span><span>本机数据 · 只整理不判定 · 判读归风湿免疫及专科医生</span></div>`
  if (!titleRe.test(html)) fail('prototypes/v0.2/index.html 标题结构与预期不符（找不到 <title>…原型 vX.Y.Z</title>）')
  if (!barRe.test(html)) fail('prototypes/v0.2/index.html 顶部条结构与预期不符')
  return html.replace(titleRe, titleTo).replace(barRe, barTo)
}

/* ---------------- app.js：只改数据层 ---------------- */

/* 锚点取自本仓 prototypes/v0.2/app.js（第 163–176 行与末尾 init()）。
   改的是"数据从哪来"与启动顺序，**不改任何视图函数**（parity 要求）。 */
const DATA_FROM = `const DATA = typeof DEMO_DATA !== 'undefined' ? DEMO_DATA : { profiles: [], meta: {}, trialSnapshot: null };
const TODAY = DATA.meta?.today || '2026-10-26';`

const DATA_TO = [
  "/* 数据层（开发版）：先向 /api/anca-vasculitis/bootstrap 要真数据，拿不到才回退 window.DEMO_DATA。",
  "   原型与开发版是同一份渲染代码：这里只改\"数据从哪来\"，不改任何视图函数。",
  "   三态：api（本机库）/ demo（离线演示，横幅提醒）/ empty（库通了但为空，显示空态，",
  "   不拿演示档案把空工作区填满——否则用户会以为数据被写进来了）。 */",
  "let DATA = (typeof DEMO_DATA !== 'undefined') ? DEMO_DATA : { profiles: [], meta: {}, trialSnapshot: null };",
  "let TODAY = DATA.meta?.today || new Date().toISOString().slice(0, 10);",
  "let DATA_SOURCE = 'pending';",
  'function apiBase() {',
  "  const m = location.pathname.match(/^(.*)\\/ui(?:\\/|$)/);",
  "  return m ? m[1] : '';",
  '}',
  'async function loadBootstrap() {',
  "  const url = apiBase() + '/bootstrap';",
  '  try {',
  "    const res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });",
  "    if (!res.ok) return 'demo';",
  '    const data = await res.json();',
  '    if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {',
  '      DATA = { profiles: [], meta: data?.meta ?? {}, trialSnapshot: null };',
  '      TODAY = DATA.meta?.today || TODAY;',
  "      return 'empty';",
  '    }',
  '    DATA = data;',
  '    TODAY = DATA.meta?.today || TODAY;',
  "    return 'api';",
  "  } catch { return 'demo'; }",
  '}',
].join('\n')

/* 写入适配层：把 persist() 接到真实写端点（同源：手工与 AI 候选都写这里） */
const PERSIST_TO = `PERSIST = async (kind, payload) => {
  const res = await fetch(apiBase() + '/records/' + kind, {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); return { ok: false, error: e.message || e.error || ('HTTP ' + res.status) }; }
  const data = await res.json().catch(() => ({}));
  return { ok: true, row: data.row || null };
};`

/* 上传适配层：把 uploadDocument() 接到 /parse/document（File → base64 → POST） */
const UPLOAD_TO = `UPLOAD_DOC = async (file, meta) => {
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
};`

const BOOT_FROM = `init();`
const BOOT_TO = `(async function bootDev() {
  DATA_SOURCE = await loadBootstrap();
  if (DATA_SOURCE !== 'api') {
    const bar = document.querySelector('.prototype-bar span:first-child');
    if (bar) bar.innerHTML = DATA_SOURCE === 'empty'
      ? '<b>本机资料目录为空</b> · 界面显示空态（不拿演示档案填充）'
      : '<b>离线演示数据</b> · 未连上本机服务，以下内容不是你的资料';
  }
  init();
})();`

function patchApp(js) {
  for (const needle of [DATA_FROM, BOOT_FROM]) {
    if (!js.includes(needle)) fail(`prototypes/v0.2/app.js 结构变了，找不到锚点：${needle.slice(0, 60)}…`)
  }
  return js.replace(DATA_FROM, DATA_TO).replace(BOOT_FROM, PERSIST_TO + '\n' + UPLOAD_TO + '\n' + BOOT_TO)
}

/* ---------------- 产出 ---------------- */

const version = readFileSync(join(root, 'VERSION'), 'utf8').trim()
const outputs = {
  'style.css': read('style.css'),
  'demo-data.js': read('demo-data.js'),
  'index.html': patchIndex(read('index.html'), version),
  'app.js': patchApp(read('app.js')),
  /* 36 号疾病概要：index.html 以相对路径引用这三个文件，缺一个顶栏「?」就打不开浮窗 */
  'primer.css': read('primer.css'),
  'primer-data.js': read('primer-data.js'),
  'primer.js': read('primer.js'),
}

if (checkOnly) {
  const problems = []
  for (const [name, content] of Object.entries(outputs)) {
    const file = join(OUT, name)
    if (!existsSync(file)) problems.push(`缺 public/${name}`)
    else if (readFileSync(file, 'utf8') !== content) problems.push(`public/${name} 与原型（含开发版数据层补丁）不同步`)
  }
  if (problems.length) fail(problems)
  console.log('✓ public/ 四件套 + primer 三件套与原型同步（style/demo-data/primer 逐字符；index/app 仅版本与数据层补丁）')
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
for (const [name, content] of Object.entries(outputs)) writeFileSync(join(OUT, name), content, 'utf8')
console.log(`✓ 已生成 public/（v${version}）：四件套 style.css / demo-data.js / index.html / app.js + primer.css / primer-data.js / primer.js`)

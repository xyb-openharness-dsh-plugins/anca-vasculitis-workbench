## 0.2.9 — 2026-10-27

- 空资料库首次进入修复：bootstrap 返回零 profile 时，首页显示建档/导入空态，不再在看板读取缺失的 serologyText 后崩溃。
- 病情档案页支持新建 profile；称呼必填，年龄/确诊日期/亚型/血清型/照护者均可留空；保存后立刻进入正常看板。
- 全页面 synthetic-banner 根据 profile.name 标记「合成示例」；修复包已升级安装为 0.2.9。

# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.2.6 — 2026-10-27

- 修复 DSH Desktop 空白根因：`build-client.mjs` 从 `dsh/routes.js` 读取 `UI_PREFIX`，但 routes 未导出该常量，
  生成的 `lib/client.js` 中 `UI_ENTRY` 变成 `,/`，iframe 无效地址，HTML app.js 根本没显示。
- `dsh/routes.js` 导出 `UI_PREFIX = API_PREFIX + '/ui'`；`build-client.mjs` 加断言：UI_PREFIX 必须是合法 API UI 路径；
  `npm run check` 加 `build-client --check`；新增 3 个 client-entry 回归测试（prefix 唯一来源、iframe 入口、customFrame）。
- 此修复需要重新安装并重启 DSH Desktop 才会生效。

## 0.2.5 — 2026-10-27

- **V2 装机实测修缺陷**：`dsh/demo.js` 原先只读 `prototypes/v0.2/demo-data.js`，而 `prototypes/`
  不在发布包内 —— 装机后播种必然失败（"找不到演示数据"）。
  修法：构建时把演示数据落成 `demo/demo-data.json` 随包发出（`files` 增 `demo`），
  `demo.js` 优先读包内 JSON、开发态回落到原型源码。
- 打包与装机：`release/xyb-community-anca-vasculitis-workbench-0.2.5.tgz`，
  已装进 Desktop 活动 profile（`web`）并登记 `dsh.profile.bundles`。

## 0.2.4 — 2026-10-27

- **MinerU 六部件（18 号 v2）**：
  - `dsh/mineru.js`：API v4 四步协议 + 错误分类 + 模型回退判定（401 不换模型，只有"模型不支持"才回退）；
  - `dsh/settings.js`：Token 三态（env/文件/未配置）、掩码不泄露原文、原子写 600、清除只删 token 键；密钥落 `~/.vaspal/secrets/mineru.json`；
  - `dsh/ancaparse.js`：ANCA 专用抽取（8 个 marker，与 schema enum 一致）+ HTML/CSV 表格 → 管道 + 单位剥 LaTeX + 不等式留原文 + 参考区间放弃 + **短缩写词边界**（PROMO/CPR3 不误命中）；
  - `dsh/parse.js`：`parse_job` 三态（parsed/failed/unsupported）+ 候选落 `candidate` 表；原件永久保留可重试；失败不产候选；
  - 接口：`GET/POST /settings/mineru`（响应体永不回显 token）、`POST /parse/document`；
  - 界面：资料库「导入一份报告」（选文件 / 粘贴文本）+ 解析记录三态表 + 解析器状态行；
- 测试 **18 项**（抽取器 8 / 编排 5 / 设置 2 / 扩展名与字典一致性 3），全绿；
- 实测闭环：粘贴 CSV → 解析 2 条候选（CRP 参考区间自动跳过）→ 确认 1 条 → 化验 31→32 条，值正确；PDF 无 token 如实 FAILED(NO_TOKEN) 且原件入库。

## 0.2.3 — 2026-10-27

- **M5 开发版七步移植**：
  - 数据层：`dsh/demo.js`（98 条演示事实播种，幂等）、`dsh/readmodels.js`（bootstrap 形状与原型 DEMO_DATA 逐字段一致）；
  - 路由与服务：`dsh/routes.js` 接 `/bootstrap`（返回真数据）与 `/ui/` 静态；`dsh/server.js` 静态服务（路径穿越拦截 + SPA 回落）；
  - 客户端：`lib/layout.js`（customFrame / 0.65 / 会话 25–45%）、`src/client.js → lib/client.js`（构建注入）；
  - 构建：`scripts/build-public.mjs`（原型 → public，只改数据层与写入适配）、`scripts/build-client.mjs`；
  - 双通道持久化：原型新增 `persist()` 适配层，开发版注入服务端实现——手工表单与 AI 候选写同一事实层（IP9）；
  - 开发服务器：`scripts/serve-dev.mjs`（--seed 演示数据，浏览器直接验）；
- **G4 数据维护更新检查通过**（ACC-32/33/34）：12 类实体 × 手工/AI 双通道逐格实测、拒收零副作用、同源版本链、private 三出口；过程中抓到 `question.updated_at` 漏填并修（schema 已冻结，由 store 统一填审计列）；
- `npm run audit` **33/33 首次满分**；测试 39 个全绿。

## 0.2.2 — 2026-10-27

- 疾病概要浮窗排版对齐（36 号 §4.3，用户实指）：正文段 `max-width:68ch` 导致换行点与表格不一致。
  本仓 `primer.css` 同步 starter 参考件 1.9.0（正文去宽度上限、列表缩进移到 li、表格横向滚动、作用域选择器）；
  探针升到 P1–P9（新增 P9 三档排版断言）→ 本仓 10/10 通过。
- 同步：`scripts/probe-disease-primer.mjs` 与 starter 1.9.0 一致。

## 0.2.1 — 2026-10-27

- **36 号 v2 补齐（HTML demo 阶段）**：
  - primer 两件覆盖为 starter 最新版（支持指南可点链接 + `.dp-miss` 缺链断言）；
  - `primer-data.js` evidence 表逐行补 url/secondaryUrl，全部 curl 验证可达（gov.cn PDF、两条 DOI、两条 medsci 题录）；无编织 URL，未取得原件如实标二次来源；
  - 看板新增 §2.6 状态卡（四件结构，天数由确诊日派生，无锚点显示待初始化）；
  - 新增 `scripts/probe-disease-primer.mjs`（starter 探针纳入本仓）→ 本仓页面 9/9 通过。
- 修复：复诊摘要勾选行被全局 `input{width:100%}` 撑爆、主体切换 chip 换行。

## 0.2.0 — 2026-10-26

- 数据层写入面（用户指令「编辑↔schema↔AI 写入」）：
  - `schema/0001_initial.sql` 14 表初始迁移（G3 冻结候选，sha256 见 `schema/freeze-contract.md`）；
  - `dsh/write-schema.js`：12 种 kind → 表 → 列的写入契约面（列名与 schema 逐列一致）；
  - `dsh/store.js`：SQLite 主力（node:sqlite）+ JSON 文件存储回退（同一接口、同一更正链），
    capabilities 如实上报存储模式；
  - `dsh/routes.js` + `dsh/index.js`：`POST/GET /api/anca-vasculitis/records/:kind` 全族、
    `/records/:kind/:id/correct` 更正链、`POST/GET/DELETE /saved-trials`（35 号收藏/取消零副作用）、
    `GET /bootstrap`（capabilities = AI 经同一写接口入库的契约面）、`GET /health`（旧健康路径兼容保留）；
  - 新检查器 `scripts/check-write-schema.mjs`（写映射列名必须存在于冻结 schema + deny 列断言）
    与 `scripts/check-wording.mjs`（文案红线静态层），接入 `npm run check`；单测并入 check 链。
- 摄取管线（同日追加）：schema/0001 增 `parse_job`/`candidate` 两表；`POST /parse`
  （text/md/csv 内置轻解析产候选；PDF/图片如实 FAILED(PARSER_UNAVAILABLE)，M5 接 MinerU）+
  `/candidates` accept/reject（accept 走同一写接口入事实层，失败零副作用）；
  原型「病情一图秀」重做为小面板真实纵轴（修图表控件变形与归一化误导）。
- 0.1.0 — 2026-10-25：由社区脚手架 dsh-wb-cli@1.5.8 (c811e4f) 初始化，仅有注册骨架与健康接口，无业务功能。

# HTML 交互原型确认记录 · 小脉宝 VasPal · v0.2.0

状态：**G2 已签认（2026-10-26）**。用户原话：「确认通过」。签认版本 = 下表 hash 锁定的原型 v0.2.2。

- **HTML 实际路径**：`prototypes/v0.2/`（index.html / app.js / demo-data.js / style.css / primer.css / primer.js / primer-data.js）
- **版本**：原型 **v0.2.2**（build 2026-10-27）· **G2 签认锁定 SHA-256**：

  | 文件 | SHA-256 |
  | --- | --- |
  | index.html | `3cfdb097bd4cabbf4987b2169442a4fd9643582f821765bd598ff92e1a2a5c9b` |
  | app.js | `019dcc195224801a832c3c44e42ade9c6edbeee2851291b63357aeca7b0d0fd0` |
  | demo-data.js | `088f402da21735bbd08d18a6dd9106184d31519957f8dccbab25d57c91d585db` |
  | primer-data.js | `cdc0b81550642f72c6d9820e31d1775943dd28228e596f30cef57393fbd5c255` |
  | primer.js | `b1351514b01e380ff94339ab1b0cd144554e5b9f377dbccef0f5616cd66b72ea` |
  | primer.css | `7acac71973eac8c311e9b311b00de0ae9d40d2d1150f95b6ece8795b4a264deb` |
  | style.css | `e7a43866a57edaa5b0801cef31c8a9d1fbd7a34ea5546c459423f1f26321ac06` |
- **当前 SPEC/场景/数据模型版本**：SPEC M1 定稿（G1 已签认 2026-10-26）；SCENARIOS S01–S07；数据模型为 SPEC §五草案（schema 未冻结，G3 前）
- **预览环境**：本机任意浏览器直接打开 `prototypes/v0.2/index.html`（file:// 可用），或 `python3 -m http.server` 后访问；已实测 Chrome 1440px 与 1180/900/600/390 四档窄宽
- **模拟数据界限**：全部为编写示例（双档案：陈慧敏 MPA·MPO / 周立国 GPA·PR3）；不读写真实文件、不调用模型或宿主 API；试验线索为结构演示快照（登记状态，未核实）
- **覆盖**：10 条一级线 / 32 个二级页全部实现且被 S01–S07 路径覆盖（孤儿页=0，`scripts/probe-router.py` R3）；7 条场景路径的看板入口文案与 INTERACTION-DESIGN §二逐字一致（IP3，探针 R1/R3 + `test/path-walk.test.mjs`）
- **版本号三处**：顶栏 ver-chip / 页脚 / 关于弹窗 均为 v0.2.0；`VERSION` 仍为 0.1.0（包版本，M5 改包必升版时同步——35 号页面版本字面量闸门在 public/ 出现后生效，已在 DEV-PLAN 备案）
- **一图秀核对**：本原型 oneshow 三页为结构演示；`docs/ONE-CHART-SPEC.md` C1–C12 逐条核对在 G2 走查执行

| 模块/功能ID | 对应HTML/行为 | 实际走查证据 | 用户明确确认依据/人/日期 | 未确认项 | 允许实施的范围 |
| --- | --- | --- | --- | --- | --- |
| 10 线/32 页导航 | index.html + app.js PAGES/SUBPAGES/ROUTES | probe-router R1/R2 PASS；浏览器逐页点开无报错、无空态、无 undefined/NaN | **✅ 用户「确认通过」2026-10-26** | — | 签认后按本版本开发对应业务 |
| S01–S07 场景路径 | app.js SCENES + 看板卡入口 | 7 条入口逐字一致（IP3）；候选→核对→入库、拒收零副作用、双通道同源实测 PASS | **✅ 用户「确认通过」2026-10-26** | 真机 34 号发送链路（M5/V2） | 同上 |
| 疾病概要「?」（36 号 v2） | primer-data.js + primer.js + 看板状态卡 | 探针 P1–P9 全过（10/10）：四段齐全、指南表 5 行全部可点（19 链接 / 0 缺链）、排版三档对齐、状态卡四件齐 | **✅ 用户「确认通过」2026-10-26** | probe-disease-primer 走查 | 同上 |

**签认结论**：2026-10-26 用户原话「确认通过」，覆盖上述三个模块与本表 hash 锁定的 v0.2.2 原型。
确认范围 = 本版本 HTML 的模块清单；**此后新增/重大交互变更需重新展示并重新签认**。

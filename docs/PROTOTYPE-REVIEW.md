# HTML 交互原型确认记录 · 小脉宝 VasPal · v0.2.0

状态：**原型已制作并完成自测 + 独立评审，待用户 G2 签认**。未签认前不进入业务开发（22 号 G2 闸口）。

- **HTML 实际路径**：`prototypes/v0.2/`（index.html / app.js / demo-data.js / style.css / primer.css / primer.js / primer-data.js）
- **版本**：原型 v0.2.0（build 2026-10-26）；SHA-256（签认时以此为准）：
  - index.html `351348a8…39b9d9a` · app.js `0a1f585b…ce18d9` · demo-data.js `088f402d…585db` · style.css `8a059e14…88085` · primer-data.js `867a4e5f…917ee0` · primer.css `31796f1e…2ad90` · primer.js `7cdfc833…0904f3`
- **当前 SPEC/场景/数据模型版本**：SPEC M1 定稿（G1 已签认 2026-10-26）；SCENARIOS S01–S07；数据模型为 SPEC §五草案（schema 未冻结，G3 前）
- **预览环境**：本机任意浏览器直接打开 `prototypes/v0.2/index.html`（file:// 可用），或 `python3 -m http.server` 后访问；已实测 Chrome 1440px 与 1180/900/600/390 四档窄宽
- **模拟数据界限**：全部为编写示例（双档案：陈慧敏 MPA·MPO / 周立国 GPA·PR3）；不读写真实文件、不调用模型或宿主 API；试验线索为结构演示快照（登记状态，未核实）
- **覆盖**：10 条一级线 / 32 个二级页全部实现且被 S01–S07 路径覆盖（孤儿页=0，`scripts/probe-router.py` R3）；7 条场景路径的看板入口文案与 INTERACTION-DESIGN §二逐字一致（IP3，探针 R1/R3 + `test/path-walk.test.mjs`）
- **版本号三处**：顶栏 ver-chip / 页脚 / 关于弹窗 均为 v0.2.0；`VERSION` 仍为 0.1.0（包版本，M5 改包必升版时同步——35 号页面版本字面量闸门在 public/ 出现后生效，已在 DEV-PLAN 备案）
- **一图秀核对**：本原型 oneshow 三页为结构演示；`docs/ONE-CHART-SPEC.md` C1–C12 逐条核对在 G2 走查执行

| 模块/功能ID | 对应HTML/行为 | 实际走查证据 | 用户明确确认依据/人/日期 | 未确认项 | 允许实施的范围 |
| --- | --- | --- | --- | --- | --- |
| 10 线/32 页导航 | index.html + app.js PAGES/SUBPAGES/ROUTES | probe-router R1/R2 PASS；浏览器逐页点开无报错、无空态、无 undefined/NaN | 待 G2 | — | 签认后按本版本开发对应业务 |
| S01–S07 场景路径 | app.js SCENES + 看板卡入口 | 7 条入口逐字一致（IP3）；候选→核对→入库、拒收零副作用、双通道同源实测 PASS | 待 G2 | 真机 34 号发送链路（M5/V2） | 同上 |
| 疾病概要「?」 | primer-data.js + primer.js | 面板四段齐全（定义/指南/治疗全景/趋势），原件状态照实（已取得/未核实分列） | 待 G2 | probe-disease-primer 走查 | 同上 |

**签认方式**：确认本表版本 + hash + 预览后，在「用户明确确认依据」列填入确认人/日期/原话；确认范围 = 本版本 HTML 的模块清单，新增/重大交互变更重新展示。

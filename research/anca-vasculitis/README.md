# research/anca-vasculitis · ANCA 相关血管炎 2026 临床试验数据包

> 采集：unified-trial-mcp（MCP stdio 唯一入口）；脚本 `scripts/fetch-anca-trials-2026.mjs`（支持 --dry-run）。

## 首轮终态（快照 2026-10-27）

| 来源 | 终态 | 计覆盖 |
| --- | --- | --- |
| chinadrugtrials | DENIED | ❌ 不计 |
| xyb_chinadrugtrials_archive | NO_RESULTS | ❌ 不计 |
| chictr_online | FAILED | ❌ 不计 |
| chictr_pancreatic_archive | NEEDS_SETUP | ❌ 不计 |
| ctv | SUCCESS | ✅ 计入 |
| ictrp | FAILED | ❌ 不计 |

**纪律**：FAILED/DENIED/NEEDS_SETUP/NO_RESULTS 不算"已查过"、不计覆盖；登记状态一律"登记状态，未核实"。
**相关性过滤**：宽口径词（如 vasculitis）会带出非 AAV 条目，入库前按标题+URL 命中 AAV 词表；本轮丢弃 43 条非 AAV 记录（详见 manifest.relevance）。
manifest=jsonl=sqlite（实测 1=1=1）。

## 口径

- 关键词 14 组：中文标准名/常用写法 + 三型中文名 + 抗体宽口径 + 英文全称/三型 + 缩写 + 药物线（avacopan）。
- 合并规则：仅同一登记号合并来源，其余并排保留。
- 不产出任何数值匹配度；命中分层与三态（命中/无法自动匹配/不产出"不适用"）由读模型按 35 号执行。

## 文件

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 口径 + 终态 + 覆盖 + 文件指纹（sha256） |
| `trials-2026.jsonl` | 每条登记一行（recordId / 来源 / 登记号 / 日期 / 链接 / snapshotDate） |
| `anca_trials_2026.sqlite` | 同上入库 + `source_statuses`（逐查询逐来源终态与是否计覆盖） |

## 复跑

```bash
node scripts/fetch-anca-trials-2026.mjs --dry-run   # 先看来源终态
node scripts/fetch-anca-trials-2026.mjs             # 重采并更新四件套
```

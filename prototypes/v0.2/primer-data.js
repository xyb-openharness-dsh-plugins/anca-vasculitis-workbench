/* 小脉宝 VasPal · 疾病概要数据（36 号 v2 · 2026-10-27 补齐）
 * 口径：docs/DISEASE-PRIMER.md；规范：starter docs/36-DISEASE-PRIMER.md。
 * 全部内容属第 ② 层（解释）：只写定义、文件、指南列举过的手段、已发生的变化。
 * 任何「你该怎么办」的判断都不在这里，固定出口是「这一句需要问你的医生」。
 *
 * §2.5 硬约束（v2）：
 * - original:true 的行必须带 url（官方 PDF > DOI > PMC > 官网页），逐条点开验证可达：
 *     gov.cn 官方 PDF 200 / gov.cn 通知页 200（标题已核） / DOI 200（两条）
 * - original:false 的行必须带 secondaryUrl（权威二次来源，已验证 200）
 * - 找不到可达链接的行保留「未取得原件」并写 note，不编 URL
 * 原件状态照实写（2026-10-26 核验）：
 * - 《86 个罕见病病种诊疗指南（2025 年版）》已取得原文；ANCA 为第 7 病种、印刷页 33–39
 *   （此前写"#33"是把页码误当序号，已更正）。
 * - ACR/EULAR 2022 三套分类标准与 EULAR 2022 update：题录已核实（DOI 可达）。
 * - NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码仍未取得 → 标未核实。
 */
window.DISEASE_PRIMER = {
  brand: '小脉宝 VasPal',
  name: 'ANCA 相关血管炎',
  en: 'ANCA-associated vasculitis (AAV)',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: 'ANCA 相关血管炎（AAV）是一组以中小血管坏死性炎症为特征、多数患者血清中可检出'
        + '抗中性粒细胞胞质抗体（ANCA）的疾病统称，主要累及小血管，也可有中等动脉受累。'
        + '临床上分三型：肉芽肿性多血管炎（GPA）、显微镜下多血管炎（MPA）、嗜酸性肉芽肿性多血管炎（EGPA）。',
      points: [
        '两个维度要分开：临床亚型（GPA / MPA / EGPA）按临床与病理特征划分；ANCA 血清型（PR3-ANCA / MPO-ANCA）按抗体靶抗原划分。相关但不等价——同一亚型可出现不同血清型，血清型本身不能单独当作诊断结论。',
        '常见受累部位：上呼吸道与肺、肾脏（肾小球肾炎）、皮肤、周围神经；EGPA 的临床背景里通常还有哮喘与嗜酸性粒细胞增多。',
        '本台的记录口径：ANCA 滴度（PR3/MPO）按化验数值记录，只记数值、日期、单位与报告原句，不写「升高说明复发」这类解释；PR3 与 MPO 分列，滴度与肌酐/尿检分轨。',
        '复发事件按独立档案记录（日期、受累器官、确认依据原文）；是否复发、是否调药，由主诊团队判断。',
        '以上是病种的公共背景，不是对任何一份档案的判断；亚型、分期与活动性，均由风湿免疫科等专科判定。'
      ],
      sources: [
        {
          org: '国家卫生健康委办公厅',
          doc: '《86 个罕见病病种诊疗指南（2025 年版）》§7 ANCA 相关血管炎',
          version: '国卫办医政函〔2025〕252 号（2025-06-17 成文，2025-07-10 发布）',
          original: true,
          url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf',
          page: '印刷页 33–39'
        },
        {
          org: 'ACR/EULAR',
          doc: '2022 年 GPA / MPA / EGPA 三套分类标准（Ann Rheum Dis 2022;81(3)）',
          version: '2022',
          original: true,
          url: 'https://doi.org/10.1136/annrheumdis-2021-221795',
          page: '题录已核实；指南表 7-1/7-2/7-3 收录'
        }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '下面是本项目核对过的规范底本。「原件」一列可点开核对：官方 PDF、DOI 或权威二次来源。'
        + '「本台的用途」说明它在本台里扮演什么角色：只引病种名、版本号与页码，不复制条文。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          [
            '国家卫生健康委办公厅',
            { text: '《86 个罕见病病种诊疗指南（2025 年版）》§7 ANCA 相关血管炎', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf' },
            '2025 年版（国卫办医政函〔2025〕252 号）',
            { text: '已取得（官方 PDF）', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf' },
            '国内规范底本；只引病种名、版本号与页码，不复制条文'
          ],
          [
            '中华医学会风湿病学分会',
            { text: '《抗中性粒细胞胞质抗体相关血管炎诊疗规范》，中华内科杂志 2022;61(10):1128-1135', url: 'https://www.medsci.cn/guideline/show_article.do?id=0ca871c0021ea338' },
            '2022',
            { text: '二次来源（出版方站点反爬，DOI 间歇不可达）', url: 'https://www.medsci.cn/guideline/show_article.do?id=0ca871c0021ea338' },
            '国内成人 AAV 规范；只作术语与范围参照'
          ],
          [
            'ACR/EULAR',
            { text: '2022 AAV classification criteria（GPA / MPA / EGPA 三套）', url: 'https://doi.org/10.1136/annrheumdis-2021-221795' },
            '2022（ARD + Arthritis & Rheumatology 双版）',
            { text: '题录已核实（DOI）', url: 'https://doi.org/10.1136/annrheumdis-2021-221795' },
            '亚型与血清型命名的口径；指南表 7-1/7-2/7-3 收录'
          ],
          [
            'EULAR',
            { text: 'EULAR recommendations for the management of AAV: 2022 update，Ann Rheum Dis 2024;83(1):30-47', url: 'https://doi.org/10.1136/ard-2022-223764' },
            '2022 update（2024 年发表）',
            { text: '题录已核实（DOI）', url: 'https://doi.org/10.1136/ard-2022-223764' },
            '「诱导缓解 / 维持缓解」两段划分的参考；未逐条引用'
          ],
          [
            '中华医学会肾脏病学分会',
            { text: '《抗中性粒细胞胞质抗体相关肾炎诊断和治疗中国指南》', url: 'https://www.medsci.cn/guideline/show_article.do?id=0ca871c0021ea338' },
            '2021-07-03（卷期待核）',
            { text: '二次来源（原文未取得）', url: 'https://www.medsci.cn/guideline/show_article.do?id=0ca871c0021ea338' },
            '肾脏受累（AAGN）参照；不当作全身 AAV 总指南'
          ]
        ]
      },
      points: [
        '一台一表，不合并；两套体系（国内病种指南与 ACR/EULAR 分类标准）并存时两行并列，本表不做换算、不做合并命名。',
        '「二次来源」表示未取得原件、只核到权威转载或题录；没有看到原件，不假装看到了。',
        'NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码仍未取得，本表不列或标未核实。'
      ],
      sources: [
        {
          org: '国家卫生健康委办公厅',
          doc: '《86 个罕见病病种诊疗指南（2025 年版）》§7',
          version: '国卫办医政函〔2025〕252 号',
          original: true,
          url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf',
          page: '印刷页 33–39'
        },
        {
          org: '中华医学会风湿病学分会',
          doc: '《抗中性粒细胞胞质抗体相关血管炎诊疗规范》',
          version: '2022',
          original: false,
          secondaryUrl: 'https://www.medsci.cn/guideline/show_article.do?id=0ca871c0021ea338',
          page: '中华内科杂志 2022;61(10):1128-1135',
          note: '出版方站点反爬，DOI 间歇不可达；据权威题录库核对'
        }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '下面按「诱导缓解」与「维持缓解」两个阶段列出指南与规范里出现过的手段类别。这是「世界上大致有哪些办法」的地图，'
        + '不是给你排的先后顺序，也不含任何剂量、疗程与适用条件——那些必须由主诊团队按你的检查与病情决定。',
      groups: [
        {
          label: '诱导缓解期（疾病活动、有器官受累时）',
          points: [
            '糖皮质激素：指南把激素列为诱导方案的组成之一；本台按医嘱原文记录剂量与疗程，不改写、不提示调整。',
            '免疫抑制剂：环磷酰胺等传统细胞毒类药物被列为可选类别之一。',
            '生物制剂：以 B 细胞为靶点的单抗类被列为可选类别之一（国内获批适应证未核实，本台不写「已获批用于 AAV」）。',
            '血浆置换：在特定情形下被列出；适用情形由医生判断。',
            '支持处理：感染预防、骨保护、疫苗接种被单列为支持治疗内容，不属诱导本身。'
          ]
        },
        {
          label: '维持缓解期（诱导后达到缓解、需要长期控制时）',
          points: [
            '长期维持：小剂量糖皮质激素联合免疫抑制剂或生物制剂，作为维持阶段的类别；本台只记医嘱原文与起止日期，不提示自行停用。',
            '随访监测：ANCA 滴度、肌酐与尿检、血沉/CRP 的复查节奏由医生按病情安排。本台只记录数值与日期，不对「是否复发」下结论。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        {
          org: 'EULAR',
          doc: 'EULAR recommendations for the management of AAV: 2022 update，Ann Rheum Dis 2024;83(1):30-47',
          version: '2022 update',
          original: true,
          url: 'https://doi.org/10.1136/ard-2022-223764'
        },
        {
          org: '国家卫生健康委办公厅',
          doc: '《86 个罕见病病种诊疗指南（2025 年版）》§7',
          version: '2025 年版',
          original: true,
          url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf',
          page: '印刷页 37–38'
        }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '这一段只写已经发生的事：哪份文件换了版本、哪一天印发、上一版是哪一年。'
        + '不写预测，不做评价，也不给任何倾向。',
      points: [
        '2022 年：ACR/EULAR 同步发布 GPA、MPA、EGPA 三套分类标准（Ann Rheum Dis 2022;81(3) 与 Arthritis Rheumatol 2022;74(3) 双版；题录已核实）。',
        '2024 年：EULAR 发表 AAV 管理建议 2022 update（Ann Rheum Dis 2024;83(1):30-47）。',
        '2025 年：《86 个罕见病病种诊疗指南（2025 年版）》印发（国卫办医政函〔2025〕252 号，2025-06-17 成文 / 2025-07-10 发布），ANCA 相关血管炎为第 7 病种（印刷页 33–39）。',
        '国内监管：可核验线索仅有阿伐可泮（AAV）与美泊利珠单抗（EGPA）的二次来源批准报道；NMPA 原文未取得，本台不写成「已获批用于 AAV」。',
        '截至 2026-10-27：本台尚未对试验登记平台做 AAV 专项检索，登记数量与阶段分布未整理，不填数字。'
      ],
      sources: [
        {
          org: 'ACR/EULAR',
          doc: '2022 年三套分类标准',
          version: '2022',
          original: true,
          url: 'https://doi.org/10.1136/annrheumdis-2021-221795'
        },
        {
          org: 'EULAR',
          doc: 'AAV 管理建议 2022 update',
          version: '2022 update（2024 发表）',
          original: true,
          url: 'https://doi.org/10.1136/ard-2022-223764'
        },
        {
          org: '国家卫生健康委办公厅',
          doc: '《86 个罕见病病种诊疗指南（2025 年版）》§7',
          version: '2025 年版',
          original: true,
          url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf',
          page: '印刷页 33–39'
        }
      ]
    }
  ]
};

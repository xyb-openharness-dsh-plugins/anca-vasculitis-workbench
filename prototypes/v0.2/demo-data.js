'use strict';
/* 小脉宝 VasPal v0.2.0 — ANCA 相关血管炎（AAV）工作台交互原型 · 演示数据（唯一数据源）。
   全部为合成演示数据：人物、数值、报告原句均为编写示例，不对应任何真实患者。
   app.js 只消费本文件，不内置业务数据。

   口径说明（对应 DEV-REQUIREMENTS T1–T7 / SPEC §五）：
   T1 无判读列——每条化验/事件只有 值+单位+日期+报告原句，零 复发/缓解/控制 类判定字段；
   T2 PR3 与 MPO 分列（marker 不同语义不同）；滴度与肌酐/尿检分轨（不同 specimen 轨道）；
   T3 复发事件独立档案（relapse_event：日期/受累器官/确认依据原文/科室），不复用肿瘤 recurrence 命名；
   T4 免疫抑制方案版本链（treatment_versions：开始/结束/变更原因原文，旧版本不覆盖）；
   T5 激素副作用分节（bone/glucose/infection/eye/other），分类副作用不进滴度趋势；
   T6 双主体 recorder（PATIENT/FAMILY），私密条目 visibility='private'；
   T7 随访节奏只记医嘱原文，不推算"该查了"。
   本文件零判读词汇：不出现 复发风险/控制状态/缓解判定/剂量建议 类字样。
   试验线索为演示快照：登记状态，未核实；不含 match_score/eligible。 */

const DEMO_DATA = (() => {
  const DAY = 86400000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const shift = (d, n) => iso(Date.parse(d) + n * DAY);
  const TODAY = '2026-10-26';

  /* ---------- 档案一：陈慧敏（MPA · MPO-ANCA · 维持期） ---------- */
  const p1 = {
    id: 'P_CHEN', name: '陈慧敏', age: 58, sex: '女',
    subtypeText: '显微镜下多血管炎（MPA）——亚型以出院记录原文为准',   /* T1：原文，不判定 */
    serologyText: 'MPO-ANCA（靶抗原髓过氧化物酶）',
    dxDate: '2023-06', meta: '确诊 3 年余 · 维持期随访中',
    caregiverLabel: '女儿 陈晓', caregiver: '陈晓',
    labQuoteNote: '检测方法与单位随各院报告原文；本演示所有数值与原句均为编写示例。',
    /* 化验序列：marker 分列（T2）。滴度轨与肾功/尿检/炎症轨分列展示。 */
    labs: {
      MPO_ANCA: [
        { id: 'l1', d: '2023-06-10', v: 142.6, unit: 'RU/mL', lab: '某某大学附属第一医院 · 免疫印迹法', quote: 'MPO-ANCA 142.6 RU/mL（参考区间 0–20）', recorder: 'PATIENT' },
        { id: 'l2', d: '2023-09-05', v: 58.3, unit: 'RU/mL', lab: '某某大学附属第一医院', quote: 'MPO-ANCA 58.3 RU/mL', recorder: 'PATIENT' },
        { id: 'l3', d: '2024-03-18', v: 96.4, unit: 'RU/mL', lab: '某某大学附属第一医院', quote: 'MPO-ANCA 96.4 RU/mL', recorder: 'FAMILY' },
        { id: 'l4', d: '2024-09-12', v: 34.1, unit: 'RU/mL', lab: '某某大学附属第一医院', quote: 'MPO-ANCA 34.1 RU/mL', recorder: 'PATIENT' },
        { id: 'l5', d: '2025-04-02', v: 21.8, unit: 'RU/mL', lab: '某某市人民医院 · 化学发光法', quote: 'MPO-ANCA 21.8 RU/mL', recorder: 'PATIENT' },
        { id: 'l6', d: '2025-10-15', v: 18.2, unit: 'RU/mL', lab: '某某市人民医院', quote: 'MPO-ANCA 18.2 RU/mL', recorder: 'PATIENT' },
        { id: 'l7', d: '2026-04-20', v: 15.6, unit: 'RU/mL', lab: '某某市人民医院', quote: 'MPO-ANCA 15.6 RU/mL', recorder: 'PATIENT' },
        { id: 'l8', d: '2026-10-12', v: 13.9, unit: 'RU/mL', lab: '某某市人民医院', quote: 'MPO-ANCA 13.9 RU/mL', recorder: 'FAMILY' }
      ],
      CREATININE: [
        { id: 'c1', d: '2023-06-10', v: 286, unit: 'μmol/L', lab: '某某大学附属第一医院', quote: '血肌酐 286 μmol/L', recorder: 'PATIENT' },
        { id: 'c2', d: '2023-09-05', v: 132, unit: 'μmol/L', lab: '某某大学附属第一医院', quote: '血肌酐 132 μmol/L', recorder: 'PATIENT' },
        { id: 'c3', d: '2024-03-18', v: 171, unit: 'μmol/L', lab: '某某大学附属第一医院', quote: '血肌酐 171 μmol/L', recorder: 'FAMILY' },
        { id: 'c4', d: '2024-09-12', v: 118, unit: 'μmol/L', lab: '某某大学附属第一医院', quote: '血肌酐 118 μmol/L', recorder: 'PATIENT' },
        { id: 'c5', d: '2025-10-15', v: 96, unit: 'μmol/L', lab: '某某市人民医院', quote: '血肌酐 96 μmol/L', recorder: 'PATIENT' },
        { id: 'c6', d: '2026-10-12', v: 89, unit: 'μmol/L', lab: '某某市人民医院', quote: '血肌酐 89 μmol/L', recorder: 'FAMILY' }
      ],
      EGFR: [
        { id: 'g1', d: '2023-06-10', v: 17.2, unit: 'mL/min/1.73m²', lab: '某某大学附属第一医院', quote: 'eGFR 17.2 mL/min/1.73m²（CKD-EPI）', recorder: 'PATIENT' },
        { id: 'g2', d: '2024-03-18', v: 33.5, unit: 'mL/min/1.73m²', lab: '某某大学附属第一医院', quote: 'eGFR 33.5 mL/min/1.73m²', recorder: 'FAMILY' },
        { id: 'g3', d: '2025-10-15', v: 58.4, unit: 'mL/min/1.73m²', lab: '某某市人民医院', quote: 'eGFR 58.4 mL/min/1.73m²', recorder: 'PATIENT' },
        { id: 'g4', d: '2026-10-12', v: 63.1, unit: 'mL/min/1.73m²', lab: '某某市人民医院', quote: 'eGFR 63.1 mL/min/1.73m²', recorder: 'FAMILY' }
      ],
      URINE_PROTEIN: [
        { id: 'u1', d: '2023-06-10', v: 2.8, unit: 'g/24h', lab: '某某大学附属第一医院', quote: '24 小时尿蛋白定量 2.8 g', recorder: 'PATIENT' },
        { id: 'u2', d: '2024-03-18', v: 1.6, unit: 'g/24h', lab: '某某大学附属第一医院', quote: '24 小时尿蛋白定量 1.6 g', recorder: 'FAMILY' },
        { id: 'u3', d: '2025-10-15', v: 0.42, unit: 'g/24h', lab: '某某市人民医院', quote: '24 小时尿蛋白定量 0.42 g', recorder: 'PATIENT' },
        { id: 'u4', d: '2026-10-12', v: 0.31, unit: 'g/24h', lab: '某某市人民医院', quote: '24 小时尿蛋白定量 0.31 g', recorder: 'FAMILY' }
      ],
      URINE_RBC: [
        { id: 'r1', d: '2023-06-10', v: 180, unit: '个/μL', lab: '某某大学附属第一医院', quote: '尿红细胞 180 个/μL（机检）', recorder: 'PATIENT' },
        { id: 'r2', d: '2024-03-18', v: 96, unit: '个/μL', lab: '某某大学附属第一医院', quote: '尿红细胞 96 个/μL', recorder: 'FAMILY' },
        { id: 'r3', d: '2026-10-12', v: 8, unit: '个/μL', lab: '某某市人民医院', quote: '尿红细胞 8 个/μL', recorder: 'FAMILY' }
      ],
      ESR: [
        { id: 'e1', d: '2023-06-10', v: 76, unit: 'mm/h', lab: '某某大学附属第一医院', quote: '血沉 76 mm/h', recorder: 'PATIENT' },
        { id: 'e2', d: '2024-03-18', v: 52, unit: 'mm/h', lab: '某某大学附属第一医院', quote: '血沉 52 mm/h', recorder: 'FAMILY' },
        { id: 'e3', d: '2026-10-12', v: 14, unit: 'mm/h', lab: '某某市人民医院', quote: '血沉 14 mm/h', recorder: 'FAMILY' }
      ],
      CRP: [
        { id: 'p1', d: '2023-06-10', v: 58.7, unit: 'mg/L', lab: '某某大学附属第一医院', quote: 'C 反应蛋白 58.7 mg/L', recorder: 'PATIENT' },
        { id: 'p2', d: '2024-03-18', v: 31.2, unit: 'mg/L', lab: '某某大学附属第一医院', quote: 'C 反应蛋白 31.2 mg/L', recorder: 'FAMILY' },
        { id: 'p3', d: '2026-10-12', v: 3.8, unit: 'mg/L', lab: '某某市人民医院', quote: 'C 反应蛋白 3.8 mg/L', recorder: 'FAMILY' }
      ]
    },
    treatmentVersions: [
      { id: 't1', drug: '甲泼尼龙', dose: '静脉滴注（剂量见出院记录原文）', route: '静脉', start: '2023-06-11', end: '2023-06-24', reason: '出院记录：住院诱导治疗', source: '出院记录 2023-06-24', recorder: 'FAMILY' },
      { id: 't2', drug: '泼尼松片', dose: '口服（剂量随出院医嘱递减，原文见附件）', route: '口服', start: '2023-06-25', end: '2023-12-10', reason: '出院医嘱：出院后序贯口服', source: '出院记录 2023-06-24', recorder: 'PATIENT' },
      { id: 't3', drug: '环磷酰胺', dose: '静脉滴注，每月 1 次（共 6 次，剂量见记录原文）', route: '静脉', start: '2023-06-28', end: '2023-12-20', reason: '风湿科医嘱：诱导期联合方案', source: '风湿科门诊记录 2023-06-28', recorder: 'FAMILY' },
      { id: 't4', drug: '泼尼松片', dose: '口服（剂量见 2024-01 复诊医嘱原文）', route: '口服', start: '2024-01-05', end: '2025-08-30', reason: '复诊医嘱：序贯口服', source: '风湿科门诊记录 2024-01-05', recorder: 'PATIENT' },
      { id: 't5', drug: '吗替麦考酚酯胶囊', dose: '口服（剂量见 2024-01 复诊医嘱原文）', route: '口服', start: '2024-01-05', end: '', reason: '复诊医嘱：维持期方案', source: '风湿科门诊记录 2024-01-05', recorder: 'PATIENT' },
      { id: 't6', drug: '泼尼松片', dose: '口服（剂量见 2025-09 复诊医嘱原文）', route: '口服', start: '2025-09-06', end: '', reason: '复诊医嘱：继续低剂量口服', source: '风湿科门诊记录 2025-09-06', recorder: 'PATIENT' }
    ],
    relapseEvents: [
      { id: 're1', d: '2024-03-15', organs: ['肾脏', '全身'], symptoms: '尿色加深伴泡沫增多，复查尿蛋白较前升高', confirm: '风湿科门诊记录 2024-03-18：尿常规红细胞升高，24h 尿蛋白 1.6 g，血肌酐 171 μmol/L', dept: '风湿科 / 肾内科', recorder: 'FAMILY', quote: '"本次复查提示病情反复，调整方案，密切随访。"' }
    ],
    sideEffects: {
      bone: [
        { id: 'sb1', d: '2024-06-02', text: '腰椎骨密度检查', quote: '骨密度报告：腰椎 L1–L4 骨密度较同年龄段参考值降低', src: '骨密度报告 2024-06-02', recorder: 'PATIENT' },
        { id: 'sb2', d: '2025-06-20', text: '骨保护用药（医嘱原文）', quote: '医嘱：继续目前骨保护用药', src: '风湿科门诊记录 2025-06-20', recorder: 'PATIENT' }
      ],
      glucose: [
        { id: 'sg1', d: '2023-08-14', text: '空腹血糖偏高（检查所见）', quote: '化验单：空腹血糖 6.8 mmol/L', src: '化验单 2023-08-14', recorder: 'PATIENT' },
        { id: 'sg2', d: '2026-10-12', text: '空腹血糖', quote: '化验单：空腹血糖 5.4 mmol/L', src: '化验单 2026-10-12', recorder: 'FAMILY' }
      ],
      infection: [
        { id: 'si1', d: '2024-01-09', text: '带状疱疹（皮肤科诊断原文）', quote: '皮肤科诊断：带状疱疹（右胸背部）', src: '皮肤科门诊记录 2024-01-09', recorder: 'FAMILY' }
      ],
      eye: [
        { id: 'se1', d: '2025-03-11', text: '眼科复查', quote: '眼科报告：双眼初发轻度晶状体混浊，建议随访', src: '眼科报告 2025-03-11', recorder: 'PATIENT' }
      ],
      other: []
    },
    pathology: [
      { id: 'pa1', type: '肾活检', d: '2023-06-12', terms: ['新月体', '寡免疫复合物'], quote: '病理报告：肾穿刺组织见灶性节段性纤维素样坏死，部分肾小球见细胞性新月体形成，免疫荧光呈寡免疫复合物沉积。', src: '肾活检病理报告 2023-06-12' }
    ],
    imaging: [
      { id: 'im1', type: '胸部 CT', d: '2023-06-13', quote: '影像报告：双肺未见活动性病变，右肺中叶少许条索影。', src: '胸部 CT 报告 2023-06-13' }
    ],
    followups: [
      { id: 'f1', dept: '风湿免疫科', text: '每 3 个月复诊：血常规、肝肾功能、尿常规、炎症指标、ANCA 滴度', source: '风湿科门诊记录 2025-09-06' },
      { id: 'f2', dept: '肾内科', text: '每 6 个月复诊：肾功能、24h 尿蛋白', source: '肾内科门诊记录 2025-03-11' }
    ],
    upcoming: [
      { id: 'up1', d: '2026-11-06', dept: '风湿免疫科', items: '血常规、肝肾功能、尿常规、MPO-ANCA、血沉、CRP', bring: '出院记录、近半年化验单、当前用药盒' }
    ],
    documents: [
      { id: 'd1', name: '出院记录 2023-06-24', type: '出院记录', d: '2023-06-24', visibility: 'normal' },
      { id: 'd2', name: '肾活检病理报告 2023-06-12', type: '病理报告', d: '2023-06-12', visibility: 'normal' },
      { id: 'd3', name: '风湿科门诊记录 2025-09-06', type: '门诊记录', d: '2025-09-06', visibility: 'normal' },
      { id: 'd4', name: '医保报销材料 2024', type: '个人材料', d: '2024-12-30', visibility: 'private' },
      { id: 'd5', name: '眼科报告 2025-03-11', type: '检查报告', d: '2025-03-11', visibility: 'normal' }
    ],
    notes: [
      { id: 'n1', d: '2026-09-30', text: '最近爬三楼会喘，想下次问医生是不是和贫血有关', recorder: 'PATIENT', visibility: 'private' },
      { id: 'n2', d: '2026-10-12', text: '妈妈这周忘记吃过一次吗替麦考酚酯（晚上补记）', recorder: 'FAMILY', visibility: 'normal' }
    ],
    visit: {
      nextDate: '2026-11-06', nextDept: '风湿免疫科',
      questions: [
        { id: 'q1', text: '最近爬楼气短，要不要查血常规/贫血相关？', status: 'open' },
        { id: 'q2', text: '骨保护药和目前免疫抑制剂需要错开时间吃吗？', status: 'open' }
      ],
      summaries: []
    },
    savedTrials: []
  };

  /* ---------- 档案二：周立国（GPA · PR3-ANCA · 复发后恢复期） ---------- */
  const p2 = {
    id: 'P_ZHOU', name: '周立国', age: 63, sex: '男',
    subtypeText: '肉芽肿性多血管炎（GPA）——亚型以出院记录原文为准',
    serologyText: 'PR3-ANCA（靶抗原蛋白水解酶 3）',
    dxDate: '2021-11', meta: '确诊 4 年余 · 按出院记录规律随访',
    caregiverLabel: '妻子 刘秀兰', caregiver: '刘秀兰',
    labQuoteNote: '检测方法与单位随各院报告原文；本演示所有数值与原句均为编写示例。',
    labs: {
      PR3_ANCA: [
        { id: 'zl1', d: '2021-11-08', v: 208.4, unit: 'RU/mL', lab: '某某总医院 · 免疫印迹法', quote: 'PR3-ANCA 208.4 RU/mL', recorder: 'FAMILY' },
        { id: 'zl2', d: '2022-05-16', v: 44.7, unit: 'RU/mL', lab: '某某总医院', quote: 'PR3-ANCA 44.7 RU/mL', recorder: 'PATIENT' },
        { id: 'zl3', d: '2023-09-02', v: 87.5, unit: 'RU/mL', lab: '某某总医院', quote: 'PR3-ANCA 87.5 RU/mL', recorder: 'FAMILY' },
        { id: 'zl4', d: '2024-06-20', v: 26.3, unit: 'RU/mL', lab: '某某总医院', quote: 'PR3-ANCA 26.3 RU/mL', recorder: 'PATIENT' },
        { id: 'zl5', d: '2026-09-18', v: 19.5, unit: 'RU/mL', lab: '某某总医院', quote: 'PR3-ANCA 19.5 RU/mL', recorder: 'FAMILY' }
      ],
      CREATININE: [
        { id: 'zc1', d: '2021-11-08', v: 141, unit: 'μmol/L', lab: '某某总医院', quote: '血肌酐 141 μmol/L', recorder: 'FAMILY' },
        { id: 'zc2', d: '2023-09-02', v: 156, unit: 'μmol/L', lab: '某某总医院', quote: '血肌酐 156 μmol/L', recorder: 'FAMILY' },
        { id: 'zc3', d: '2026-09-18', v: 102, unit: 'μmol/L', lab: '某某总医院', quote: '血肌酐 102 μmol/L', recorder: 'PATIENT' }
      ],
      EGFR: [
        { id: 'zg1', d: '2023-09-02', v: 42.6, unit: 'mL/min/1.73m²', lab: '某某总医院', quote: 'eGFR 42.6 mL/min/1.73m²', recorder: 'FAMILY' },
        { id: 'zg2', d: '2026-09-18', v: 61.8, unit: 'mL/min/1.73m²', lab: '某某总医院', quote: 'eGFR 61.8 mL/min/1.73m²', recorder: 'PATIENT' }
      ],
      URINE_PROTEIN: [
        { id: 'zu1', d: '2023-09-02', v: 0.88, unit: 'g/24h', lab: '某某总医院', quote: '24 小时尿蛋白定量 0.88 g', recorder: 'FAMILY' },
        { id: 'zu2', d: '2026-09-18', v: 0.22, unit: 'g/24h', lab: '某某总医院', quote: '24 小时尿蛋白定量 0.22 g', recorder: 'PATIENT' }
      ],
      URINE_RBC: [
        { id: 'zr1', d: '2023-09-02', v: 62, unit: '个/μL', lab: '某某总医院', quote: '尿红细胞 62 个/μL', recorder: 'FAMILY' },
        { id: 'zr2', d: '2026-09-18', v: 5, unit: '个/μL', lab: '某某总医院', quote: '尿红细胞 5 个/μL', recorder: 'PATIENT' }
      ],
      ESR: [
        { id: 'ze1', d: '2023-09-02', v: 64, unit: 'mm/h', lab: '某某总医院', quote: '血沉 64 mm/h', recorder: 'FAMILY' },
        { id: 'ze2', d: '2026-09-18', v: 12, unit: 'mm/h', lab: '某某总医院', quote: '血沉 12 mm/h', recorder: 'PATIENT' }
      ],
      CRP: [
        { id: 'zp1', d: '2023-09-02', v: 47.5, unit: 'mg/L', lab: '某某总医院', quote: 'C 反应蛋白 47.5 mg/L', recorder: 'FAMILY' },
        { id: 'zp2', d: '2026-09-18', v: 4.2, unit: 'mg/L', lab: '某某总医院', quote: 'C 反应蛋白 4.2 mg/L', recorder: 'PATIENT' }
      ]
    },
    treatmentVersions: [
      { id: 'zt1', drug: '利妥昔单抗', dose: '静脉滴注（方案与剂量见出院记录原文）', route: '静脉', start: '2021-11-15', end: '2022-04-20', reason: '出院记录：诱导治疗', source: '出院记录 2022-04-20', recorder: 'FAMILY' },
      { id: 'zt2', drug: '泼尼松片', dose: '口服（剂量随医嘱递减，原文见附件）', route: '口服', start: '2021-11-15', end: '2023-08-25', reason: '出院医嘱：序贯口服', source: '出院记录 2022-04-20', recorder: 'PATIENT' },
      { id: 'zt3', drug: '利妥昔单抗', dose: '静脉滴注（复发后方案，原文见记录）', route: '静脉', start: '2023-09-08', end: '2024-05-30', reason: '门诊记录：复发后调整方案', source: '风湿科门诊记录 2023-09-08', recorder: 'FAMILY' },
      { id: 'zt4', drug: '吗替麦考酚酯胶囊', dose: '口服（剂量见 2024-06 复诊医嘱原文）', route: '口服', start: '2024-06-14', end: '', reason: '复诊医嘱：维持期方案', source: '风湿科门诊记录 2024-06-14', recorder: 'PATIENT' }
    ],
    relapseEvents: [
      { id: 'zre1', d: '2023-08-28', organs: ['耳鼻喉', '肺'], symptoms: '鼻塞脓涕加重伴听力下降，随后咳嗽、痰中带血', confirm: '住院记录 2023-09-06：鼻窦 CT 提示鼻窦炎伴骨质改变；痰中带血；PR3-ANCA 87.5 RU/mL', dept: '耳鼻喉科 / 呼吸科 / 风湿科', recorder: 'FAMILY', quote: '"结合各项检查考虑病情反复，调整治疗方案。"' },
      { id: 'zre2', d: '2025-07-11', organs: ['关节', '全身'], symptoms: '多关节酸痛伴晨僵，低热一周', confirm: '风湿科门诊记录 2025-07-14：血沉 46 mm/h（当次），CRP 升高', dept: '风湿科', recorder: 'PATIENT', quote: '"医生说先复查炎症指标，两周后再看。"' }
    ],
    sideEffects: {
      bone: [
        { id: 'zb1', d: '2024-11-03', text: '骨密度检查', quote: '骨密度报告：股骨颈骨密度处于低值范围，建议随访', src: '骨密度报告 2024-11-03', recorder: 'PATIENT' }
      ],
      glucose: [],
      infection: [
        { id: 'zi1', d: '2023-11-20', text: '肺炎（住院记录原文）', quote: '住院记录：住院期间合并肺部感染，予抗感染治疗后好转', src: '住院记录 2023-11-20', recorder: 'FAMILY' }
      ],
      eye: [],
      other: [
        { id: 'zo1', d: '2024-02-15', text: '体重变化记录', quote: '自记：半年内体重增加约 4 kg', src: '自记 2024-02-15', recorder: 'PATIENT' }
      ]
    },
    pathology: [],
    imaging: [
      { id: 'zim1', type: '鼻窦 CT', d: '2023-09-03', quote: '影像报告：双侧上颌窦、筛窦炎伴局部骨质改变。', src: '鼻窦 CT 报告 2023-09-03' },
      { id: 'zim2', type: '胸部 CT', d: '2023-09-04', quote: '影像报告：双肺多发斑片影，较前片部分为新出现。', src: '胸部 CT 报告 2023-09-04' }
    ],
    followups: [
      { id: 'zf1', dept: '风湿免疫科', text: '每 3 个月复诊：血常规、肝肾功能、尿常规、炎症指标、ANCA 滴度', source: '风湿科门诊记录 2026-09-18' },
      { id: 'zf2', dept: '耳鼻喉科', text: '症状变化时随诊；每年一次鼻窦评估', source: '耳鼻喉科门诊记录 2024-06-20' }
    ],
    upcoming: [
      { id: 'zup1', d: '2026-12-18', dept: '风湿免疫科', items: '血常规、肝肾功能、尿常规、PR3-ANCA、血沉、CRP', bring: '出院记录、门诊记录、用药清单' }
    ],
    documents: [
      { id: 'zd1', name: '出院记录 2022-04-20', type: '出院记录', d: '2022-04-20', visibility: 'normal' },
      { id: 'zd2', name: '住院记录 2023-09-06', type: '住院记录', d: '2023-09-06', visibility: 'normal' },
      { id: 'zd3', name: '风湿科门诊记录 2026-09-18', type: '门诊记录', d: '2026-09-18', visibility: 'normal' },
      { id: 'zd4', name: '单位病假与诊断证明 2023', type: '个人材料', d: '2023-10-12', visibility: 'private' }
    ],
    notes: [
      { id: 'zn1', d: '2026-09-18', text: '这次复查指标比上次平稳，把下次要问的问题先记下来', recorder: 'PATIENT', visibility: 'normal' }
    ],
    visit: {
      nextDate: '2026-12-18', nextDept: '风湿免疫科',
      questions: [
        { id: 'zq1', text: '维持方案还要持续多久，复查频率会不会调整？（以医生答复为准，仅记录）', status: 'open' }
      ],
      summaries: []
    },
    savedTrials: []
  };

  /* ---------- 试验快照（35 号：登记状态，未核实；演示结构，非推荐） ---------- */
  const trialSnapshot = {
    snapshotDate: '2026-10-01',
    source: '演示快照（结构示例）· 正式数据由 M4 临床库接入',
    entries: [
      { id: 'tr1', title: '一项在 ANCA 相关血管炎受试者中评估维持治疗策略的观察性登记研究', status: '招募中', phase: '观察性', center: '多中心（含国内中心，名录未核实）', match: 'text', hit: '命中词：ANCA 相关血管炎（登记文本）；MPO-ANCA（本地已建档）' },
      { id: 'tr2', title: '评估新型补体通路抑制剂在活动期 AAV 中的国际多中心研究', status: '活跃，未招募', phase: 'III 期', center: '国际多中心', match: 'broad', hit: '宽口径命中：罕见病（登记文本）' }
    ],
    unmatched: [
      { item: '受累器官量化评分', reason: '本地未建档对应结构化字段' },
      { item: '既往环磷酰胺累积剂量', reason: '本地剂量为医嘱原文文本，未结构化' }
    ],
    disclaimer: '登记状态 ≠ 有效 ≠ 可入组；是否适合由医生与研究中心判定。'
  };

  return {
    meta: { today: TODAY, version: '0.2.0', synthetic: '全部为模拟资料 · 人物与数值均为编写示例' },
    trialSnapshot,
    profiles: [p1, p2]
  };
})();

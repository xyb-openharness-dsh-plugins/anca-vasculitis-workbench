#!/usr/bin/env python3
"""路由与交互路径合同探针（ANCA 仓，静态分析 · 无浏览器依赖）。

对 prototypes/v0.2/app.js 断言四件事（判据见 docs/28-INTERACTION-PATH-DESIGN.md 与
docs/INTERACTION-DESIGN.md §十）：
  R1 ROUTES 完整：var ROUTES 与 PAGES 一级 key 一致（10 线，IP3）；
  R2 清单一致：ROUTE_MANIFEST 与 SUBPAGES 的 (view,sub) 全集一致（32 页）；
  R3 场景覆盖（X1）：SCENES 的 covers 并集 == ROUTE_MANIFEST，孤儿页 = 0；
  R4 红线静态扫描（T1/IP8）：全文件零「不可恢复」，零判读词（复发风险/控制良好/
     建议调整/可以停药/缓解判定/match_score/eligible 列名）；「无法自动匹配」为 35 号
     合同词，不算判读。
退出码：0 通过 / 1 有失败。--self-test 注入一处破坏，必须报 FAIL。

用法：python3 scripts/probe-router.py [--self-test]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 合同路由（G1 签认的 10 条一级线，docs/INTERACTION-DESIGN.md §五；漏条即 FAIL）
EXPECTED_ROUTES = ['dashboard', 'titer', 'treatment', 'relapse', 'sideeffect', 'pathology', 'calendar', 'visit', 'records', 'oneshow']
APP = ROOT / 'prototypes/v0.2' / 'app.js'

BAD_WORDS = ['不可恢复', '复发风险', '控制良好', '建议调整', '可以停药', '缓解判定', 'match_score', 'eligible', 'suitability']
OK_WORDS = ['无法自动匹配']  # 35 号合同词，出现不算失败


def extract_list(src, name):
    m = re.search(r'var %s = \[([^\]]*)\]' % name, src) or re.search(r'const %s = \[([^\]]*)\]' % name, src)
    if not m:
        return None
    return [s.strip().strip("'\"") for s in m.group(1).split(',') if s.strip()]


def extract_pairs(src, name):
    if name == 'PAGES':  # 3 元组：[id, label, icon] → (id, label)
        m = re.search(r'const PAGES = \[([\s\S]*?)\n\];', src)
        return re.findall(r"\['([^']+)',\s*'([^']+)'(?:,\s*'[^']*')?\]", m.group(1)) if m else None
    if name == 'SUBPAGES':  # 对象：view: [[sub,label],...] → (view,sub)
        m = re.search(r'const SUBPAGES = \{([\s\S]*?)\n\};', src)
        if not m:
            return None
        out = []
        for line in m.group(1).splitlines():
            lm = re.match(r"\s*(\w+): \[(.+)\],?$", line.strip())
            if lm:
                out += [(lm.group(1), sub) for sub in re.findall(r"\['([^']+)',", lm.group(2))]
        return out
    m = re.search(r'const %s = \[([\s\S]*?)\n\];' % name, src)
    return re.findall(r"\['([^']+)',\s*'([^']+)'", m.group(1)) if m else None


def extract_scenes(src):
    m = re.search(r'const SCENES = \[(.*?)\n\];', src, re.S)
    if not m:
        return None
    scenes = []
    for block in re.findall(r'\{ id: .*?\}(?=,?\s*(?:\n|$))', m.group(1), re.S):
        sid = re.search(r"id: '([^']+)'", block).group(1)
        view = re.search(r"view: '([^']+)'", block).group(1)
        sub = re.search(r"sub: '([^']*)'", block).group(1)
        covers = re.search(r'covers: \[([^\]]*)\]', block)
        covers = [c.strip().strip("'\"") for c in covers.group(1).split(',')] if covers else []
        scenes.append({'id': sid, 'view': view, 'sub': sub, 'covers': covers})
    return scenes


def run(src, fails):
    pages = extract_pairs(src, 'PAGES')
    routes = extract_list(src, 'ROUTES')
    subs = extract_pairs(src, 'SUBPAGES')
    manifest = extract_pairs(src, 'ROUTE_MANIFEST')
    scenes = extract_scenes(src)
    for label, v in [('PAGES', pages), ('ROUTES', routes), ('SUBPAGES', subs), ('ROUTE_MANIFEST', manifest), ('SCENES', scenes)]:
        if v is None:
            fails.append(f'{label}: 在 app.js 找不到常量')
            return

    # R1 ROUTES 完整
    page_ids = [p[0] for p in pages]
    if routes != page_ids:
        fails.append(f'R1: var ROUTES 与 PAGES 不一致：ROUTES={routes} PAGES={page_ids}')
    elif routes != EXPECTED_ROUTES:
        fails.append(f'R1: var ROUTES 与合同 10 线不一致：{routes}')
    else:
        print(f'PASS  R1  ROUTES 与 PAGES 及合同 10 线一致')

    # R2 清单一致
    if sorted(manifest) != sorted(subs):
        only_m = [p for p in manifest if p not in subs]
        only_s = [p for p in subs if p not in manifest]
        fails.append(f'R2: ROUTE_MANIFEST 与 SUBPAGES 不一致 manifest_only={only_m} subpages_only={only_s}')
    else:
        print(f'PASS  R2  ROUTE_MANIFEST 与 SUBPAGES 一致（{len(manifest)} 页）')

    # R3 场景覆盖（X1 双向：每个 (view,sub) 被 ≥1 条路径经过）
    covered = set()
    for s in scenes:
        covered.add(f"{s['view']}/{s['sub']}")
        covered.update(s['covers'])
    manifest_keys = {f'{v}/{k}' for v, k in manifest}
    orphans = sorted(manifest_keys - covered)
    if orphans:
        fails.append(f'R3/X1: 孤儿页 {len(orphans)} 个：{orphans}')
    else:
        print(f'PASS  R3/X1  场景覆盖孤儿页 = 0（{len(scenes)} 条路径覆盖 {len(manifest_keys)} 页）')
    bad_covers = [c for s in scenes for c in s['covers'] if c not in manifest_keys and c != 'dashboard']
    if bad_covers:
        fails.append(f'R3: covers 里出现清单外的页：{sorted(set(bad_covers))}')

    # R4 红线静态扫描
    for w in BAD_WORDS:
        hits = [i + 1 for i, line in enumerate(src.splitlines()) if w in line
                and not any(ok in line for ok in OK_WORDS)]
        if w in ('match_score', 'eligible', 'suitability'):
            hits = [i for i in hits if not re.search(r'禁止|不新增|无 match_score|不用 match_score|不产出数值', src.splitlines()[i - 1])]
        if hits:
            fails.append(f'R4: 红线词「{w}」出现 {len(hits)} 处（行 {hits[:5]}）')
    if not any(f.startswith('R4') for f in fails):
        print('PASS  R4  红线词零命中（不可恢复/判读词/判定列名）')


def main():
    fails = []
    if not APP.exists():
        print(f'FAIL  原型不存在：{APP}')
        return 1
    src = APP.read_text(encoding='utf-8')
    if '--self-test' in sys.argv:
        # 注入一处孤儿页（删掉 S01 covers 里的 titer/labmeta）：探针必须报 FAIL
        src = src.replace("'titer/labmeta', ", "", 1)
    run(src, fails)
    print(f'---\n{"PASS" if not fails else "FAIL"}  probe-router 共 {len(fails)} 项失败')
    for f in fails:
        print('  ✗', f)
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(main())

# -*- coding: utf-8 -*-
"""
build_fund_data.py — 把国社科(1991-2026) + 教育部人文社科(2020-2026) 立项名单
转换成小程序「基金检索」页用的精简分片 JSON。

输出：docs/data/fund/
  index.json   清单：{v, generatedAt, chunks:[{file,fund,y1,y2,count}], disciplines, cats}
  <chunk>.json {fund, y1, y2, count, items:[[title,person,org,disc,cat,year],...]}

每条记录只留 6 个字段（数组形式省 key 体积）：
  [课题名称, 负责人/申请人, 单位, 学科, 项目类别, 年份]
"""
import os
import re
import sys
import io
import json
import datetime

import openpyxl
try:
    import xlrd  # 读 .xls 老格式（国自然 2021/2022）
except ImportError:
    xlrd = None

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DIR_NSSF = r'C:\Users\Administrator\Desktop\闲鱼数字资料\1991年-2026年国社科'
DIR_MOE = r'C:\Users\Administrator\Desktop\闲鱼数字资料\教育部人文社会科学研究2020-2026'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'docs', 'data', 'fund')

MAX_CHUNK_BYTES = 2.5 * 1024 * 1024  # 单片软上限

WS = re.compile(r'\s+')

def clean (s):
    """去掉单元格里的换行、多余空白"""
    if s is None:
        return ''
    s = str(s).replace('\r', ' ').replace('\n', ' ')
    s = WS.sub(' ', s).strip()
    return s

def norm_disc (s):
    """学科名归一：'马列 · 科社' / '马列 ·科社' → '马列·科社'"""
    s = clean(s).replace(' ', '')
    return s

def cellv (row, idx):
    if idx is None or idx < 0 or idx >= len(row):
        return ''
    return row[idx]

def find_header (rows, title_keys, person_keys):
    """找到表头行号（0 基），要求同一行同时出现标题列和负责人列的关键词"""
    for i, r in enumerate(rows):
        joined = ''.join(clean(c) for c in r)
        has_t = any(k in joined for k in title_keys)
        has_p = any(k in joined for k in person_keys)
        if has_t and has_p:
            return i
    return -1

def col_of (header_row, keys):
    for i, c in enumerate(header_row):
        v = clean(c)
        for k in keys:
            if v == k or (k in v and len(v) <= 8):
                return i
    return -1

T_KEYS = ['项目名称', '课题名称']
P_KEYS = ['申请人', '姓名', '负责人']
O_KEYS = ['学校名称', '工作单位', '责任单位', '所在单位']
D_KEYS = ['学科门类', '学科分类', '涉及学科', '所在学科', '学科']
C_KEYS = ['项目类别', '项目类型']
B_KEYS = ['项目批准号', '批准号']

# ─── 国社科 ───────────────────────────────────────────────

def parse_nssf_hist (path, recs, seen):
    """社科基金项目数据1991-2022.xlsx：单 sheet，20 列，表头第 1 行"""
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = None
    n = 0
    for r in rows:
        vals = list(r)
        if header is None:
            j = ''.join(clean(c) for c in vals)
            if '项目批准号' in j and '项目名称' in j:
                hi, ti = col_of(vals, ['项目名称']), col_of(vals, ['项目负责人'])
                ci, di = col_of(vals, ['项目类别']), col_of(vals, ['学科分类'])
                oi, bi = col_of(vals, ['工作单位']), col_of(vals, ['项目批准号'])
                li = col_of(vals, ['立项时间'])
                header = (ti, hi, oi, di, ci, bi, li)
            continue
        title = clean(cellv(vals, header[0]))
        if not title or title in ('项目名称', '课题名称'):
            continue
        person = clean(cellv(vals, header[1]))
        org = clean(cellv(vals, header[2]))
        disc = norm_disc(cellv(vals, header[3]))
        cat = clean(cellv(vals, header[4]))
        code = clean(cellv(vals, header[5]))
        t0 = cellv(vals, header[6])
        year = 0
        if isinstance(t0, datetime.datetime):
            year = t0.year
        elif t0:
            m = re.search(r'(19|20)\d{2}', str(t0))
            if m:
                year = int(m.group(0))
        if not year and re.match(r'^\d{2}', code):
            yy = int(code[:2])
            year = 1900 + yy if yy >= 50 else 2000 + yy
        if not year:
            continue
        key = code or (str(year) + title + person)
        if key in seen:
            continue
        seen[key] = 1
        recs.append([title, person, org, disc, cat or '年度项目', year])
        n += 1
    wb.close()
    return n

def parse_nssf_sheet_table (rows, fixed_cat, recs, seen):
    """通用表解析：自动找表头，缺类别列时用 fixed_cat"""
    rows = list(rows)
    hi = find_header(rows, T_KEYS, P_KEYS)
    if hi < 0:
        return 0
    h = rows[hi]
    ti = col_of(h, T_KEYS)
    pi = col_of(h, P_KEYS)
    oi = col_of(h, O_KEYS)
    di = col_of(h, D_KEYS)
    ci = col_of(h, C_KEYS)
    bi = col_of(h, B_KEYS)
    n = 0
    for r in rows[hi + 1:]:
        title = clean(cellv(r, ti))
        if not title or title in ('项目名称', '课题名称'):
            continue
        person = clean(cellv(r, pi))
        org = clean(cellv(r, oi))
        disc = norm_disc(cellv(r, di))
        cat = clean(cellv(r, ci)) or fixed_cat or '年度项目'
        code = clean(cellv(r, bi))
        key = code or ('n' + title + person)
        if key in seen:
            continue
        seen[key] = 1
        recs.append([title, person, org, disc, cat, 0])  # 年份后面按文件补
        n += 1
    return n

def parse_nssf_2023_2026 (recs, seen):
    total = 0
    d = DIR_NSSF
    # 2023：三个文件，表头在第 1 行（西部那个在第 2 行，函数会自动找）
    f = os.path.join(d, '2023年国家社会科学基金年度项目.xlsx')
    wb = openpyxl.load_workbook(f, read_only=True)
    total += parse_nssf_sheet_table(wb.worksheets[0].iter_rows(values_only=True), '', recs, seen)
    wb.close()
    for name, cat in [
        ('2023年国家社会科学基金青年项目立项结果公布.xlsx', '青年项目'),
        ('2023年国家社会科学基金西部项目立项名单.xlsx', '西部项目'),
    ]:
        wb = openpyxl.load_workbook(os.path.join(d, name), read_only=True)
        total += parse_nssf_sheet_table(wb.worksheets[0].iter_rows(values_only=True), cat, recs, seen)
        wb.close()
    for r in recs[-total:]:
        pass
    # 给刚解析的这批补年份 2023
    for r in recs:
        if r[5] == 0:
            r[5] = 2023
    # 2024：4 个分表 sheet，类别 = sheet 名
    f = os.path.join(d, '2024国家社科基金立项名单.xlsx')
    wb = openpyxl.load_workbook(f, read_only=True)
    before = len(recs)
    for ws in wb.worksheets:
        parse_nssf_sheet_table(ws.iter_rows(values_only=True), ws.title, recs, seen)
    wb.close()
    for r in recs[before:]:
        if r[5] == 0:
            r[5] = 2024
    total += len(recs) - before
    # 2025 / 2026：用「所有项目」sheet（含项目类型列），其他分表是重复
    for name, yr in [
        ('2025年国家社会科学基金项目立项名单.xlsx', 2025),
        ('2026年国家社会科学基金项目立项名单6065项.xlsx', 2026),
    ]:
        wb = openpyxl.load_workbook(os.path.join(d, name), read_only=True)
        before = len(recs)
        parse_nssf_sheet_table(wb['所有项目'].iter_rows(values_only=True), '', recs, seen)
        wb.close()
        for r in recs[before:]:
            if r[5] == 0:
                r[5] = yr
        total += len(recs) - before
    return total

# ─── 教育部人文社科 ───────────────────────────────────────

def sheet_cat (name, has_cat):
    if has_cat:
        return ''
    if '西部' in name or '边疆' in name:
        return '西部和边疆地区项目'
    if '新疆' in name:
        return '新疆项目'
    if '西藏' in name:
        return '西藏项目'
    if '辅导员' in name:
        return '高校辅导员专项'
    if '中国特色社会主义' in name:
        return '中特理论专项'
    return '规划/青年基金项目'

def parse_moe_year (path, year, recs, seen):
    wb = openpyxl.load_workbook(path, read_only=True)
    n = 0
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        hi = find_header(rows, T_KEYS, P_KEYS)
        if hi < 0:
            continue
        h = rows[hi]
        ti = col_of(h, T_KEYS)
        pi = col_of(h, P_KEYS)
        oi = col_of(h, O_KEYS)
        di = col_of(h, D_KEYS)
        ci = col_of(h, C_KEYS)
        bi = col_of(h, B_KEYS)
        cat0 = sheet_cat(ws.title, ci >= 0)
        for r in rows[hi + 1:]:
            title = clean(cellv(r, ti))
            if not title or title in ('项目名称', '课题名称') or title.endswith('一览表') or '立项' in title[:20]:
                continue
            person = clean(cellv(r, pi))
            org = clean(cellv(r, oi))
            disc = norm_disc(cellv(r, di))
            cat = clean(cellv(r, ci)) or cat0
            code = clean(cellv(r, bi))
            key = code or ('m' + title + person + org)
            if key in seen:
                continue
            seen[key] = 1
            recs.append([title, person, org, disc, cat, year])
            n += 1
    wb.close()
    return n

# ─── 国自然 NSFC（2017-2026，8 学部，9 种表头变体） ──────

DIR_NSFC = r'C:\Users\Administrator\Desktop\闲鱼数字资料\3.国自然基金'

N_TITLE = ['项目名称', '项目名(官方语言)', '项目标题', '标题', '题目']
N_PERSON = ['负责人', '项目主持人', '姓名']
N_ORG = ['依托单位', '项目承担机构', '单位', '机构']
N_DISC = ['学部', '所属学部']
N_CAT = ['项目类型', '基金类别', '项目类别']
N_YEAR = ['立项年度', '批准年份', '立项度']

# 2022信息科学部.xlsx 无表头，列序与 2021/2023 相同
# [Source.Name, 项目标题, 所属学部, 项目类型, 项目编号, 金额, 负责人, 单位, 批准年份]
NSFC_HEADERLESS = {
    '2022信息科学部.xlsx': {'title': 1, 'disc': 2, 'cat': 3, 'person': 6, 'org': 7, 'year': 8}
}

def nsfc_disc_fallback (path):
    """文件路径里推断学部（表头没学部列的文件用）"""
    s = path.replace('/', '\\')
    for kw, name in [('医学', '医学科学部'), ('生命', '生命科学部'), ('数理', '数理科学部'),
                     ('信息', '信息科学部'), ('地球', '地球科学部'), ('工程与材料', '工程与材料科学部'),
                     ('管理', '管理科学部'), ('化学', '化学科学部')]:
        if kw in s:
            return name
    return ''

def nsfc_year_fallback (path):
    m = re.search(r'(20\d\d)', os.path.basename(path))
    return int(m.group(1)) if m else 0

def parse_nsfc_sheet (rows, path, recs, seen):
    """一个 sheet 的行解析；表头不认识就跳过（说明页/统计页天然被过滤）"""
    hi = -1
    cols = None
    for i, r in enumerate(rows[:5]):
        h = [clean(c) for c in r]
        if any(k in h for k in N_TITLE) and any(k in h for k in N_PERSON):
            hi = i
            cols = {}
            for field, keys in [('title', N_TITLE), ('person', N_PERSON), ('org', N_ORG),
                                ('disc', N_DISC), ('cat', N_CAT), ('year', N_YEAR)]:
                for k in keys:
                    ci = col_of(h, [k])
                    if ci >= 0:
                        cols[field] = ci
                        break
            break
    if cols is None or 'title' not in cols or 'person' not in cols:
        return 0
    fb_year = nsfc_year_fallback(path)
    fb_disc = nsfc_disc_fallback(path)
    n = 0
    for r in rows[hi + 1:]:
        title = clean(cellv(r, cols.get('title', -1)))
        person = clean(cellv(r, cols.get('person', -1)))
        if not title:
            continue
        org = clean(cellv(r, cols.get('org', -1)))
        disc = norm_disc(cellv(r, cols.get('disc', -1))) or fb_disc
        cat = clean(cellv(r, cols.get('cat', -1)))
        try:
            year = int(float(clean(cellv(r, cols.get('year', -1)))) // 1)
        except (TypeError, ValueError):
            year = 0
        if not (2000 < year < 2030):
            year = fb_year
        if not year:
            continue
        key = 'n2' + title + '|' + person + '|' + org + '|' + cat + '|' + str(year)
        if key in seen:
            continue
        seen[key] = 1
        recs.append([title, person, org, disc, cat, year])
        n += 1
    return n

def parse_nsfc (recs, seen):
    total = 0
    for dirpath, dirs, files in os.walk(DIR_NSFC):
        for f in sorted(files):
            low = f.lower()
            if not low.endswith(('.xlsx', '.xls')):
                continue
            path = os.path.join(dirpath, f)
            n_before = len(recs)
            if f in NSFC_HEADERLESS:
                # 无表头特例
                m = NSFC_HEADERLESS[f]
                rows = []
                if low.endswith('.xlsx'):
                    wb = openpyxl.load_workbook(path, read_only=True)
                    rows = list(wb['Sheet1'].iter_rows(values_only=True))
                    wb.close()
                else:
                    wb = xlrd.open_workbook(path)
                    ws = wb.sheet_by_index(0)
                    rows = [tuple(ws.cell_value(r, c) for c in range(ws.ncols))
                            for r in range(ws.nrows)]
                fb_year = nsfc_year_fallback(path)
                for r in rows:
                    title = clean(cellv(r, m['title']))
                    if not title:
                        continue
                    person = clean(cellv(r, m['person']))
                    org = clean(cellv(r, m['org']))
                    disc = norm_disc(cellv(r, m['disc']))
                    cat = clean(cellv(r, m['cat']))
                    try:
                        year = int(float(clean(cellv(r, m['year']))))
                    except (TypeError, ValueError):
                        year = fb_year
                    key = 'n2' + title + '|' + person + '|' + org + '|' + cat + '|' + str(year)
                    if key in seen:
                        continue
                    seen[key] = 1
                    recs.append([title, person, org, disc, cat, year])
            elif low.endswith('.xlsx'):
                wb = openpyxl.load_workbook(path, read_only=True)
                for ws in wb.worksheets:
                    parse_nsfc_sheet(list(ws.iter_rows(values_only=True)), path, recs, seen)
                wb.close()
            else:
                wb = xlrd.open_workbook(path)
                for ws in wb.sheets():
                    rows = [tuple(ws.cell_value(r, c) for c in range(ws.ncols))
                            for r in range(ws.nrows)]
                    parse_nsfc_sheet(rows, path, recs, seen)
            n = len(recs) - n_before
            if n:
                print('  %s -> %d 条' % (os.path.relpath(path, DIR_NSFC), n))
            total += n
    return total

# ─── 统计输出（供「统计」视图：学科条形图 / 单位 Top 榜 / 年度趋势 / 关键词） ──

# 标题里的通用词与机构后缀，统计关键词时剔除（不区分基金）
STOPWORDS = set('''研究 基于 视角 路径 机制 对策 中国 我国 新时代 高质量 发展 建设
问题 实践 探索 模式 体系 系统 策略 影响 作用 案例 背景 框架 面向
当代 网络 数字 智能时代 转型 创新 治理 评价 分析 application research
及其 开展 推动 促进 融合 视域 语境 下 的 与 之 和 及 在 中 从 对 为 以 关于
回顾 展望 论纲 逻辑 意蕴 生成 进路 张力 向度 范式 图景 样态 图式
行动 转向 演进 变迁 逻辑理路 双重 三重 多重 比较研究 实证研究
提升 优化 完善 强化 深化 构建 培育 激发 整理 时代 特征 规律 格局
机理 效应 内涵 要素 问题导向 情境 维度 要义 要素禀赋 契合
项目名称 未公开 未公布 待定 暂无 通过'''.split())
ORG_SUFFIX = re.compile(r'(研究(院|所|中心|基地|室)?|大学|学院|学校|党委|党组|委员会|办公室|部$|厅$|局$|馆$|社$)')

def build_stats (recs, fund):
    """recs: [[title,person,org,disc,cat,year]] → 全库按基金聚合的统计"""
    discs, orgs, years, cats, kws, kws_recent = {}, {}, {}, {}, {}, {}
    disc_kws = {}        # disc -> {word: n} 全量
    disc_kws_recent = {} # disc -> {word: n} 近三年
    import jieba
    max_year = max((r[5] for r in recs), default=0)
    for r in recs:
        if r[3]:
            discs[r[3]] = discs.get(r[3], 0) + 1
        if r[2]:
            orgs[r[2]] = orgs.get(r[2], 0) + 1
        if r[4]:
            cats[r[4]] = cats.get(r[4], 0) + 1
        y = r[5]
        if y:
            years[y] = years.get(y, 0) + 1
        in_recent = max_year - 2 <= y <= max_year
        dk = disc_kws.get(r[3]) if r[3] else None
        if r[3] and dk is None:
            dk = disc_kws[r[3]] = {}
        dkr = disc_kws_recent.get(r[3]) if r[3] else None
        if r[3] and dkr is None:
            dkr = disc_kws_recent[r[3]] = {}
        # 关键词：课题名分词，保留 2-6 字的名词性片段
        title = r[0] or ''
        if title:
            for w in jieba.cut(title):
                w = w.strip()
                if (len(w) < 2 or len(w) > 6 or w in STOPWORDS
                        or ORG_SUFFIX.fullmatch(w) or not re.search(r'[\u4e00-\u9fff]', w)):
                    continue
                kws[w] = kws.get(w, 0) + 1
                if in_recent:
                    kws_recent[w] = kws_recent.get(w, 0) + 1
                if dk is not None:
                    dk[w] = dk.get(w, 0) + 1
                    if in_recent:
                        dkr[w] = dkr.get(w, 0) + 1

    def top (d, n, floor=10):
        return [[k, v] for k, v in sorted(d.items(), key=lambda x: -x[1]) if v >= floor][:n]

    # 分学科关键词榜：只保留课题数 ≥ 30 的学科（太少的没统计意义；剔除占位学科名）
    disc_kws_out = {}
    for d, cnt in discs.items():
        if cnt < 30 or d in ('未公布', '未公开', '未知'):
            continue
        dk = disc_kws.get(d) or {}
        dkr = disc_kws_recent.get(d) or {}
        disc_kws_out[d] = {
            'count': cnt,
            'kws': top(dk, 100, floor=5),        # 该学科全量榜 Top100
            'kwsRecent': top(dkr, 60, floor=3)   # 该学科近三年热点 Top60
        }

    return {
        'total': len(recs),
        'discs': [[k, v] for k, v in sorted(discs.items(), key=lambda x: -x[1])][:40],
        'orgs': [[k, v] for k, v in sorted(orgs.items(), key=lambda x: -x[1])][:50],
        'cats': [[k, v] for k, v in sorted(cats.items(), key=lambda x: -x[1])][:30],
        'years': [[y, years[y]] for y in sorted(years)],
        'kws': top(kws, 200),              # 全量榜（弹层「更多」用）
        'kwsRecent': top(kws_recent, 100), # 近三年热点（maxYear-2 ~ maxYear）
        'recentSpan': [max_year - 2, max_year] if max_year else [],
        'discKws': disc_kws_out            # 按学科/学部分类的关键词榜
    }

# ─── 分片输出 ─────────────────────────────────────────────

def chunk_nssf (recs):
    """国社科按年份段分片，早期年份合并，单片控制在 ~2.5MB 内"""
    spans = [(1991, 1998), (1999, 2005), (2006, 2010), (2011, 2013),
             (2014, 2015), (2016, 2017), (2018, 2019), (2020, 2020),
             (2021, 2021), (2022, 2022), (2023, 2023), (2024, 2024),
             (2025, 2025), (2026, 2026)]
    out = []
    for y1, y2 in spans:
        items = [r for r in recs if y1 <= r[5] <= y2]
        if not items:
            continue
        out.append((y1, y2, items))
    return out

def chunk_moe (recs):
    spans = [(2020, 2022), (2023, 2024), (2025, 2026)]
    out = []
    for y1, y2 in spans:
        items = [r for r in recs if y1 <= r[5] <= y2]
        if items:
            out.append((y1, y2, items))
    return out

def chunk_nsfc (recs):
    """国自然按单年分片（2017-2026）；单年超限时按学部装箱切细（同组不拆）。
    返回 (y1, y2, items, sub序号)；sub 为 None 时文件名不带序号。"""
    out = []
    EST = 210                       # 每条记录估算字节（含 JSON 转义与中文 UTF-8）
    LIMIT = int(2.2 * 1024 * 1024)  # 装箱目标上限（实际写盘后校验）
    for y in sorted(set(r[5] for r in recs)):
        items = [r for r in recs if r[5] == y]
        groups = {}
        for r in items:
            groups.setdefault(r[3] or '其他', []).append(r)
        glist = sorted(groups.values(), key=len, reverse=True)
        bins = []
        for g in glist:
            placed = False
            for b in bins:
                if (len(b) + len(g)) * EST <= LIMIT:
                    b.extend(g)
                    placed = True
                    break
            if not placed:
                bins.append(list(g))
        multi = len(bins) > 1
        for i, b in enumerate(bins):
            out.append((y, y, b, i if multi else None))
    return out

def main ():
    os.makedirs(OUT_DIR, exist_ok=True)
    seen = {}
    nssf = []
    moe = []

    print('解析 国社科 1991-2022 …')
    n = parse_nssf_hist(os.path.join(DIR_NSSF, '社科基金项目数据1991-2022.xlsx'), nssf, seen)
    print('  -> %d 条（累计 %d）' % (n, len(nssf)))

    print('解析 国社科 2023-2026 …')
    n = parse_nssf_2023_2026(nssf, seen)
    print('  -> %d 条（累计 %d）' % (n, len(nssf)))

    print('解析 教育部人文社科 2020-2026 …')
    d = DIR_MOE
    for y in range(2020, 2027):
        n = parse_moe_year(os.path.join(d, str(y) + '.xlsx'), y, moe, seen)
        print('  %d -> %d 条（累计 %d）' % (y, n, len(moe)))

    print('解析 国自然 NSFC 2017-2026 …')
    nsfc = []
    n = parse_nsfc(nsfc, seen)
    print('  -> %d 条' % n)

    # 学科 / 类别清单（供前端下拉）
    disc_set = {}
    cat_set = {}
    for r in nssf + moe + nsfc:
        if r[3]:
            disc_set[r[3]] = disc_set.get(r[3], 0) + 1
        if r[4]:
            cat_set[r[4]] = cat_set.get(r[4], 0) + 1
    disciplines = [k for k, v in sorted(disc_set.items(), key=lambda x: -x[1]) if v >= 5][:80]
    cats = [k for k, v in sorted(cat_set.items(), key=lambda x: -x[1])][:30]

    chunks = []
    def write_chunks (fund, spanned, prefix):
        for spanned_item in spanned:
            y1, y2, items = spanned_item[0], spanned_item[1], spanned_item[2]
            sub = spanned_item[3] if len(spanned_item) > 3 else None
            items.sort(key=lambda r: (r[0]))
            fname = '%s_%d%s%s.json' % (prefix, y1,
                                        '' if y1 == y2 else '_' + str(y2),
                                        '' if sub is None else '_' + str(sub))
            payload = {'fund': fund, 'y1': y1, 'y2': y2, 'count': len(items), 'items': items}
            p = os.path.join(OUT_DIR, fname)
            with open(p, 'w', encoding='utf-8') as fh:
                json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
            mb = os.path.getsize(p) / 1048576.0
            print('  %s : %d 条, %.2f MB' % (fname, len(items), mb))
            chunks.append({'file': fname, 'fund': fund, 'y1': y1, 'y2': y2, 'count': len(items)})
            if mb > 3.2:
                print('  ⚠️ 单片超过 3.2MB，建议再切细')

    print('写出分片 …')
    write_chunks('nssf', chunk_nssf(nssf), 'nssf')
    write_chunks('moe', chunk_moe(moe), 'moe')
    write_chunks('nsfc', chunk_nsfc(nsfc), 'nsfc')

    manifest = {
        'v': 1,
        'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d'),
        'count': len(nssf) + len(moe) + len(nsfc),
        'nssfCount': len(nssf),
        'moeCount': len(moe),
        'nsfcCount': len(nsfc),
        'disciplines': disciplines,
        'cats': cats,
        'chunks': chunks
    }
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, separators=(',', ':'))
    print('index.json 完成：国社科 %d + 教育部 %d + 国自然 %d = %d 条，%d 个分片'
          % (len(nssf), len(moe), len(nsfc), len(nssf) + len(moe) + len(nsfc), len(chunks)))

    # 统计：全库（不分年份段），统计视图直接读，前端不用下载分片也能画图
    stats = {'nssf': build_stats(nssf, 'nssf'), 'moe': build_stats(moe, 'moe'),
             'nsfc': build_stats(nsfc, 'nsfc')}
    with open(os.path.join(OUT_DIR, 'stats.json'), 'w', encoding='utf-8') as fh:
        json.dump(stats, fh, ensure_ascii=False, separators=(',', ':'))
    sb = os.path.getsize(os.path.join(OUT_DIR, 'stats.json')) / 1024.0
    print('stats.json 完成：%.1f KB（国社科 top %s… / 教育部 top %s… / 国自然 top 学部 %s…）'
          % (sb, stats['nssf']['discs'][0][0], stats['moe']['discs'][0][0],
             stats['nsfc']['discs'][0][0]))

if __name__ == '__main__':
    main()

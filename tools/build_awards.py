# -*- coding: utf-8 -*-
"""
build_awards.py — 三大类立项名单 Excel → 姓氏分片 JSON（GitHub Pages 用）

输入（只读，绝不改动源文件）：
  D1 国社科   F:\...\闲鱼数字资料\1991年-2026年国社科\*.xlsx
  D2 教育部   F:\...\闲鱼数字资料\教育部人文社会科学研究2020-2026\*.xlsx
  D3 国自然   F:\...\闲鱼数字资料\009-国自然基金立项名单2017-2026\01-数据\**\*.xlsx

输出（写进小程序项目 docs/data/awards/，随仓库发布）：
  docs/data/awards/index.json          元信息（各源条数、姓氏片清单、更新时间）
  docs/data/awards/{src}-{姓}.json     姓氏分片，src = nsfc / nssc / moe

统一字段：s(姓名) o(单位) t(项目名) c(类别) d(学科) y(年度) p(批准号) b(学部,仅国自然)
"""
import os, re, sys, json, glob, gzip
import openpyxl
import xlrd

sys.stdout.reconfigure(encoding='utf-8')

SRCS = [
    ('nssc', r'C:\Users\Administrator\Desktop\闲鱼数字资料\1991年-2026年国社科', '国家社科基金'),
    ('moe',  r'C:\Users\Administrator\Desktop\闲鱼数字资料\教育部人文社会科学研究2020-2026', '教育部人文社科'),
    ('nsfc', r'C:\Users\Administrator\Desktop\闲鱼数字资料\009-国自然基金立项名单2017-2026\01-数据', '国家自然科学基金'),
]
OUT = r'F:\微信开发平台\jason-v1.1\docs\data\awards'

# 常见复姓：取前两字作分片键
FUXING = ['欧阳','司马','上官','诸葛','东方','皇甫','尉迟','公孙','长孙','慕容','宇文','司徒','申屠','南宫','夏侯','钟离','鲜于','司空','闾丘','子车','亓官','司寇','巫马','公西','颛孙','壤驷','公良','漆雕','乐正','宰父','谷梁','拓跋','夹谷','轩辕','令狐','段干','百里','呼延','东郭','南门','羊舌','微生','左丘','东门','西门','南荣','第五']

COL_RULES = [
    ('name',  re.compile(r'姓名|申请人|主持人|负责人')),
    ('org',   re.compile(r'单位|机构|学校|依托单位')),
    ('title', re.compile(r'课题名称|项目名称|项目名|标题')),
    ('cat',   re.compile(r'项目类别|基金类别|类别|类型')),
    ('disc',  re.compile(r'学科')),
    ('code',  re.compile(r'批准号|编号')),
    ('dept',  re.compile(r'学部')),
]
YEAR_RE = re.compile(r'(19|20)\d{2}')

def col_map(headers):
    """表头行 → {字段: 列号}；一列只能归属一个字段，按规则顺序先到先得"""
    m, used = {}, set()
    for key, pat in COL_RULES:
        for i, h in enumerate(headers):
            if i in used or h is None:
                continue
            s = str(h)
            if pat.search(s) and len(s) < 20:  # 排除"2023年国家社科基金…立项名单"这类整行标题被误当列名
                m[key] = i
                used.add(i)
                break
    return m

def cell(row, idx):
    if idx is None or idx >= len(row):
        return ''
    v = row[idx]
    if v is None:
        return ''
    return str(v).strip()

def year_of(fname, row, year_col):
    if year_col is not None:
        v = cell(row, year_col)
        mm = YEAR_RE.search(v)
        if mm:
            return mm.group(0)
    mm = YEAR_RE.search(os.path.basename(fname))
    return mm.group(0) if mm else ''

def surname(name):
    name = re.sub(r'\s', '', name)
    if not name:
        return ''
    for fx in FUXING:
        if name.startswith(fx):
            return fx
    return name[0]

def open_book(f):
    """打开 xlsx 或 xls，yield (sheet名, 行迭代器)。每行是值列表。"""
    if f.lower().endswith('.xls'):
        book = xlrd.open_workbook(f)
        for si in range(book.nsheets):
            sh = book.sheet_by_index(si)
            yield sh.name, (sh.row_values(r) for r in range(sh.nrows))
    else:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        try:
            for ws in wb.worksheets:
                yield ws.title, ws.iter_rows(values_only=True)
        finally:
            wb.close()

def main():
    os.makedirs(OUT, exist_ok=True)
    stats = {}
    index = {'v': 1, 'updatedAt': '', 'sources': {}}
    import datetime
    index['updatedAt'] = datetime.date.today().isoformat()

    for src, root, label in SRCS:
        shards = {}          # {姓: [record]}
        total = 0
        skipped_sheets = []
        files = sorted(glob.glob(os.path.join(root, '**', '*.xlsx'), recursive=True)
                       + glob.glob(os.path.join(root, '**', '*.xls'), recursive=True))
        for f in files:
            rel = os.path.relpath(f, root)
            try:
                book = open_book(f)
            except Exception as e:
                skipped_sheets.append('%s: 打不开 %s' % (rel, e))
                continue
            for ws_title, rows in book:
                cm = None
                year_col = None
                n_sheet = 0
                try:
                    for row in rows:
                        vals = [c for c in row if c is not None and str(c).strip()]
                        if cm is None:
                            # 还没锁定表头：找一行含"姓名/申请人/主持人"的行作表头
                            joined = ' '.join(str(c) for c in row if c is not None)
                            if not vals:
                                continue
                            if re.search(r'姓名|申请人|主持人|负责人', joined) and re.search(r'名称|单位|机构|学校|学科', joined):
                                cm = col_map(row)
                                if not cm.get('name'):
                                    cm = None
                                    continue
                                year_col = next((i for i, h in enumerate(row)
                                                 if h and '年度' in str(h)), None)
                            continue
                        # 数据行
                        name = cell(row, cm.get('name'))
                        if not name or len(name) > 20:
                            continue
                        title = cell(row, cm.get('title'))
                        if not title:
                            continue
                        rec = {
                            's': name,
                            'o': cell(row, cm.get('org'))[:60],
                            't': title[:120],
                            'y': year_of(f, row, year_col),
                        }
                        if cm.get('cat'):
                            rec['c'] = cell(row, cm.get('cat'))[:20]
                        if cm.get('disc'):
                            rec['d'] = cell(row, cm.get('disc'))[:30]
                        if cm.get('code'):
                            rec['p'] = re.sub(r'\.0$', '', cell(row, cm.get('code')))[:20]
                        if cm.get('dept'):
                            rec['b'] = cell(row, cm.get('dept'))[:10]
                        if not rec['y']:
                            rec['y'] = ''
                        zh = surname(name)
                        if not zh:
                            continue
                        shards.setdefault(zh, []).append(rec)
                        n_sheet += 1
                except Exception as e:
                    skipped_sheets.append('%s/%s: %s' % (rel, ws_title, e))
                total += n_sheet
        # 写分片
        files_out = []
        for zh in sorted(shards):
            path = os.path.join(OUT, '%s-%s.json' % (src, zh))
            with open(path, 'w', encoding='utf-8') as fp:
                json.dump({'src': src, 'sn': zh, 'n': len(shards[zh]), 'items': shards[zh]},
                          fp, ensure_ascii=False, separators=(',', ':'))
            files_out.append({'sn': zh, 'n': len(shards[zh])})
        index['sources'][src] = {'label': label, 'count': total, 'shards': files_out}
        stats[src] = total
        print('[%s] %s：%d 条，%d 个姓氏分片' % (src, label, total, len(files_out)))
        for msg in skipped_sheets[:8]:
            print('   跳过:', msg)

    # 大分片 gzip 副本（供小程序用 gzip？wx.request 自动解压 gzip 响应，无需手动）
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fp:
        json.dump(index, fp, ensure_ascii=False, separators=(',', ':'))
    print('index.json 完成。总计', sum(stats.values()), '条')

if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""扫描国自然目录全部 xlsx/xls：表头、行数、sheet 数，摸清字段结构。"""
import os, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import openpyxl, xlrd

ROOT = r'C:\Users\Administrator\Desktop\闲鱼数字资料\3.国自然基金'

def rows_xlsx(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    for ws in wb.worksheets:
        yield ws.title, list(ws.iter_rows(max_row=3, values_only=True)), ws.max_row
    wb.close()

def rows_xls(path):
    wb = xlrd.open_workbook(path)
    for ws in wb.sheets():
        head = [ws.cell_value(0, c) for c in range(ws.ncols)] if ws.nrows else []
        r2 = [ws.cell_value(1, c) for c in range(ws.ncols)] if ws.nrows > 1 else []
        yield ws.name, [head, r2], ws.nrows

total = 0
report = []
for dirpath, dirs, files in os.walk(ROOT):
    for f in sorted(files):
        if not f.lower().endswith(('.xlsx', '.xls')):
            continue
        p = os.path.join(dirpath, f)
        rel = os.path.relpath(p, ROOT)
        try:
            if f.lower().endswith('.xlsx'):
                it = rows_xlsx(p)
            else:
                it = rows_xls(p)
            for name, head, n in it:
                report.append({'file': rel, 'sheet': name, 'rows': n,
                               'head': [str(x)[:12] for x in head[0]] if head else [],
                               'row2': [str(x)[:12] for x in head[1]] if len(head) > 1 else []})
        except Exception as e:
            report.append({'file': rel, 'error': str(e)[:80]})

with open(r'F:\微信开发平台\jason-v1.1\data\nsfc_inspect.json', 'w', encoding='utf-8') as fh:
    json.dump(report, fh, ensure_ascii=False, indent=1)

# 汇总：按表头签名分组
sigs = {}
for r in report:
    if 'error' in r:
        sigs.setdefault('ERROR', []).append(r['file'] + ' :: ' + r['error'])
        continue
    sig = '|'.join(r['head'])
    sigs.setdefault(sig, []).append(r['file'] + ' (' + r['sheet'] + ',' + str(r['rows']) + '行)')

for sig, files in sorted(sigs.items(), key=lambda x: -len(x[1])):
    print('=== %d 个文件: %s' % (len(files), sig))
    for x in files[:4]:
        print('   ', x)
    if len(files) > 4:
        print('    ...等 %d 个' % len(files))

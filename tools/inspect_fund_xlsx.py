# -*- coding: utf-8 -*-
"""快速盘点各 xlsx 的 sheet / 表头 / 行数 / 样例行"""
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

DIRS = [
    r'C:\Users\Administrator\Desktop\闲鱼数字资料\1991年-2026年国社科',
    r'C:\Users\Administrator\Desktop\闲鱼数字资料\教育部人文社会科学研究2020-2026',
]

for d in DIRS:
    print('=' * 70)
    print('DIR:', d)
    for f in sorted(os.listdir(d)):
        if not f.endswith('.xlsx'):
            continue
        p = os.path.join(d, f)
        try:
            wb = openpyxl.load_workbook(p, read_only=True)
            print('-' * 60)
            print('FILE:', f)
            for ws in wb.worksheets:
                print('  sheet=%r  rows=%s  cols=%s' % (ws.title, ws.max_row, ws.max_column))
                rows = ws.iter_rows(min_row=1, max_row=3, values_only=True)
                for i, r in enumerate(rows):
                    vals = [str(v)[:25] if v is not None else '' for v in r]
                    print('    row%d: %s' % (i + 1, ' | '.join(vals)))
            wb.close()
        except Exception as e:
            print('FILE:', f, 'ERROR:', e)

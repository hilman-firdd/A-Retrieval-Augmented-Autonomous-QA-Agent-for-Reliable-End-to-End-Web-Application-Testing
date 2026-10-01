#!/usr/bin/env python3
"""Mengimpor file H1-<inisial>.xlsx yang dikembalikan reviewer menjadi CSV yang dibaca analyze-hitl.js.

  python3 scripts/import-h1-xlsx.py paket-reviewer/H1-Penilaian-S.xlsx [--inisial S] [--out review]

Menulis <out>/step-ratings-<inisial>.csv dan <out>/scenario-ratings-<inisial>.csv. Menolak file yang
nilainya di luar rubrik, dan melaporkan sel yang masih kosong (tidak diisi otomatis).
"""
import argparse
import csv
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

RAQA = Path(__file__).resolve().parent.parent
ALLOWED = {
    'R1_relevance_0_1_2': {'0', '1', '2'},
    'R2_correct_yes_no_unsure': {'yes', 'no', 'unsure'},
    'R3_decision_accept_edit_reject': {'accept', 'edit', 'reject'},
    'overall_full_partial_none': {'full', 'partial', 'none'},
    'tautology_yes_no': {'yes', 'no'},
}


def cell_str(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def read_sheet(ws):
    # Kolom dicari lewat nama header, bukan posisi: reviewer bisa menyisipkan atau memindah kolom.
    rows = list(ws.iter_rows(values_only=True))
    raw_head = [cell_str(h) for h in rows[0]]
    recs = [dict(zip(raw_head, (cell_str(v) for v in r))) for r in rows[1:]]
    head = [h for h in raw_head if h]
    return head, [{h: r.get(h, '') for h in head} for r in recs if r.get('item_id')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('--inisial')
    ap.add_argument('--out', default=str(RAQA / 'review'))
    a = ap.parse_args()
    wb = load_workbook(a.xlsx, data_only=True)
    ini = a.inisial or cell_str(wb['Petunjuk']['B3'].value)
    if not re.fullmatch(r'[A-Za-z0-9]{1,8}', ini or ''):
        sys.exit('Inisial reviewer kosong/tidak valid (sel Petunjuk!B3); berikan --inisial.')
    if cell_str(wb['Petunjuk']['B8'].value).lower() != 'ya':
        print('PERINGATAN: kolom persetujuan (consent) belum "ya". Pastikan persetujuan tertulis ada sebelum memakai data ini.')

    problems, empty = [], 0
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for sheet, fname, rating_cols in [
        ('A-Langkah', f'step-ratings-{ini}.csv', ['R1_relevance_0_1_2', 'R2_correct_yes_no_unsure', 'R3_decision_accept_edit_reject', 'comment']),
        ('B-Skenario', f'scenario-ratings-{ini}.csv', ['covered_criteria_numbers', 'overall_full_partial_none', 'tautology_yes_no', 'comment']),
    ]:
        head, rows = read_sheet(wb[sheet])
        for r in rows:
            n_crit = len([x for x in r.get('acceptance_criteria', '').split('\n') if x.strip()])
            for col in rating_cols:
                v = r.get(col, '')
                if col in ALLOWED:
                    v = v.lower()
                    r[col] = v
                    if v == '':
                        empty += 1
                    elif v not in ALLOWED[col]:
                        problems.append(f'{sheet} {r["item_id"]} {col}="{v}"')
                if col == 'covered_criteria_numbers' and v:
                    if not re.fullmatch(r'\d+([,\s]+\d+)*', v):
                        problems.append(f'{sheet} {r["item_id"]} {col}="{v}" (harus nomor dipisah koma)')
                    elif any(int(x) > n_crit for x in re.split(r'[,\s]+', v)):
                        problems.append(f'{sheet} {r["item_id"]} {col}="{v}" (skenario ini hanya punya {n_crit} kriteria)')
        with open(out / fname, 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=head)
            w.writeheader()
            w.writerows(rows)
        print(f'{sheet}: {len(rows)} baris -> {out / fname}')
    if problems:
        print('\nNILAI DI LUAR RUBRIK (perbaiki bersama reviewer, jangan ditebak):')
        print('\n'.join(problems))
        sys.exit(1)
    print(f'Sel penilaian kosong: {empty} (dianalisis sebagai data hilang, tidak diisi otomatis).')


if __name__ == '__main__':
    main()

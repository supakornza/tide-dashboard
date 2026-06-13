"""
Parse tide prediction PDFs from Royal Thai Hydrographic Dept (กรมอุทกศาสตร์)
into JSON lookup table for use in Google Apps Script.

PDF layout: 4 pages × 3 months per page, each month split into 2 half-columns
(days 1-15 left, days 16-31 right). Uses pdfplumber for coordinate-aware parsing.

Output: tide_data.json with MSL-adjusted levels (gauge - DATUM_OFFSET)
"""

import re
import json
import pdfplumber
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATUM_OFFSET = 2.50  # gauge height → MSL: level_msl = gauge - DATUM_OFFSET
YEAR = 2026

PDFS = {
    'PHRA_CHULA': BASE_DIR / 'PC2026.pdf',
    'SANDON':     BASE_DIR / 'BB2026.pdf',
    'THA_CHIN':   BASE_DIR / 'TC2026.pdf',
}

# 3 months per page, 4 pages = 12 months
PAGE_MONTHS = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
]

# 6 column bands per page: (month_pair_idx, is_second_half, x_min, x_max)
# month_pair_idx 0=first month of page, 1=second, 2=third
# is_second_half: False = days 1-15, True = days 16-31
COL_BANDS = [
    (0, False,   0, 135),
    (0, True,  135, 220),
    (1, False, 220, 309),
    (1, True,  309, 393),
    (2, False, 393, 483),
    (2, True,  483, 600),
]

DOW = {'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'}

def parse_time(t):
    t = t.strip().zfill(4)
    return f"{t[:2]}:{t[2:]}"

def col_of(x):
    for i, (_, _, x_min, x_max) in enumerate(COL_BANDS):
        if x_min <= x < x_max:
            return i
    return -1

def parse_station(pdf_path):
    result = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            months = PAGE_MONTHS[page_idx]

            words = page.extract_words()
            # Keep only data area (below header rows)
            data_words = [w for w in words if w['top'] > 130]

            # Sort by row then x
            data_words.sort(key=lambda w: (round(w['top']), w['x0']))

            # Per-column state: current_day and list of (time, ht) pairs
            col_day   = [None] * 6
            col_time  = [None] * 6  # pending unpaired time
            col_data  = [{} for _ in range(6)]  # day -> [(time, ht)]

            for w in data_words:
                text = w['text']
                col = col_of(w['x0'])
                if col < 0:
                    continue

                # Skip day-of-week abbreviations
                if text in DOW:
                    continue

                # Day number (1-31)
                if re.fullmatch(r'\d{1,2}', text):
                    day = int(text)
                    if 1 <= day <= 31:
                        col_day[col] = day
                        col_time[col] = None
                    continue

                # Time HHMM (3-4 digits, no decimal)
                if re.fullmatch(r'\d{3,4}', text):
                    h = int(text.zfill(4)[:2])
                    m = int(text.zfill(4)[2:])
                    if 0 <= h <= 23 and 0 <= m <= 59:
                        col_time[col] = text
                    continue

                # Height (float)
                if re.fullmatch(r'\d+\.\d+', text):
                    day = col_day[col]
                    t   = col_time[col]
                    if day is not None and t is not None:
                        ht_msl = round(float(text) - DATUM_OFFSET, 2)
                        col_data[col].setdefault(day, []).append(
                            (parse_time(t), ht_msl)
                        )
                    col_time[col] = None
                    continue

            # Build result dates from col_data
            for col, (month_pair_idx, is_second_half, _, _) in enumerate(COL_BANDS):
                month = months[month_pair_idx]
                for day, pairs in col_data[col].items():
                    date_str = f"{YEAR}-{month:02d}-{day:02d}"
                    entries = [{'time': t, 'level': ht} for t, ht in pairs]

                    # Classify high/low: sort by level, above median = high
                    levels = sorted(e['level'] for e in entries)
                    if levels:
                        median = levels[len(levels) // 2]
                        for e in entries:
                            e['type'] = 'high' if e['level'] >= median else 'low'

                    if date_str not in result:
                        result[date_str] = sorted(entries, key=lambda e: e['time'])
                    else:
                        # Merge (shouldn't happen but guard)
                        existing_times = {e['time'] for e in result[date_str]}
                        for e in entries:
                            if e['time'] not in existing_times:
                                result[date_str].append(e)
                        result[date_str].sort(key=lambda e: e['time'])

    return result


def main():
    output = {}
    for station_key, pdf_path in PDFS.items():
        print(f"Parsing {station_key} from {pdf_path.name}...")
        data = parse_station(pdf_path)
        output[station_key] = data
        print(f"  -> {len(data)} days parsed")

        today = '2026-06-13'
        if today in data:
            print(f"  Sample {today}: {data[today]}")
        else:
            print(f"  WARNING: {today} not found")

    out_path = BASE_DIR / 'tide_data.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nSaved to {out_path}")
    for k, v in output.items():
        print(f"  {k}: {len(v)} days")


if __name__ == '__main__':
    main()

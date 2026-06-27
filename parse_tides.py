"""
Parse tide prediction MSL PDFs from Royal Thai Hydrographic Dept (กรมอุทกศาสตร์)
into JSON lookup table for use in Google Apps Script.

New MSL PDF layout (BB/PC/TC 2026msl.pdf):
  23 pages total; pages 11-22 = 12 months of data.
  Each data page: rows = days (1-31), columns = hours 0-23.
  Values are already in metres relative to MSL — no datum offset needed.

Output: tide_data.json with hourly MSL levels (24 points per day)
"""

import re
import json
import datetime
import pdfplumber
from pathlib import Path

BASE_DIR = Path(__file__).parent
YEAR = 2026

PDFS = {
    'PHRA_CHULA': BASE_DIR / 'PC2026msl.pdf',
    'SANDON':     BASE_DIR / 'BB2026msl.pdf',
    'THA_CHIN':   BASE_DIR / 'TC2026msl.pdf',
}

MONTH_NAMES = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
}

# Approximate x-centres of hour columns (hours 0-23), read from header row.
# Calibrated from PC2026msl.pdf page 11; same across all three PDFs.
HOUR_X_CENTERS = [
    84.6, 104.7, 124.7, 144.7, 164.8, 184.8, 204.9, 224.9,
    245.0, 265.0, 282.5, 302.6, 322.6, 342.7, 362.7, 382.8,
    402.8, 422.8, 442.9, 462.9, 483.0, 503.0, 523.1, 543.1,
]
HOUR_HALF_WIDTH = 12.0  # half-column width used to snap x → hour index

# Header rows end around top=220; data rows start after that
DATA_TOP_MIN = 220.0
# Day-number column x range
DAY_X_MIN, DAY_X_MAX = 36.0, 64.0


def x_to_hour(x):
    """Map an x coordinate to a 0-23 hour index, or -1 if outside range."""
    best_h, best_dist = -1, float('inf')
    for h, cx in enumerate(HOUR_X_CENTERS):
        d = abs(x - cx)
        if d < best_dist:
            best_dist, best_h = d, h
    return best_h if best_dist <= HOUR_HALF_WIDTH else -1


def parse_station(pdf_path):
    result = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            words = page.extract_words()

            # Detect month from page header words
            month = None
            for w in words:
                if w['text'] in MONTH_NAMES:
                    month = MONTH_NAMES[w['text']]
                    break
            if month is None:
                continue  # skip non-data pages

            # Filter to data area (below headers)
            data_words = [w for w in words if w['top'] > DATA_TOP_MIN]
            if not data_words:
                continue

            # Group words by row (round top to nearest 2 px)
            rows = {}
            for w in data_words:
                row_key = round(w['top'] / 2) * 2
                rows.setdefault(row_key, []).append(w)

            for row_key in sorted(rows):
                row_words = sorted(rows[row_key], key=lambda w: w['x0'])

                # First word must be a day number in DAY_X range
                first = row_words[0]
                if not (DAY_X_MIN <= first['x0'] <= DAY_X_MAX):
                    continue
                if not re.fullmatch(r'\d{1,2}', first['text']):
                    continue
                day = int(first['text'])
                if not (1 <= day <= 31):
                    continue

                # Remaining words → hourly levels
                hourly = [None] * 24
                for w in row_words[1:]:
                    if not re.fullmatch(r'-?\d+\.\d+', w['text']):
                        continue
                    h = x_to_hour(w['x0'])
                    if h < 0:
                        continue
                    if hourly[h] is None:
                        hourly[h] = round(float(w['text']), 2)

                # Build [[HH:MM, level], ...] — skip missing hours
                entries = []
                for h, lvl in enumerate(hourly):
                    if lvl is not None:
                        entries.append([f"{h:02d}:00", lvl])

                if not entries:
                    continue

                date_str = f"{YEAR}-{month:02d}-{day:02d}"
                result[date_str] = entries

    return result


def main():
    output = {}
    for station_key, pdf_path in PDFS.items():
        print(f"Parsing {station_key} from {pdf_path.name}...")
        data = parse_station(pdf_path)
        output[station_key] = data
        print(f"  -> {len(data)} days parsed")

        today = datetime.date.today().isoformat()
        if today in data:
            print(f"  Sample {today}: {data[today][:4]} ...")
        else:
            print(f"  WARNING: {today} not found")

    # Save full JSON
    out_path = BASE_DIR / 'tide_data.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nSaved to {out_path}")
    for k, v in output.items():
        print(f"  {k}: {len(v)} days")

    # Save compact JSON (same format, minified)
    compact_path = BASE_DIR / 'tide_data_compact.json'
    with open(compact_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved compact to {compact_path}")

    # Generate tide_data.gs for Google Apps Script
    gs_path = BASE_DIR / 'tide_data.gs'
    compact_json = json.dumps(output, ensure_ascii=False, separators=(',', ':'))
    gs_content = (
        "// Auto-generated by parse_tides.py — DO NOT EDIT MANUALLY\n"
        "// Source: กรมอุทกศาสตร์ กองทัพเรือ tide tables 2026 (MSL edition)\n"
        "// Format: TIDE_TABLE[station][YYYY-MM-DD] = [[HH:MM, level_msl_m], ...]\n"
        "// 24 hourly values per day; levels in metres relative to MSL\n"
        "\n"
        f"const TIDE_TABLE = {compact_json};\n"
    )
    with open(gs_path, 'w', encoding='utf-8') as f:
        f.write(gs_content)
    print(f"Saved GAS script to {gs_path}")


if __name__ == '__main__':
    main()

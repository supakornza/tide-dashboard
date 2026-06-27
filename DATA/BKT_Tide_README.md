# BKT Tide Dashboard 2026 – Google Stack Package

## Contents
- `01_Looker_Fact.csv` – main fact table for Google Sheets and Looker Studio.
- `02_Config.csv` – default site coordinate and thresholds.
- `03_Stations.csv` – station metadata and IDW weights.
- `04_Tide_Hourly_Raw.csv` – raw extracted hourly data from BB, PC, TC PDFs.
- `05_Site_Estimate_Hourly.csv` – estimated Bang Khun Thian site tide level by hour.
- `06_Daily_Summary.csv`, `07_Monthly_Summary.csv`, `08_Yearly_Summary.csv` – planning summaries.
- `09_Minute_Template_Jan1.csv` – sample minute interpolation for one day.
- `AppsScript/Code.gs`, `AppsScript/Index.html` – Google Apps Script Web App template.
- `looker_studio_setup.md` – Looker Studio setup guide.

## Default site and calculation
- Site coordinate: 13.529, 100.415 (editable)
- IDW weights: BB=0.225496, PC=0.328100, TC=0.446404
- MOVE threshold: 0.8 m
- DRY threshold: -0.3 m

## Yearly estimate summary for SITE_BKT
- Maximum: 1.722 m at 2026-01-04 08:00:00
- Minimum: -1.912 m at 2026-07-16 13:00:00
- Mean: 0.163 m
- Move window hours: 2190 h/year
- Dry work hours: 2561 h/year

## Workflow
1. Import `01_Looker_Fact.csv` to Google Sheets.
2. Rename the sheet tab to `01_Looker_Fact`.
3. Open Apps Script and paste `Code.gs` and `Index.html`.
4. Replace `PASTE_GOOGLE_SHEET_ID_HERE` and `PASTE_GOOGLE_MAPS_API_KEY_HERE`.
5. Deploy as Web App.
6. Connect Looker Studio to the Google Sheet.

## Caveat
The source tables are predictions. Actual water level can change due to wind, pressure, rainfall, river discharge, storm surge, and local mudflat/bathymetry. Calibrate with site gauge before construction control.
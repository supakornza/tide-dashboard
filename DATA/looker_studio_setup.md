# Looker Studio Setup – BKT Tide Monitoring 2026

## Data source
Use `01_Looker_Fact.csv` imported as a Google Sheet, then connect Looker Studio to that sheet.

## Required field types
- `datetime_th`: Date & Time
- `date`: Date
- `water_level_m`: Number / Metric
- `lat`: Latitude
- `lon`: Longitude
- `move_flag`, `dry_flag`: Number / Sum
- `status`, `entity_id`, `entity_type`, `month_name_th`: Dimension

## Recommended pages
1. **Overview**: Scorecards for yearly max/min, move hours, dry hours.
2. **Station Map**: Google Map using `lat` and `lon`, dimension `entity_id`.
3. **Tide Prediction Graph**: Time series `datetime_th` vs `water_level_m` with control for entity/date.
4. **Construction Windows**: Bar chart SUM(`move_flag`) and SUM(`dry_flag`) by date/month.
5. **Daily/Monthly Planning**: Table of `Daily_Summary` and `Monthly_Summary` CSVs if imported as additional sheets.

## Calculated fields
```text
Move Window = CASE WHEN water_level_m >= 0.8 THEN 1 ELSE 0 END
Dry Work Window = CASE WHEN water_level_m <= -0.3 THEN 1 ELSE 0 END
Status TH = CASE
  WHEN water_level_m >= 0.8 THEN "น้ำสูง: เคลื่อนย้ายโป๊ะ/เรือ"
  WHEN water_level_m <= -0.3 THEN "แห้ง/น้ำต่ำ: ตอกเสาเข็มช่วงท้องติดเลน"
  ELSE "ช่วงเปลี่ยนผ่าน"
END
```

## Important engineering notes
- Thresholds are placeholders. Replace with actual barge/tug draft, required under-keel clearance, mudline level, and site bathymetry.
- Use on-site tide gauge data to calibrate station-to-site offset.
- Do not use this dashboard alone for navigation or critical marine safety decisions.
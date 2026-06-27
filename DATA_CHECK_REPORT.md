# รายงานตรวจสอบข้อมูลระบบเทียบกับ Folder DATA

วันที่ตรวจ: 2026-06-16
โปรเจกต์: tide-dashboard

## 1) ไฟล์ใน Folder DATA

พบไฟล์ทั้งหมด 15 ไฟล์:

- `01_Looker_Fact.csv` — 35,040 rows, 18 columns
- `02_Config.csv` — 9 rows, 4 columns
- `03_Stations.csv` — 4 rows, 11 columns
- `04_Tide_Hourly_Raw.csv` — 26,280 rows, 15 columns
- `05_Site_Estimate_Hourly.csv` — 8,760 rows, 17 columns
- `06_Daily_Summary.csv` — 365 rows, 15 columns
- `07_Monthly_Summary.csv` — 12 rows, 12 columns
- `08_Yearly_Summary.csv` — 1 row, 10 columns
- `09_Minute_Template_Jan1.csv` — 1,440 rows, 6 columns
- `10_Looker_Fields.csv` — 12 rows, 4 columns
- `BKT_Tide_Dashboard_2026_Summary.xlsx`
- `AppsScript_Code.gs`
- `AppsScript_Index.html`
- `BKT_Tide_README.md`
- `looker_studio_setup.md`

## 2) ค่า Config จาก DATA เทียบกับระบบปัจจุบัน

แหล่งข้อมูล: `DATA/02_Config.csv`, `DATA/03_Stations.csv`, `Code.gs`, `index.html`

| รายการ | ค่าใน DATA | ค่าในระบบปัจจุบัน | สถานะ |
|---|---:|---:|---|
| Site lat | 13.529 | 13.529 | ตรงกัน |
| Site lon | 100.415 | 100.415 | ตรงกัน |
| MOVE threshold | 0.80 m | 0.80 m | ตรงกัน |
| DRY threshold | -0.30 m | -0.30 m | ตรงกัน |
| caution margin | 0.15 m | 0.15 m | ตรงกัน |
| timezone | Asia/Bangkok | Asia/Bangkok ใน UI/server date logic | ตรงกัน |

## 3) พิกัดสถานีจาก DATA เทียบกับระบบปัจจุบัน

| Station | DATA lat/lon | ระบบปัจจุบัน | สถานะ |
|---|---|---|---|
| BB / SANDON | 13.450278, 100.595278 | 13.450278, 100.595278 | ตรงกัน |
| PC / PHRA_CHULA | 13.553333, 100.576944 | 13.553333, 100.576944 | ตรงกัน |
| TC / THA_CHIN | 13.517778, 100.275 | 13.517778, 100.275 | ตรงกัน |
| SITE_BKT | 13.529, 100.415 | ใช้เป็น project marker ใน `index.html` | ตรงกัน |

## 4) ตรวจสอบข้อมูลระดับน้ำ

### 4.1 `DATA/04_Tide_Hourly_Raw.csv` vs `tide_data.json`

- ตรวจทั้งหมด: 26,280 จุดข้อมูล = 3 สถานี × 365 วัน × 24 ชั่วโมง
- Missing date: 0
- Mismatch: 0
- สรุป: `tide_data.json` ตรงกับ raw hourly data ใน `DATA/04_Tide_Hourly_Raw.csv` ครบถ้วน

### 4.1.1 `tide_data.gs` vs `tide_data.json`

- ผลตรวจ: ตรงกัน 100%
- Coverage: PHRA_CHULA, SANDON, THA_CHIN อย่างละ 365 วัน ตั้งแต่ 2026-01-01 ถึง 2026-12-31
- สรุป: ไฟล์ที่ Apps Script ใช้ (`tide_data.gs`) ตรงกับ JSON source แล้ว

Mapping ที่ใช้ตรวจ:

- BB → SANDON
- PC → PHRA_CHULA
- TC → THA_CHIN

### 4.2 `DATA/05_Site_Estimate_Hourly.csv` IDW validation

- ตรวจทั้งหมด: 8,760 จุดข้อมูล = 365 วัน × 24 ชั่วโมง
- สูตรตรวจ: `SITE_BKT = BB*0.225496 + PC*0.328100 + TC*0.446404`
- Mismatch: 0
- สรุป: site estimate คำนวณถูกต้องตาม IDW weights

### 4.3 `DATA/06_Daily_Summary.csv` vs `DATA/05_Site_Estimate_Hourly.csv`

- ตรวจทั้งหมด: 365 วัน
- ตรวจค่า max/min/mean รายวัน
- Mismatch: 0
- สรุป: Daily summary ตรงกับ hourly site estimate

## 5) สถานะการใช้งานข้อมูลในระบบปัจจุบัน

ระบบปัจจุบันใช้ข้อมูลหลักดังนี้:

- `Code.gs` + `tide_data.gs` / `tide_data.json`
- แสดง 3 สถานีหลัก: PHRA_CHULA, SANDON, THA_CHIN
- ใช้ threshold/pิกัดจาก DATA แล้ว
- ใช้พิกัดหน้างาน SITE_BKT เป็น marker บนแผนที่แล้ว

แต่ระบบปัจจุบันยังไม่ได้ใช้ข้อมูลเหล่านี้โดยตรง:

- `DATA/05_Site_Estimate_Hourly.csv` — ระดับน้ำประเมินที่หน้างาน SITE_BKT รายชั่วโมง
- `DATA/06_Daily_Summary.csv` — summary รายวันของ SITE_BKT
- `DATA/07_Monthly_Summary.csv` — summary รายเดือนของ SITE_BKT
- `DATA/08_Yearly_Summary.csv` — summary รายปีของ SITE_BKT
- `DATA/01_Looker_Fact.csv` — fact table รวม BB/PC/TC/SITE_BKT สำหรับ Google Sheets / Looker Studio

## 6) ประเด็นสำคัญที่พบ

1. ข้อมูลสถานีในระบบ (`tide_data.json`) ถูกต้องและตรงกับ DATA แล้ว
2. Threshold และพิกัดที่เคยแก้ล่าสุดใน `Code.gs` / `index.html` ตรงกับ DATA แล้ว
3. DATA มีชุดข้อมูล SITE_BKT ที่คำนวณด้วย IDW แล้ว แต่ระบบ Dashboard ปัจจุบันยังไม่ได้มี entity/station `SITE_BKT` ให้เลือกเป็นสถานีหลัก
4. `DATA/AppsScript_Code.gs` เป็น template อีกแนวทางหนึ่งที่อ่านจาก Google Sheet (`01_Looker_Fact`) โดยตรง แต่ระบบหลักปัจจุบันเป็นแบบฝังข้อมูลใน `tide_data.gs`

## 7) คำแนะนำต่อไป

ถ้าต้องการให้ Dashboard ใช้ข้อมูลหน้างานจริงตาม DATA ให้เพิ่ม `SITE_BKT` เข้าในระบบหลัก โดยมีทางเลือก:

### ทางเลือก A — ใช้ `SITE_BKT` จาก IDW ใน Apps Script โดยคำนวณจาก 3 สถานี

- เพิ่มสถานี `SITE_BKT` ใน `CONFIG.STATIONS`
- เพิ่มฟังก์ชันคำนวณ `getSiteEstimateTideData(dateStr)` จาก BB/PC/TC ด้วย idwWeight
- เพิ่ม tab/การ์ด `SITE_BKT` ใน `index.html`
- ข้อดี: ไม่ต้องฝัง CSV ใหญ่เพิ่ม ใช้ `tide_data.gs` เดิม

### ทางเลือก B — ใช้ `01_Looker_Fact.csv` ผ่าน Google Sheet ตาม template ใน DATA

- Import `01_Looker_Fact.csv` ไป Google Sheets
- ใช้ `DATA/AppsScript_Code.gs` เป็นฐาน
- ข้อดี: เหมาะกับ Looker Studio และแก้ข้อมูลใน Sheet ได้ง่าย
- ข้อควรระวัง: ต้องตั้งค่า Spreadsheet ID และอาจช้ากว่าแบบฝังข้อมูล

ข้อแนะนำ: สำหรับ Dashboard ปัจจุบัน แนะนำทางเลือก A เพราะเข้ากับโค้ดเดิมที่สุดและไม่เพิ่ม dependency ภายนอก

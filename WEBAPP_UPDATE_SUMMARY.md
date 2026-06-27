# Web App Update Summary — BKT Tide Dashboard

วันที่อัพเดท: 2026-06-16

## เป้าหมาย

พัฒนา Tide Dashboard เดิมให้ใช้ข้อมูลจาก Folder `DATA` ได้ครบขึ้น โดยเฉพาะ `SITE_BKT` ซึ่งเป็นระดับน้ำประเมินหน้างานบางขุนเทียนจาก IDW weights ของ 3 สถานี BB/PC/TC

## ไฟล์ที่แก้ไข

- `Code.gs`
- `index.html`

## Backend / API routes ใน Google Apps Script

เพิ่ม/ปรับปรุงใน `Code.gs`:

1. เพิ่ม station/entity ใหม่:
   - `SITE_BKT`
   - พิกัด: `13.529, 100.415`
   - ชื่อ: `พื้นที่ป่าชายเลนบางขุนเทียน`
   - data source: IDW estimate

2. เพิ่ม helper functions:
   - `resolveStationTideData(dateStr, stationKey, allowReal)`
   - `getSiteEstimateTideData(dateStr)`
   - `getTideDataForStation(dateStr, stationKey, allowReal)`
   - `getClosestLevel(tideData, datetime)`
   - `getTideStatus(tideData, currentLevel, datetime)`

3. API ที่รองรับ `SITE_BKT` แล้ว:
   - `getDashboardData(dateStr)`
   - `getRealtimeData()`
   - `getWeeklyForecast(baseDateStr)`
   - `getMonthlyTideTable(yearMonth, stationKey)`
   - `getMultiDayChart(startDate, numDays, stationKey)`
   - `getDailyAggregates(startDate, numDays, stationKey)`
   - `getMonthlyAggregates(year, stationKey)`

4. สูตร IDW:

```text
SITE_BKT = BB*0.225496 + PC*0.328100 + TC*0.446404
```

ค่าถ่วงน้ำหนักมาจาก `DATA/03_Stations.csv`

## Frontend / UI

เพิ่ม/ปรับปรุงใน `index.html`:

1. ตั้งค่า default station เป็น `SITE_BKT`
2. เพิ่ม tab ใหม่ `หน้างาน BKT`
3. อัพเดท tab mapping ให้รองรับ 4 entity:
   - SITE_BKT
   - PHRA_CHULA
   - SANDON
   - THA_CHIN
4. เพิ่ม data source label:
   - `📍 ประเมินหน้างาน IDW`
5. กล่องข้อมูลสถานีแสดง:
   - พิกัด SITE_BKT
   - แหล่งข้อมูล IDW estimate จาก 3 สถานี
6. อัพเดท polygon บนแผนที่ให้ครอบรอบพิกัด SITE_BKT จริง ไม่ใช่พิกัดเดิม

## Validation ที่รันแล้ว

1. Syntax check

- `Code.gs` ผ่าน `node --check` หลัง copy เป็น `.js`
- inline JavaScript ใน `index.html` ผ่าน `node --check`

2. Runtime logic check ด้วย Node VM mock สำหรับ Apps Script

ผลลัพธ์:

```text
SITE_BKT source: idw
SITE_BKT points: 48
SITE_BKT first hourly:
00:00 = -0.189
01:00 = 0.200
02:00 = 0.600
Station count: PHRA_CHULA,SANDON,THA_CHIN,SITE_BKT
```

ค่าแรกตรงกับ `DATA/05_Site_Estimate_Hourly.csv` สำหรับวันที่ 2026-01-01

## หมายเหตุเรื่อง Auth / Database

โปรเจกต์นี้เป็น Google Apps Script Web App และใช้ data embedded ผ่าน `tide_data.gs` / calculation functions ไม่ใช่ full-stack app แบบมี database server แยก ดังนั้นส่วนที่เทียบเท่าในระบบนี้คือ:

- Database/data source: `tide_data.gs`, `tide_data.json`, และ DATA CSV package
- API routes: server functions ใน `Code.gs` ที่เรียกผ่าน `google.script.run`
- Authentication/Authorization: ขึ้นกับ Deployment setting ของ Google Apps Script และสิทธิ์บัญชี Google ไม่ได้เพิ่มระบบ login แยก เพื่อไม่เพิ่ม feature นอก scope

## ขั้นตอนถัดไป

หลังแก้ไฟล์ local แล้ว ต้อง deploy/push ไป Google Apps Script เพื่อให้เว็บ live อัพเดท:

```bash
clasp push
```

จากนั้น Deploy > Manage deployments > Edit > New version

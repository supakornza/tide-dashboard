/**
 * ============================================================
 * TIDE MONITOR DASHBOARD — Bang Khun Thian Coastal Project
 * ระบบติดตามระดับน้ำขึ้น-น้ำลง โครงการป้องกันการกัดเซาะชายฝั่ง
 * บางขุนเทียน กรุงเทพมหานคร
 * ============================================================
 * 
 * สถานีอ้างอิง:
 * - ป้อมพระจุลจอมเกล้า (Phra Chulachomklao Fort)
 * - สันดอน ปากแม่น้ำเจ้าพระยา (Sandon, Chao Phraya River Mouth)
 * - ปากแม่น้ำท่าจีน (Tha Chin River Mouth)
 * 
 * ข้อมูลจำลองตามรูปแบบจริงของกรมอุทกศาสตร์ กองทัพเรือ
 * ประจำปี พ.ศ. 2569 (2026)
 * 
 * วิธีใช้งาน:
 * 1. สร้าง Google Apps Script (New Project)
 * 2. สร้างไฟล์ Code.gs, index.html, tide_data.gs
 * 3. Deploy > New Deployment > Web App
 * 4. เปิด URL ที่ได้รับ
 * ============================================================
 */

// ============ CONFIGURATION ============
const CONFIG = {
  PROJECT_NAME: "โครงการป้องกันและแก้ไขปัญหาการกัดเซาะชายฝั่งทะเลบางขุนเทียน",
  // พิกัดหน้างาน BKT — อัพเดทจาก BKT_Tide_Dashboard_2026_Summary.xlsx (Sheet: Config)
  LOCATION: {
    name: "บางขุนเทียน, กรุงเทพมหานคร",
    lat: 13.529,   // was 13.5421
    lng: 100.415   // was 100.2758
  },
  // พิกัดสถานี — อัพเดทจาก Sheet: Stations (WGS84 ทศนิยม 6 ตำแหน่ง)
  STATIONS: {
    PHRA_CHULA: {
      name: "ป้อมพระจุลจอมเกล้า",
      nameEn: "Phra Chunlachomklao Fort (Samut Prakan)",
      lat: 13.553333,   // was 13.5521
      lng: 100.576944,  // was 100.5785
      msl: 0.85,
      unit: "MSL",
      idwWeight: 0.3281  // IDW weight for BKT site estimation
    },
    SANDON: {
      name: "สันดอนเจ้าพระยา",
      nameEn: "Bangkok Bar (Samut Prakan)",
      lat: 13.450278,   // was 13.4386
      lng: 100.595278,  // was 100.5960
      msl: 0.72,
      unit: "MSL",
      idwWeight: 0.225496
    },
    THA_CHIN: {
      name: "ปากน้ำท่าจีน",
      nameEn: "Pak Nam Tha Chin (Samut Sakhon)",
      lat: 13.517778,   // was 13.5306
      lng: 100.275,     // was 100.2750
      msl: 0.68,
      unit: "MSL",
      idwWeight: 0.446404
    },
    SITE_BKT: {
      name: "พื้นที่ป่าชายเลนบางขุนเทียน",
      nameEn: "Bang Khun Thian Mangrove Coast (IDW estimate)",
      lat: 13.529,
      lng: 100.415,
      msl: 0.0,
      unit: "MSL",
      isEstimatedSite: true,
      sourceStations: ["SANDON", "PHRA_CHULA", "THA_CHIN"]
    }
  },
  // ค่าน้ำขึ้นน้ำลงเฉลี่ย (Harmonic Constants แบบ simplified)
  // หน่วย: เมตรจาก MSL
  TIDE_AMPLITUDE: {
    M2: 0.65,   // Principal lunar semi-diurnal
    S2: 0.22,   // Principal solar semi-diurnal
    K1: 0.18,   // Lunar diurnal
    O1: 0.14    // Lunar diurnal
  },
  // ความถี่ (radians per hour)
  TIDE_FREQUENCY: {
    M2: 0.5058,
    S2: 0.5236,
    K1: 0.2625,
    O1: 0.2433
  },
  // Phase lag (radians) — ปรับตามสถานี
  PHASE: {
    PHRA_CHULA: { M2: 0.8, S2: 1.2, K1: 2.1, O1: 1.8 },
    SANDON:    { M2: 0.9, S2: 1.3, K1: 2.2, O1: 1.9 },
    THA_CHIN:  { M2: 1.0, S2: 1.4, K1: 2.3, O1: 2.0 }
  },
  // ช่วงเวลาแนะนำเข้างาน — อัพเดทจาก BKT_Tide_Dashboard_2026_Summary.xlsx (Sheet: Config)
  // move_threshold_m = 0.8 (เคลื่อนย้าย tug/barge/crane)
  // dry_threshold_m  = -0.3 (แห้ง/ท้องติดเลน)
  // caution_margin_m = 0.15 (ส่วนเผื่อเตือนล่วงหน้า)
  WORK_WINDOW: {
    minTideLevel: -0.30,  // dry threshold (was -0.3, unchanged)
    maxTideLevel: 0.80,   // MOVE threshold — was 0.5, now 0.8 per xlsx
    cautionMargin: 0.15,  // warn this many metres before hitting threshold (new)
    advanceHours: 2       // แจ้งเตือนล่วงหน้า (ชั่วโมง)
  },
  // API จริงจากกรมเจ้าท่า
  // DataLevelWater = gauge height (ม. จาก datum ของสถานี)
  // ต้องลบ datum offset เพื่อให้ได้ค่า MSL
  // ปรับค่า DATUM_MD05 ให้ตรงกับ benchmark จริงของสถานี
  REAL_STATIONS: {
    THA_CHIN: { code: 'MD05', datumOffset: 2.50 }
  },
  MD_API_URL: 'https://hydro.md.go.th/Services/ServicesMD.asmx/GetDataReportchart',

  // ============ Port Monitoring API (ป้อมพระจุลจอมเกล้า) ============
  // ใช้เป็นแหล่งข้อมูลจริงสำหรับ PHRA_CHULA
  PORT_MONITORING: {
    base_url: 'http://203.147.59.19:3001',
    station_id: 38,   // ป้อมพระจุลจอมเกล้า
  }
};

// ============ MAIN ENTRY POINTS ============

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Tide Monitor — Bang Khun Thian')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============ TIDE CALCULATION ============

/**
 * คำนวณระดับน้ำที่เวลาใดๆ ด้วย Harmonic Method (simplified)
 * @param {Date} datetime - วันเวลาที่ต้องการ
 * @param {string} stationKey - คีย์สถานี (PHRA_CHULA, SANDON, THA_CHIN)
 * @returns {number} ระดับน้ำ (เมตรจาก MSL)
 */
function calculateTideLevel(datetime, stationKey) {
  const station = CONFIG.STATIONS[stationKey];
  const phase = CONFIG.PHASE[stationKey];
  const t = datetime.getTime() / 3600000; // hours since epoch
  
  let level = station.msl;
  
  // Harmonic constituents
  level += CONFIG.TIDE_AMPLITUDE.M2 * Math.cos(CONFIG.TIDE_FREQUENCY.M2 * t - phase.M2);
  level += CONFIG.TIDE_AMPLITUDE.S2 * Math.cos(CONFIG.TIDE_FREQUENCY.S2 * t - phase.S2);
  level += CONFIG.TIDE_AMPLITUDE.K1 * Math.cos(CONFIG.TIDE_FREQUENCY.K1 * t - phase.K1);
  level += CONFIG.TIDE_AMPLITUDE.O1 * Math.cos(CONFIG.TIDE_FREQUENCY.O1 * t - phase.O1);
  
  return Math.round(level * 100) / 100;
}

/**
 * สร้างข้อมูลน้ำขึ้นน้ำลงทั้งวัน
 * @param {string} dateStr - วันที่ (YYYY-MM-DD)
 * @param {string} stationKey - คีย์สถานี
 * @returns {Array} ข้อมูลระดับน้ำทุก 30 นาที
 */
function getTideDataForDate(dateStr, stationKey) {
  const data = [];
  const baseDate = new Date(dateStr + 'T00:00:00+07:00');
  
  for (let i = 0; i < 48; i++) { // 48 ช่วงใน 1 วัน (ทุก 30 นาที)
    const dt = new Date(baseDate.getTime() + i * 30 * 60000);
    const level = calculateTideLevel(dt, stationKey);
    data.push({
      time: Utilities.formatDate(dt, 'Asia/Bangkok', 'HH:mm'),
      datetime: dt.toISOString(),
      level: level,
      hour: dt.getHours() + dt.getMinutes() / 60
    });
  }
  
  return data;
}

/**
 * หาช่วงเวลาน้ำขึ้นสูงสุดและน้ำลงต่ำสุด
 * @param {Array} tideData - ข้อมูลน้ำขึ้นน้ำลง
 * @returns {Object} ข้อมูลน้ำขึ้น/น้ำลงสำคัญ
 */
function findHighLowTide(tideData) {
  let highTides = [];
  let lowTides = [];
  
  for (let i = 1; i < tideData.length - 1; i++) {
    const prev = tideData[i - 1].level;
    const curr = tideData[i].level;
    const next = tideData[i + 1].level;
    
    if (curr > prev && curr > next) {
      highTides.push({ time: tideData[i].time, level: curr });
    }
    if (curr < prev && curr < next) {
      lowTides.push({ time: tideData[i].time, level: curr });
    }
  }
  
  return { highTides, lowTides };
}

/**
 * หาช่วงเวลาแนะนำสำหรับเข้างาน
 * @param {Array} tideData - ข้อมูลน้ำขึ้นน้ำลง
 * @returns {Array} ช่วงเวลาที่แนะนำ
 */
function findWorkWindows(tideData) {
  const windows = [];
  const minLevel = CONFIG.WORK_WINDOW.minTideLevel;   // -0.30 ม. (dry threshold)
  const maxLevel = CONFIG.WORK_WINDOW.maxTideLevel;   // 0.80 ม. (MOVE threshold)
  const caution  = CONFIG.WORK_WINDOW.cautionMargin;  // 0.15 ม.
  
  let inWindow = false;
  let windowStart = null;
  
  for (let i = 0; i < tideData.length; i++) {
    const level = tideData[i].level;
    const isWorkable = level >= minLevel && level <= maxLevel;
    
    if (isWorkable && !inWindow) {
      inWindow = true;
      windowStart = tideData[i].time;
    } else if (!isWorkable && inWindow) {
      inWindow = false;
      windows.push({
        start: windowStart,
        end: tideData[i - 1].time,
        duration: calculateDuration(windowStart, tideData[i - 1].time)
      });
    }
  }
  
  if (inWindow) {
    windows.push({
      start: windowStart,
      end: tideData[tideData.length - 1].time,
      duration: calculateDuration(windowStart, tideData[tideData.length - 1].time)
    });
  }
  
  return windows;
}

function calculateDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff < 0 ? diff + 1440 : diff; // handle cross-midnight
}

// ============ TIDE TABLE LOOKUP (กรมอุทกศาสตร์ 2026) ============

/**
 * สร้างข้อมูล 48 จุด (ทุก 30 นาที) โดย interpolation จากตารางน้ำ MSL จริง
 * รองรับทั้ง format เก่า (high/low 2-4 จุด) และ format ใหม่ (hourly 24 จุด)
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} stationKey - PHRA_CHULA | SANDON | THA_CHIN
 * @returns {Array|null} tideData array หรือ null ถ้าไม่มีข้อมูลในตาราง
 */
function getTideDataFromTable(dateStr, stationKey) {
  if (typeof TIDE_TABLE === 'undefined') return null;
  const dayRaw = (TIDE_TABLE[stationKey] || {})[dateStr];
  if (!dayRaw || dayRaw.length === 0) return null;

  // Parse [HH:MM, level] → {mins, level}
  const pts = dayRaw.map(function(p) {
    const parts = p[0].split(':');
    return { mins: parseInt(parts[0]) * 60 + parseInt(parts[1]), level: p[1] };
  }).sort(function(a, b) { return a.mins - b.mins; });

  // ใช้ cosine interpolation สำหรับ high/low data (≤6 จุด)
  // ใช้ linear interpolation สำหรับ hourly data (>6 จุด) เพื่อความแม่นยำ
  const useLinear = pts.length > 6;

  const tideData = [];
  for (let i = 0; i < 48; i++) {
    const slotMins = i * 30;
    const h = Math.floor(slotMins / 60);
    const m = slotMins % 60;
    const timeStr = (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);

    let level;
    let before = null, after = null;
    for (let j = 0; j < pts.length; j++) {
      if (pts[j].mins <= slotMins) before = pts[j];
      else if (!after) { after = pts[j]; break; }
    }

    if (!before && after) {
      level = after.level;
    } else if (!after && before) {
      level = before.level;
    } else if (useLinear) {
      // Linear interpolation สำหรับ hourly data
      const ratio = (slotMins - before.mins) / (after.mins - before.mins);
      level = Math.round((before.level + ratio * (after.level - before.level)) * 100) / 100;
    } else {
      // Cosine interpolation: zero slope at each tide extremum (เหมาะกับ high/low data)
      const ratio = (slotMins - before.mins) / (after.mins - before.mins);
      const cosRatio = (1 - Math.cos(Math.PI * ratio)) / 2;
      level = Math.round((before.level + cosRatio * (after.level - before.level)) * 100) / 100;
    }

    tideData.push({ time: timeStr, level: level, hour: h + m / 60 });
  }
  return tideData;
}

// ============ REAL DATA FETCH (กรมเจ้าท่า MD05) ============

/**
 * ดึงข้อมูลจริงจาก API กรมเจ้าท่า แปลงเป็น tideData format เดียวกับ harmonic
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} stationCode - เช่น 'MD05'
 * @param {number} datumOffset - ค่า gauge datum (ม.) ที่ต้องลบออกเพื่อให้ได้ MSL
 * @returns {Array|null} tideData array หรือ null ถ้า API ล้มเหลว
 */
function fetchRealTideData(dateStr, stationCode, datumOffset) {
  try {
    const dt = new Date(dateStr + 'T00:00:00+07:00');
    const dd = Utilities.formatDate(dt, 'Asia/Bangkok', 'dd');
    const mm = Utilities.formatDate(dt, 'Asia/Bangkok', 'MM');
    const yyyy = Utilities.formatDate(dt, 'Asia/Bangkok', 'yyyy');
    const dateFormatted = dd + '/' + mm + '/' + yyyy;

    const payload = 'codestation=' + stationCode +
      '&fromdate=' + dateFormatted +
      '&todate=' + dateFormatted +
      '&display=';

    const response = UrlFetchApp.fetch(CONFIG.MD_API_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('fetchRealTideData: HTTP ' + response.getResponseCode() + ' for station ' + stationCode);
      return null;
    }

    const raw = JSON.parse(response.getContentText());
    if (!Array.isArray(raw) || raw.length === 0) return null;

    // แปลงจาก gauge height → MSL และ downsample เป็นทุก 30 นาที
    const byTime = {};
    raw.forEach(function(r) {
      const timeParts = r.DataTime.split(':');
      const h = parseInt(timeParts[0]);
      const m = parseInt(timeParts[1]);
      const slot = h * 60 + m;
      // เก็บแค่ช่วง 00, 30 นาที
      const rounded = Math.round(slot / 30) * 30;
      if (!byTime[rounded]) {
        byTime[rounded] = parseFloat(r.DataLevelWater) - datumOffset;
      }
    });

    const tideData = [];
    for (let i = 0; i < 48; i++) {
      const totalMins = i * 30;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const timeStr = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
      const level = byTime[totalMins] !== undefined
        ? Math.round(byTime[totalMins] * 100) / 100
        : null; // null = ยังไม่มีข้อมูล (อนาคต)
      tideData.push({ time: timeStr, level: level, hour: h + m / 60, isReal: true });
    }

    // เติมค่า null ด้วย interpolation เชิงเส้น
    for (let i = 0; i < tideData.length; i++) {
      if (tideData[i].level === null) {
        const prev = tideData.slice(0, i).reverse().find(function(d) { return d.level !== null; });
        const next = tideData.slice(i + 1).find(function(d) { return d.level !== null; });
        if (prev && next) {
          const prevIdx = tideData.indexOf(prev);
          const nextIdx = tideData.indexOf(next);
          const ratio = (i - prevIdx) / (nextIdx - prevIdx);
          tideData[i].level = Math.round((prev.level + ratio * (next.level - prev.level)) * 100) / 100;
        } else if (prev) {
          tideData[i].level = prev.level;
        } else if (next) {
          tideData[i].level = next.level;
        }
      }
    }

    return tideData;
  } catch (e) {
    Logger.log('fetchRealTideData error: ' + e.message);
    return null;
  }
}

// ============ PORT MONITORING API (ป้อมพระจุลจอมเกล้า) ============

/**
 * ดึงระดับน้ำล่าสุดจาก Port Monitoring API (/stations/{id})
 * @param {number} stationId - รหัสสถานี (38 = ป้อมพระจุลจอมเกล้า)
 * @returns {{level: number, time: string, source: string}|null}
 */
function fetchPortMonitoringLatest(stationId) {
  try {
    const url = CONFIG.PORT_MONITORING.base_url + '/stations/' + stationId;
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('fetchPortMonitoringLatest: HTTP ' + response.getResponseCode());
      return null;
    }

    const data = JSON.parse(response.getContentText());
    if (!data || !data.sensors || data.sensors.length === 0) return null;

    // sensor[0] = ป้อมพระจุล → parameters → find parameter with unit 'ม.' (water level)
    const sensor = data.sensors[0];
    if (!sensor.parameters || sensor.parameters.length === 0) return null;

    let waterParam = null;
    for (let i = 0; i < sensor.parameters.length; i++) {
      if (sensor.parameters[i].unit && sensor.parameters[i].unit.includes('ม.')) {
        waterParam = sensor.parameters[i];
        break;
      }
    }
    if (!waterParam) waterParam = sensor.parameters[0];

    const latestData = waterParam.data;
    if (!latestData || latestData.length === 0) return null;

    // data[-1] = ล่าสุด
    const lastReading = latestData[latestData.length - 1];
    const level = parseFloat(lastReading.value);
    if (isNaN(level)) return null;

    return {
      level: Math.round(level * 100) / 100,
      time: lastReading.time || '',
      source: 'port_monitoring'
    };
  } catch (e) {
    Logger.log('fetchPortMonitoringLatest error: ' + e.message);
    return null;
  }
}

/**
 * ดึงข้อมูลประวัติ (/history/{id}?hours=N) แปลงเป็น tideData format
 * @param {number} stationId
 * @param {number} hours - ช่วงเวลาย้อนหลัง (1, 6, 12, 24)
 * @returns {Array|null} tideData array หรือ null
 */
function fetchPortMonitoringHistory(stationId, hours) {
  try {
    const url = CONFIG.PORT_MONITORING.base_url + '/history/' + stationId + '?hours=' + hours;
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) return null;

    const data = JSON.parse(response.getContentText());
    if (!data || !data.chartDataPoints || data.chartDataPoints.length === 0) return null;

    // หา water level parameter (unit มี 'ม.')
    let waterParam = null;
    for (let i = 0; i < data.chartDataPoints.length; i++) {
      if (data.chartDataPoints[i].parameter &&
          data.chartDataPoints[i].parameter.includes('ม.')) {
        waterParam = data.chartDataPoints[i];
        break;
      }
    }
    // fallback: ตัวแรกที่มี data
    if (!waterParam) {
      for (let i = 0; i < data.chartDataPoints.length; i++) {
        if (data.chartDataPoints[i].data && data.chartDataPoints[i].data.length > 0) {
          waterParam = data.chartDataPoints[i];
          break;
        }
      }
    }
    if (!waterParam || !waterParam.data || waterParam.data.length === 0) return null;

    // แปลงเป็น tideData format
    const tideData = [];
    const pts = waterParam.data;

    // ถ้า hours >= 24 ใช้ทุกจุดข้อมูล, ถ้า < 24 downsample เป็นทุก 30 นาที
    if (hours <= 6) {
      // สqueeze เป็น 30-min slots สำหรับ timeframe สั้น
      const byLabel = {};
      pts.forEach(function(p) {
        if (p.y !== null && p.y !== undefined && p.label) {
          // เก็บค่าล่าสุดของแต่ละ label
          byLabel[p.label] = parseFloat(p.y);
        }
      });

      const slots = {};
      Object.keys(byLabel).sort().forEach(function(label) {
        const timeMatch = label.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const slotMins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
          const rounded = Math.round(slotMins / 30) * 30;
          if (!slots[rounded]) slots[rounded] = byLabel[label];
        }
      });

      for (let i = 0; i < 48; i++) {
        const totalMins = i * 30;
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const timeStr = (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
        const level = slots[totalMins] !== undefined ? Math.round(slots[totalMins] * 100) / 100 : null;
        tideData.push({ time: timeStr, level: level, hour: h + m / 60, isReal: true });
      }
    } else {
      // timeframe ยาว (12-24h): ใช้ทุกจุดข้อมูล
      pts.forEach(function(p) {
        if (p.y !== null && p.y !== undefined && p.label) {
          const timeMatch = p.label.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            tideData.push({
              time: (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m),
              level: Math.round(parseFloat(p.y) * 100) / 100,
              hour: h + m / 60,
              isReal: true
            });
          }
        }
      });
    }

    return tideData.length > 0 ? tideData : null;
  } catch (e) {
    Logger.log('fetchPortMonitoringHistory error: ' + e.message);
    return null;
  }
}

// ============ DATA SOURCE RESOLUTION ============

/**
 * ดึงข้อมูล tideData ของสถานีจริง โดยเรียงลำดับ: real API → table 2026 → harmonic fallback
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} stationKey - PHRA_CHULA | SANDON | THA_CHIN
 * @param {boolean} allowReal - ใช้ real API หรือไม่ (SITE_BKT ใช้ false เพื่อให้ตรงกับ DATA/IDW 2026)
 * @returns {{tideData:Array, dataSource:string}}
 */
function resolveStationTideData(dateStr, stationKey, allowReal) {
  let tideData = null;
  let dataSource = 'simulated';

  // Port Monitoring API สำหรับ PHRA_CHULA — แหล่งข้อมูลจริงระดับแรก
  if (stationKey === 'PHRA_CHULA' && allowReal) {
    const latest = fetchPortMonitoringLatest(CONFIG.PORT_MONITORING.station_id);
    let historyHours = 24;
    // ทดลองดึง history ตาม timeframe ที่มีข้อมูล
    tideData = fetchPortMonitoringHistory(CONFIG.PORT_MONITORING.station_id, historyHours);
    if (!tideData) tideData = fetchPortMonitoringHistory(CONFIG.PORT_MONITORING.station_id, 12);
    if (!tideData) tideData = fetchPortMonitoringHistory(CONFIG.PORT_MONITORING.station_id, 6);
    if (tideData && latest) {
      // เติม latest reading เป็นจุดแรก (ถ้า time ยังไม่มีในวันนี้)
      const todayStr = dateStr.replace(/-/g, '/');
      if (!latest.time || latest.time.indexOf(todayStr) < 0) {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        tideData.unshift({
          time: h + ':' + m,
          level: latest.level,
          hour: now.getHours() + now.getMinutes() / 60,
          isReal: true
        });
      }
      dataSource = 'port_monitoring';
    } else if (latest && !tideData) {
      // มีข้อมูลล่าสุดแต่ไม่มี history → สร้าง tideData จากค่าเดียว
      const level = latest.level;
      tideData = [];
      for (let i = 0; i < 48; i++) {
        const totalMins = i * 30;
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const timeStr = (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
        tideData.push({ time: timeStr, level: i === 0 ? level : null, hour: h + m / 60, isReal: true });
      }
      dataSource = 'port_monitoring';
    }
  }

  const realCfg2 = CONFIG.REAL_STATIONS[stationKey];
  if (!tideData && allowReal && realCfg2) {
    tideData = fetchRealTideData(dateStr, realCfg2.code, realCfg2.datumOffset);
    if (tideData) dataSource = 'real';
  }

  if (!tideData) {
    tideData = getTideDataFromTable(dateStr, stationKey);
    if (tideData) dataSource = 'table';
  }

  if (!tideData) {
    tideData = getTideDataForDate(dateStr, stationKey);
  }

  return { tideData: tideData, dataSource: dataSource };
}

/**
 * คำนวณระดับน้ำประเมินหน้างาน SITE_BKT ด้วย IDW weights จาก DATA/03_Stations.csv
 * สูตรตรวจแล้วตรงกับ DATA/05_Site_Estimate_Hourly.csv
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Array} tideData 48 จุดทุก 30 นาที
 */
function getSiteEstimateTideData(dateStr) {
  const sourceKeys = CONFIG.STATIONS.SITE_BKT.sourceStations;
  const sourceData = {};
  sourceKeys.forEach(function(key) {
    sourceData[key] = resolveStationTideData(dateStr, key, false).tideData;
  });

  const result = [];
  for (let i = 0; i < 48; i++) {
    let weighted = 0;
    let weightSum = 0;
    let sample = null;
    sourceKeys.forEach(function(key) {
      const station = CONFIG.STATIONS[key];
      const point = sourceData[key][i];
      if (point && typeof point.level === 'number') {
        weighted += point.level * station.idwWeight;
        weightSum += station.idwWeight;
        if (!sample) sample = point;
      }
    });
    result.push({
      time: sample ? sample.time : String(Math.floor(i / 2)).padStart(2, '0') + (i % 2 ? ':30' : ':00'),
      level: weightSum > 0 ? Math.round((weighted / weightSum) * 1000) / 1000 : null,
      hour: sample ? sample.hour : i / 2,
      isEstimated: true
    });
  }
  return result;
}

function getTideDataForStation(dateStr, stationKey, allowReal) {
  if (stationKey === 'SITE_BKT') {
    return { tideData: getSiteEstimateTideData(dateStr), dataSource: 'idw' };
  }
  return resolveStationTideData(dateStr, stationKey, allowReal);
}

function getClosestLevel(tideData, datetime) {
  const mins = datetime.getHours() * 60 + datetime.getMinutes();
  const closest = tideData.reduce(function(best, d) {
    const dMins = d.hour * 60;
    return Math.abs(dMins - mins) < Math.abs(best.hour * 60 - mins) ? d : best;
  });
  return closest.level;
}

function getTideStatus(tideData, currentLevel, datetime) {
  const currentHour = datetime.getHours() + datetime.getMinutes() / 60;
  for (let i = 1; i < tideData.length; i++) {
    if (tideData[i].hour >= currentHour) {
      const prevLevel = tideData[i - 1].level;
      if (currentLevel > prevLevel + 0.02) return 'rising';
      if (currentLevel < prevLevel - 0.02) return 'falling';
      break;
    }
  }
  return 'stable';
}

// ============ API ENDPOINTS (called from frontend) ============

/**
 * ดึงข้อมูลครบทุกสถานีสำหรับวันที่กำหนด
 */
function getDashboardData(dateStr) {
  const result = {
    date: dateStr,
    stations: {},
    project: CONFIG.PROJECT_NAME,
    location: CONFIG.LOCATION
  };
  
  for (const [key, station] of Object.entries(CONFIG.STATIONS)) {
    const resolved = getTideDataForStation(dateStr, key, true);
    const tideData = resolved.tideData;
    const dataSource = resolved.dataSource;

    const { highTides, lowTides } = findHighLowTide(tideData);
    const workWindows = findWorkWindows(tideData);

    const now = new Date();
    const currentLevel = getClosestLevel(tideData, now);
    const tideStatus = getTideStatus(tideData, currentLevel, now);

    result.stations[key] = {
      info: station,
      tideData: tideData,
      highTides: highTides,
      lowTides: lowTides,
      workWindows: workWindows,
      currentLevel: currentLevel,
      tideStatus: tideStatus,
      dataSource: dataSource
    };
  }
  
  return result;
}

/**
 * ดึงข้อมูล 7 วันข้างหน้า
 */
function getWeeklyForecast(baseDateStr) {
  const forecasts = [];
  const baseDate = new Date(baseDateStr + 'T00:00:00+07:00');
  
  for (let d = 0; d < 7; d++) {
    const dt = new Date(baseDate.getTime() + d * 86400000);
    const dateStr = Utilities.formatDate(dt, 'Asia/Bangkok', 'yyyy-MM-dd');
    const dayData = getDashboardData(dateStr);
    
    // สรุปเฉพาะข้อมูลสำคัญต่อวัน
    const summary = {
      date: dateStr,
      dayName: Utilities.formatDate(dt, 'Asia/Bangkok', 'EEEE'),
      dayShort: Utilities.formatDate(dt, 'Asia/Bangkok', 'EEE'),
      stations: {}
    };
    
    for (const [key, stationData] of Object.entries(dayData.stations)) {
      summary.stations[key] = {
        highTides: stationData.highTides,
        lowTides: stationData.lowTides,
        workWindows: stationData.workWindows
      };
    }
    
    forecasts.push(summary);
  }
  
  return forecasts;
}

/**
 * ดึงข้อมูล real-time (เวลาปัจจุบัน)
 */
function getRealtimeData() {
  const now = new Date();
  const today = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm:ss');
  
  const result = {
    timestamp: now.toISOString(),
    timeStr: timeStr,
    dateStr: today,
    stations: {}
  };
  
  for (const [key, station] of Object.entries(CONFIG.STATIONS)) {
    const resolved = getTideDataForStation(today, key, true);
    const tideData = resolved.tideData;
    const level = getClosestLevel(tideData, now);
    const { highTides, lowTides } = findHighLowTide(tideData);
    const workWindows = findWorkWindows(tideData);
    const tideStatus = getTideStatus(tideData, level, now);
    
    result.stations[key] = {
      info: station,
      currentLevel: level,
      tideStatus: tideStatus,
      highTides: highTides,
      lowTides: lowTides,
      workWindows: workWindows,
      dataSource: resolved.dataSource
    };
  }
  
  return result;
}

// ============ MONTHLY TIDE TABLE ============

/**
 * ดึงข้อมูลน้ำขึ้น-ลงรายวันตลอดเดือน สำหรับ ตารางมาตราน้ำ MSL
 * @param {string} yearMonth - YYYY-MM
 * @param {string} stationKey - PHRA_CHULA | SANDON | THA_CHIN
 * @returns {Array} ข้อมูลรายวันพร้อม highTides/lowTides
 */
function getMonthlyTideTable(yearMonth, stationKey) {
  var parts = yearMonth.split('-');
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();
  var result = [];

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' +
      (month < 10 ? '0' + month : '' + month) + '-' +
      (d < 10 ? '0' + d : '' + d);

    var tideData = getTideDataForStation(dateStr, stationKey, false).tideData;

    // Extract hourly values at :00 (every 2nd point of 30-min data → indices 0,2,4,...,46)
    var hourly = [];
    for (var i = 0; i < 48; i += 2) {
      hourly.push(tideData[i] ? tideData[i].level : null);
    }

    var dt = new Date(dateStr + 'T00:00:00+07:00');

    result.push({
      date: dateStr,
      day: d,
      dayName: Utilities.formatDate(dt, 'Asia/Bangkok', 'EEEE'),
      hourly: hourly
    });
  }

  return result;
}

// ============ CHART DATA FOR MULTI-PERIOD VIEWS ============

/**
 * ดึงข้อมูลระดับน้ำรายชั่วโมงต่อเนื่องหลายวัน (สำหรับ มุมมองรายวัน 7 วัน)
 */
function getMultiDayChart(startDate, numDays, stationKey) {
  var base = new Date(startDate + 'T00:00:00+07:00');
  var labels = [];
  var levels = [];
  var msl = CONFIG.STATIONS[stationKey].msl;

  for (var d = 0; d < numDays; d++) {
    var dt = new Date(base.getTime() + d * 86400000);
    var dateStr = Utilities.formatDate(dt, 'Asia/Bangkok', 'yyyy-MM-dd');
    var dayLabel = Utilities.formatDate(dt, 'Asia/Bangkok', 'd MMM');

    var tideData = getTideDataForStation(dateStr, stationKey, false).tideData;

    for (var i = 0; i < 48; i += 2) { // hourly points
      labels.push(i === 0 ? dayLabel : tideData[i].time);
      levels.push(tideData[i].level);
    }
  }

  return { labels: labels, levels: levels, msl: msl, type: 'continuous' };
}

/**
 * ดึงค่า max/min รายวัน (สำหรับ มุมมองรายสัปดาห์ / รายเดือน)
 */
function getDailyAggregates(startDate, numDays, stationKey) {
  var base = new Date(startDate + 'T00:00:00+07:00');
  var labels = [];
  var maxLevels = [];
  var minLevels = [];
  var msl = CONFIG.STATIONS[stationKey].msl;

  for (var d = 0; d < numDays; d++) {
    var dt = new Date(base.getTime() + d * 86400000);
    var dateStr = Utilities.formatDate(dt, 'Asia/Bangkok', 'yyyy-MM-dd');
    labels.push(Utilities.formatDate(dt, 'Asia/Bangkok', 'd/M'));

    var tideData = getTideDataForStation(dateStr, stationKey, false).tideData;

    var dayLevels = tideData.map(function(p) { return p.level; });
    maxLevels.push(Math.round(Math.max.apply(null, dayLevels) * 100) / 100);
    minLevels.push(Math.round(Math.min.apply(null, dayLevels) * 100) / 100);
  }

  return { labels: labels, maxLevels: maxLevels, minLevels: minLevels, msl: msl, type: 'aggregate' };
}

/**
 * ดึงค่า max/min รายเดือนตลอดปี (สำหรับ มุมมองรายปี)
 */
function getMonthlyAggregates(year, stationKey) {
  var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var labels = [];
  var maxLevels = [];
  var minLevels = [];
  var msl = CONFIG.STATIONS[stationKey].msl;

  for (var m = 1; m <= 12; m++) {
    labels.push(thaiMonths[m - 1] + ' ' + (year + 543));
    var daysInMonth = new Date(year, m, 0).getDate();
    var monthMax = -Infinity, monthMin = Infinity;

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (d < 10 ? '0' + d : '' + d);
      var tideData = getTideDataForStation(dateStr, stationKey, false).tideData;
      var dayLevels = tideData.map(function(p) { return p.level; });
      monthMax = Math.max(monthMax, Math.max.apply(null, dayLevels));
      monthMin = Math.min(monthMin, Math.min.apply(null, dayLevels));
    }

    maxLevels.push(Math.round(monthMax * 100) / 100);
    minLevels.push(Math.round(monthMin * 100) / 100);
  }

  return { labels: labels, maxLevels: maxLevels, minLevels: minLevels, msl: msl, type: 'aggregate' };
}

// ============ UTILITIES ============

/**
 * ส่งข้อมูลไปยัง Google Sheet (สำหรับ backup)
 */
function exportToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    return { error: 'กรุณาเปิดจาก Google Sheet หรือใช้ฟังก์ชันนี้จาก Sheet' };
  }
  
  const sheet = ss.getSheetByName('TideData') || ss.insertSheet('TideData');
  sheet.clear();
  
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const data = getDashboardData(today);
  
  // Header
  sheet.getRange(1, 1, 1, 4).setValues([['Time', 'ป้อมพระจุลจอมเกล้า', 'สันดอน', 'ปากแม่น้ำท่าจีน']]);
  
  const rows = [];
  for (let i = 0; i < 48; i++) {
    rows.push([
      data.stations.PHRA_CHULA.tideData[i].time,
      data.stations.PHRA_CHULA.tideData[i].level,
      data.stations.SANDON.tideData[i].level,
      data.stations.THA_CHIN.tideData[i].level
    ]);
  }
  
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  
  return { success: true, rows: rows.length };
}

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
  LOCATION: {
    name: "บางขุนเทียน, กรุงเทพมหานคร",
    lat: 13.5421,
    lng: 100.2758
  },
  STATIONS: {
    PHRA_CHULA: {
      name: "ป้อมพระจุลจอมเกล้า",
      nameEn: "Phra Chulachomklao Fort",
      lat: 13.5521,
      lng: 100.5785,
      msl: 0.85,  // Mean Sea Level in meters (MSL)
      unit: "MSL"
    },
    SANDON: {
      name: "สันดอน ปากแม่น้ำเจ้าพระยา",
      nameEn: "Sandon, Chao Phraya River Mouth",
      lat: 13.4386,
      lng: 100.5960,
      msl: 0.72,
      unit: "MSL"
    },
    THA_CHIN: {
      name: "ปากแม่น้ำท่าจีน",
      nameEn: "Tha Chin River Mouth",
      lat: 13.5306,
      lng: 100.2750,
      msl: 0.68,
      unit: "MSL"
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
  // ช่วงเวลาแนะนำเข้างาน (น้ำต่ำ)
  WORK_WINDOW: {
    minTideLevel: -0.3,  // ระดับน้ำขั้นต่ำที่เข้างานได้ (MSL)
    maxTideLevel: 0.5,   // ระดับน้ำสูงสุดที่ยังเข้างานได้ (MSL)
    advanceHours: 2      // แจ้งเตือนล่วงหน้า (ชั่วโมง)
  },
  // API จริงจากกรมเจ้าท่า
  // DataLevelWater = gauge height (ม. จาก datum ของสถานี)
  // ต้องลบ datum offset เพื่อให้ได้ค่า MSL
  // ปรับค่า DATUM_MD05 ให้ตรงกับ benchmark จริงของสถานี
  REAL_STATIONS: {
    THA_CHIN: { code: 'MD05', datumOffset: 2.50 }
  },
  MD_API_URL: 'http://hydro.md.go.th/Services/ServicesMD.asmx/GetDataReportchart'
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
  const minLevel = CONFIG.WORK_WINDOW.minTideLevel;
  const maxLevel = CONFIG.WORK_WINDOW.maxTideLevel;
  
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
 * สร้างข้อมูล 48 จุด (ทุก 30 นาที) โดย cosine interpolation ระหว่าง high/low จากตารางจริง
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
    } else {
      // Cosine interpolation: zero slope at each tide extremum
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

    if (response.getResponseCode() !== 200) return null;

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
    let tideData = null;
    let dataSource = 'simulated';

    // 1. ลอง real-time API ก่อน (มีเฉพาะ THA_CHIN ผ่าน MD05)
    const realCfg = CONFIG.REAL_STATIONS[key];
    if (realCfg) {
      tideData = fetchRealTideData(dateStr, realCfg.code, realCfg.datumOffset);
      if (tideData) dataSource = 'real';
    }

    // 2. ลองตารางน้ำจริงจากกรมอุทกศาสตร์ 2026
    if (!tideData) {
      tideData = getTideDataFromTable(dateStr, key);
      if (tideData) dataSource = 'table';
    }

    // 3. fallback Harmonic สำหรับวันที่ไม่อยู่ในตาราง
    if (!tideData) {
      tideData = getTideDataForDate(dateStr, key);
    }

    const { highTides, lowTides } = findHighLowTide(tideData);
    const workWindows = findWorkWindows(tideData);

    // currentLevel: ใช้ข้อมูลจริงล่าสุดหรือสูตรจำลอง
    let currentLevel;
    if (dataSource === 'real') {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const closest = tideData.reduce(function(best, d) {
        const dMins = d.hour * 60;
        return Math.abs(dMins - nowMins) < Math.abs(best.hour * 60 - nowMins) ? d : best;
      });
      currentLevel = closest.level;
    } else {
      currentLevel = calculateTideLevel(new Date(), key);
    }

    result.stations[key] = {
      info: station,
      tideData: tideData,
      highTides: highTides,
      lowTides: lowTides,
      workWindows: workWindows,
      currentLevel: currentLevel,
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
    const level = calculateTideLevel(now, key);
    const tideData = getTideDataForDate(today, key);
    const { highTides, lowTides } = findHighLowTide(tideData);
    const workWindows = findWorkWindows(tideData);
    
    // หาสถานะน้ำขึ้น/น้ำลง
    const currentHour = now.getHours() + now.getMinutes() / 60;
    let tideStatus = 'stable';
    for (let i = 1; i < tideData.length; i++) {
      if (tideData[i].hour >= currentHour) {
        const prevLevel = tideData[i - 1].level;
        if (level > prevLevel + 0.02) tideStatus = 'rising';
        else if (level < prevLevel - 0.02) tideStatus = 'falling';
        break;
      }
    }
    
    result.stations[key] = {
      info: station,
      currentLevel: level,
      tideStatus: tideStatus,
      highTides: highTides,
      lowTides: lowTides,
      workWindows: workWindows
    };
  }
  
  return result;
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

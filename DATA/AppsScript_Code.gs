const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const FACT_SHEET_NAME = '01_Looker_Fact';
const DEFAULT_MOVE_THRESHOLD = 0.80;
const DEFAULT_DRY_THRESHOLD = -0.30;

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('BKT Tide Monitoring Dashboard 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getFactRows_(startDate, endDate, entityId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(FACT_SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const start = new Date(startDate + 'T00:00:00+07:00');
  const end = new Date(endDate + 'T23:59:59+07:00');
  return values.filter(r => {
    const t = new Date(r[idx.datetime_th]);
    return t >= start && t <= end && (!entityId || r[idx.entity_id] === entityId);
  }).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function getDashboardData(params) {
  params = params || {};
  const startDate = params.startDate || '2026-01-01';
  const endDate = params.endDate || '2026-01-07';
  const entityId = params.entityId || 'SITE_BKT';
  const rows = getFactRows_(startDate, endDate, entityId);
  return rows.map(r => ({
    datetime_th: Utilities.formatDate(new Date(r.datetime_th), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
    water_level_m: Number(r.water_level_m),
    status: r.status,
    lat: Number(r.lat),
    lon: Number(r.lon),
    name_th: r.name_th,
    entity_id: r.entity_id
  }));
}

function getStationMarkers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(FACT_SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const markers = {};
  values.forEach(r => {
    const id = r[idx.entity_id];
    if (!markers[id]) {
      markers[id] = {
        entity_id: id,
        entity_type: r[idx.entity_type],
        name_th: r[idx.name_th],
        name_en: r[idx.name_en],
        lat: Number(r[idx.lat]),
        lon: Number(r[idx.lon])
      };
    }
  });
  return Object.values(markers);
}

function getMinuteSeries(params) {
  params = params || {};
  const dateText = params.date || '2026-01-01';
  const entityId = params.entityId || 'SITE_BKT';
  const moveThreshold = Number(params.moveThreshold || DEFAULT_MOVE_THRESHOLD);
  const dryThreshold = Number(params.dryThreshold || DEFAULT_DRY_THRESHOLD);
  const rows = getFactRows_(dateText, dateText, entityId)
    .sort((a, b) => new Date(a.datetime_th) - new Date(b.datetime_th));
  const result = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const t0 = new Date(rows[i].datetime_th);
    const y0 = Number(rows[i].water_level_m);
    const y1 = Number(rows[i + 1].water_level_m);
    for (let m = 0; m < 60; m++) {
      const t = new Date(t0.getTime() + m * 60000);
      const y = y0 + (y1 - y0) * (m / 60);
      const status = y >= moveThreshold ? 'MOVE_WINDOW' : y <= dryThreshold ? 'DRY_WORK_WINDOW' : 'TRANSITION';
      result.push({ datetime_th: Utilities.formatDate(t, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), water_level_m: Number(y.toFixed(3)), status });
    }
  }
  return result;
}
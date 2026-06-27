import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://script.google.com/macros/s/AKfycbxAxRtPNQoH6-54n0G64-iratBAMaRLh-1dwZL42NmteBEi-KAYvmK-AYDk46h6CKCwxw/exec';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

console.log('Navigating to GAS web app...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

// Wait for data to load (dashboard renders via google.script.run)
await page.waitForTimeout(5000);

// Screenshot — full page
await page.screenshot({ path: 'verify_full.png', fullPage: true });
console.log('Screenshot saved: verify_full.png');

// Check key elements
const checks = [
  { label: 'Header title',    sel: '.header-left h1'        },
  { label: 'Station tabs',    sel: '.station-tabs'          },
  { label: 'Level cards',     sel: '#levelDisplay'          },
  { label: 'Tide chart',      sel: '#tideChart'             },
  { label: 'Tide table',      sel: '#tideTableContainer'    },
  { label: 'Work windows',    sel: '#workWindows'           },
  { label: 'Weekly forecast', sel: '#weeklyForecast'        },
  { label: 'Data source label', sel: '.level-card'          },
  { label: 'Footer',          sel: '.footer'                },
];

console.log('\n--- Element checks ---');
for (const c of checks) {
  const el = await page.$(c.sel);
  const text = el ? (await el.innerText()).slice(0, 80).replace(/\n/g, ' ') : '(not found)';
  console.log(`[${el ? 'OK' : 'MISSING'}] ${c.label}: ${text}`);
}

// Check data source indicator (should say "ตารางน้ำ 2026" not "จำลอง")
const cards = await page.$$('.level-card');
console.log(`\nLevel cards found: ${cards.length}`);
for (const card of cards) {
  const txt = (await card.innerText()).replace(/\n/g, ' | ');
  console.log('  Card:', txt.slice(0, 120));
}

// Check footer version
const footer = await page.$('.footer');
if (footer) {
  console.log('\nFooter:', (await footer.innerText()).slice(0, 150));
}

// Screenshot of just the top section
await page.screenshot({ path: 'verify_top.png', clip: { x: 0, y: 0, width: 1400, height: 500 } });
console.log('\nTop screenshot: verify_top.png');

await browser.close();
console.log('\nDone.');

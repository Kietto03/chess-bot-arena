import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { installWidget } from '../src/widget.js';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent('<body style="background:#78964d"><h1>Chess canvas — widget preview</h1></body>');
  await page.evaluate(installWidget, { room: 'OZYRKA' });
  await page.getByRole('button', { name: 'Tạm dừng bot' }).click();
  assert.equal(await page.evaluate(() => window.__botControl.enabled), false);
  await page.getByLabel('Sức mạnh', { exact: true }).fill('17');
  assert.equal(await page.evaluate(() => window.__botControl.skill), 17);
  await page.getByLabel('Thời gian suy nghĩ').fill('1200');
  assert.equal(await page.evaluate(() => window.__botControl.think), 1200);
  await page.getByRole('button', { name: 'Bật bot' }).click();
  assert.equal(await page.evaluate(() => window.__botControl.enabled), true);
  await page.getByRole('button', { name: 'Thu gọn' }).click();
  assert.equal(await page.getByLabel('Sức mạnh', { exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Thu gọn' }).click();
  await page.evaluate(() => window.__botWidgetUpdate({ status: 'Chờ Trắng đi…', last: 'Nước 2: e7e5', entry: '<script>unsafe</script>' }));
  assert.equal(await page.locator('#stockfish-widget').locator('#history').textContent(), '<script>unsafe</script>');
  await page.screenshot({ path: join(tmpdir(), 'chess-widget-preview.png') });
  console.log('Widget controls: passed');
} finally { await browser.close(); }

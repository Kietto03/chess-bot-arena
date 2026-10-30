import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { patchArchive } from './bridge.js';
import { installWidget, updateWidget } from './widget.js';
import { Engine } from './engine.js';
const args = new Map(process.argv.slice(2).map(arg => { const [key, ...v] = arg.replace(/^--/, '').split('='); return [key, v.join('=') || true]; }));
function number(key, fallback, min, max) { const value = Number(args.get(key) ?? fallback); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid --${key}: ${value}`); return value; }
const think = number('think-ms', 500, 10, 60000), delay = number('delay-ms', 600, 0, 60000), max = number('max-plies', 300, 1, 2000);
const out = resolve('runs', new Date().toISOString().replaceAll(':', '-'));
await mkdir(out, { recursive: true });
let writes = Promise.resolve();
const log = event => { writes = writes.then(() => appendFile(resolve(out, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n')); };
const chess = new Chess();
chess.header('Event', 'Playwright Stockfish Arena', 'White', 'Stockfish White', 'Black', 'Stockfish Black');
const engines = [new Engine('White', number('white-skill', 10, 0, 20), log), new Engine('Black', number('black-skill', 10, 0, 20), log)];
let browser, context, page, failed = false, stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
const boardFromChess = () => chess.board().map(row => row.map(p => p ? p.color + (p.type === 'p' ? 'p' : p.type.toUpperCase()) : '--'));
try {
  await Promise.all(engines.map(engine => engine.init()));
  browser = await chromium.launch({ headless: args.has('headless') });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: resolve(out, 'video'), size: { width: 1280, height: 900 } } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  page.on('console', message => log({ type: 'console', level: message.type(), message: message.text() }));
  page.on('pageerror', error => log({ type: 'pageerror', message: error.message }));
  await page.addInitScript(() => localStorage.setItem('chess_ai_settings', JSON.stringify({ seenHelp: true, sound: false, animation: 'fast' })));
  await page.route('**/game.tar.gz*', async route => {
    try {
      const response = await route.fetch({ timeout: 120000 });
      if (!response.ok()) throw new Error(`Archive HTTP ${response.status()}`);
      const body = await patchArchive(await response.body());
      await route.fulfill({ response, body, headers: { ...response.headers(), 'content-encoding': 'identity', 'content-length': String(body.length) } });
      log({ type: 'bridge-installed' });
    } catch (error) { log({ type: 'bridge-error', message: error.message }); await route.abort(); }
  });
  await page.goto('https://chess-playing-ai.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.Module?.PyRun_SimpleString === 'function', undefined, { timeout: 180000 });
  await page.locator('#canvas').click({ position: { x: 10, y: 10 }, force: true });
  await page.waitForFunction(() => !!window.__arena, undefined, { timeout: 180000 });
  await page.evaluate(installWidget, { local: true, think, skill: 10 });
  const state = () => page.evaluate(() => JSON.parse(window.__arena));
  const click = async (x, y, s) => { const box = await page.locator('#canvas').boundingBox(); if (!box) throw new Error('Canvas unavailable'); await page.evaluate(() => { document.getElementById('stockfish-widget').style.visibility = 'hidden'; }); try { await page.mouse.click(box.x + x / s.size[0] * box.width, box.y + y / s.size[1] * box.height); } finally { await page.evaluate(() => { document.getElementById('stockfish-widget').style.visibility = ''; }); } await page.waitForTimeout(100); };
  log({ type: 'start', think, delay, max });
  console.log(`Watching two Stockfish bots. Logs: ${out}`);
  while (chess.history().length < max && !stopping && !chess.isGameOver()) {
    if (page.isClosed()) { stopping = true; break; }
    const ply = chess.history().length;
    const control = await page.evaluate(() => ({ ...window.__botControl }));
    await updateWidget(page, { status: control.enabled ? 'Stockfish đang tính…' : 'Đã tạm dừng' });
    if (!control.enabled) { await page.waitForTimeout(200); continue; }
    const s = await state();
    if (s.mode !== 1 || s.ply !== ply || s.white !== (chess.turn() === 'w') || JSON.stringify(s.board) !== JSON.stringify(boardFromChess())) throw new Error(`Board out of sync at ply ${ply}`);
    if (s.over) break;
    const engine = engines[chess.turn() === 'w' ? 0 : 1];
    // Keep per-side CLI skill until the user adjusts the widget.
    if (control.revision > 0) engine.send(`setoption name Skill Level value ${control.skill}`);
    const uci = await engine.move(chess.fen(), control.think);
    const freshControl = await page.evaluate(() => ({ ...window.__botControl }));
    if (!freshControl.enabled || freshControl.revision !== control.revision) continue;
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!move) throw new Error(`Illegal engine move ${uci}`);
    const point = square => { let col = square.charCodeAt(0) - 97, row = 8 - Number(square[1]); if (s.flipped) { col = 7 - col; row = 7 - row; } return [s.rect[0] + (col + .5) * s.rect[2] / 8, s.rect[1] + (row + .5) * s.rect[3] / 8]; };
    await click(...point(move.from), s); await click(...point(move.to), s);
    if (move.promotion) { const [x, y] = point(move.to); const step = (y < s.rect[1] + s.rect[3] / 2 ? 1 : -1); await click(x, y + ['q', 'r', 'b', 'n'].indexOf(move.promotion) * step * s.rect[3] / 8, s); }
    await page.waitForFunction(expected => { const s = JSON.parse(window.__arena); return s.ply === expected; }, ply + 1, { timeout: 15000 });
    const after = await state();
    if (JSON.stringify(after.board) !== JSON.stringify(boardFromChess())) throw new Error(`Move not confirmed: ${uci}`);
    log({ type: 'move', ply: ply + 1, uci, san: move.san, fen: chess.fen() });
    await updateWidget(page, { status: 'Đã đi · Chờ lượt tiếp', last: `${move.color === 'w' ? 'Trắng' : 'Đen'}: ${move.san}`, entry: `${ply + 1}. ${move.san} (${uci})` });
    console.log(`${ply + 1}. ${move.color}: ${move.san} (${uci})`);
    await writeFile(resolve(out, 'game.pgn'), chess.pgn());
    await page.screenshot({ path: resolve(out, 'latest.png') });
    await page.waitForTimeout(delay);
  }
  const result = chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : chess.isDraw() ? '1/2-1/2' : '*';
  chess.header('Result', result);
  log({ type: 'finish', result, reason: stopping ? 'signal' : chess.isGameOver() ? 'game-over' : 'limit-or-site-ended', plies: chess.history().length });
} catch (error) {
  if (stopping || page?.isClosed()) log({ type: 'stopped', reason: 'User closed browser or stopped runner' });
  else {
    failed = true; log({ type: 'error', message: error.stack }); console.error(error);
    if (page && !page.isClosed()) await page.screenshot({ path: resolve(out, 'error.png') }).catch(() => {});
  }
} finally {
  for (const engine of engines) engine.close();
  await writeFile(resolve(out, 'game.pgn'), chess.pgn());
  if (context) { await context.tracing.stop({ path: resolve(out, 'trace.zip') }).catch(() => {}); await context.close(); }
  if (browser) await browser.close();
  await writes;
  console.log(`Artifacts: ${out}`);
  if (failed) process.exitCode = 1;
}

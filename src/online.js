import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installWidget, updateWidget } from './widget.js';
import { Engine } from './engine.js';
import { patchArchive } from './bridge.js';
const room = process.argv[2]?.toUpperCase();
if (!/^[A-Z0-9]{6}$/.test(room ?? '')) throw new Error('Usage: node src/online.js ROOMCODE');
const out = resolve('runs', `${new Date().toISOString().replaceAll(':', '-')}-online`);
await mkdir(out, { recursive: true });
let writes = Promise.resolve();
const log = event => { writes = writes.then(() => appendFile(resolve(out, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n')); };
const engine = new Engine('Stockfish Black', 10, log);
let browser, context, page, stop = false;
let chess = new Chess(), confirmed = [], finished = false;
process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });
try {
  await engine.init();
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: resolve(out, 'video') } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await context.addInitScript(() => localStorage.setItem('chess_ai_settings', JSON.stringify({ seenHelp: true, sound: false, animation: 'fast' })));
  page = await context.newPage();
  page.on('console', message => log({ type: 'console', message: message.text() }));
  page.on('pageerror', error => log({ type: 'pageerror', message: error.message }));
  await page.route('**/game.tar.gz*', async route => {
    try { const response = await route.fetch({ timeout: 120000 }); if (!response.ok()) throw new Error(`Archive HTTP ${response.status()}`); const body = await patchArchive(await response.body()); await route.fulfill({ response, body, headers: { ...response.headers(), 'content-encoding': 'identity', 'content-length': String(body.length) } }); }
    catch (error) { log({ type: 'bridge-error', message: error.message }); await route.abort(); }
  });
  await page.goto(`https://chess-playing-ai.vercel.app/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.Module?.PyRun_SimpleString === 'function', undefined, { timeout: 180000 });
  await page.locator('#canvas').click({ position: { x: 10, y: 10 }, force: true });
  await page.waitForFunction(() => !!window.__arena, undefined, { timeout: 180000 });
  await page.evaluate(installWidget, { room });
  const state = () => page.evaluate(() => JSON.parse(window.__arena));
  const click = async (x, y, s) => { const box = await page.locator('#canvas').boundingBox(); if (!box) throw new Error('Canvas unavailable'); await page.evaluate(() => { const el = document.getElementById('stockfish-widget'); if (el) el.style.visibility = 'hidden'; }); try { await page.mouse.click(box.x + x / s.size[0] * box.width, box.y + y / s.size[1] * box.height); } finally { await page.evaluate(() => { const el = document.getElementById('stockfish-widget'); if (el) el.style.visibility = ''; }); } await page.waitForTimeout(120); };
  const initial = await state();
  if (initial.prompt !== 'joinInvite' || initial.room !== room) throw new Error('Join invitation unavailable');
  await click(initial.accept[0] + initial.accept[2] / 2, initial.accept[1] + initial.accept[3] / 2, initial);
  await page.waitForFunction(() => { const s = JSON.parse(window.__arena); return s.connected && s.role === 'client'; }, undefined, { timeout: 30000 });
  console.log(`Joined room ${room} as Black. Waiting for host. Logs: ${out}`);
  log({ type: 'joined', room });
  await updateWidget(page, { status: 'Đã vào phòng · Chờ đối thủ', entry: `Kết nối ${room} · Bot cầm Đen` });
  while (!stop) {
    if (page.isClosed()) break;
    const s = await state();
    if (!s.connected || s.mode !== 2 || s.role !== 'client') throw new Error('Online room disconnected or changed');
    const control = await page.evaluate(() => ({ ...window.__botControl }));
    await updateWidget(page, { status: !control.enabled ? 'Đã tạm dừng' : !s.caughtUp ? 'Đang đồng bộ phòng…' : s.over ? 'Ván đã kết thúc' : s.white ? 'Chờ Trắng đi…' : 'Lượt Đen' });
    if (!s.caughtUp) { await page.waitForTimeout(500); continue; }
    if (JSON.stringify(confirmed) !== JSON.stringify(s.moves)) {
      chess = new Chess();
      chess.header('Event', `Online room ${room}`, 'White', 'Human host', 'Black', 'Stockfish 19');
      for (const uci of s.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      const board = chess.board().map(row => row.map(p => p ? p.color + (p.type === 'p' ? 'p' : p.type.toUpperCase()) : '--'));
      if (JSON.stringify(board) !== JSON.stringify(s.board)) throw new Error('Online board does not match move history');
      confirmed = [...s.moves];
      log({ type: 'position', moves: confirmed, fen: chess.fen(), result: s.result });
      await updateWidget(page, { last: `Nước ${s.ply}: ${confirmed.at(-1) ?? 'bắt đầu'}`, entry: s.ply ? `${s.ply}. ${confirmed.at(-1)}` : 'Ván mới' });
      console.log(`Position ${s.ply}: ${confirmed.at(-1) ?? 'start'}`);
      await writeFile(resolve(out, 'game.pgn'), chess.pgn());
      await page.screenshot({ path: resolve(out, 'latest.png') });
    }
    if (s.over || chess.isGameOver()) { if (!finished) { log({ type: 'finish', result: s.result }); console.log('Game finished; waiting for next game.'); finished = true; } await page.waitForTimeout(500); continue; }
    finished = false;
    if (!control.enabled || s.white || s.prompt) { await page.waitForTimeout(300); continue; }
    engine.send(`setoption name Skill Level value ${control.skill}`);
    await updateWidget(page, { status: 'Stockfish đang tính…' });
    const uci = await engine.move(chess.fen(), control.think);
    const latestControl = await page.evaluate(() => ({ ...window.__botControl }));
    if (!latestControl.enabled || latestControl.revision !== control.revision) continue;
    const fresh = await state();
    if (JSON.stringify(fresh.moves) !== JSON.stringify(s.moves) || fresh.over || fresh.prompt) continue;
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    const point = square => { let col = square.charCodeAt(0) - 97, row = 8 - Number(square[1]); if (fresh.flipped) { col = 7 - col; row = 7 - row; } return [fresh.rect[0] + (col + .5) * fresh.rect[2] / 8, fresh.rect[1] + (row + .5) * fresh.rect[3] / 8]; };
    await click(...point(move.from), fresh); await click(...point(move.to), fresh);
    if (move.promotion) { const [x, y] = point(move.to); await click(x, y + ['q', 'r', 'b', 'n'].indexOf(move.promotion) * (y < fresh.rect[1] + fresh.rect[3] / 2 ? 1 : -1) * fresh.rect[3] / 8, fresh); }
    await page.waitForFunction(({ ply, uci }) => { const s = JSON.parse(window.__arena); return s.moves[ply] === uci; }, { ply: s.ply, uci }, { timeout: 15000 });
    log({ type: 'bot-move', uci, san: move.san }); console.log(`Bot Black: ${move.san} (${uci})`);
  }
} catch (error) { if (stop || page?.isClosed()) { log({ type: 'stopped', reason: 'User closed browser or stopped runner' }); } else { if (page && !page.isClosed()) await updateWidget(page, { status: `Lỗi: ${error.message}` }).catch(() => {}); console.error(error); log({ type: 'error', message: error.stack }); process.exitCode = 1; if (page && !page.isClosed()) await page.screenshot({ path: resolve(out, 'error.png') }).catch(() => {}); } }
finally { engine.close(); if (context) { await context.tracing.stop({ path: resolve(out, 'trace.zip') }).catch(() => {}); await context.close(); } if (browser) await browser.close(); await writes; }

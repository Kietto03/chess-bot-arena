import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { Engine } from '../src/engine.js';
import { patchPython, patchArchive } from '../src/bridge.js';
import tar from 'tar-stream';
import { gzipSync } from 'node:zlib';
test('Stockfish UCI handshake and legal move', async () => {
  const engine = new Engine('test', 0, () => {});
  try { await engine.init(); const chess = new Chess(); const uci = await engine.move(chess.fen(), 50); assert.ok(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })); } finally { engine.close(); }
});
test('bridge fails explicitly if upstream changes', () => { assert.throws(() => patchPython('different game'), /Game source changed/); });
test('archive bridge rejects missing main.py', async () => {
  const pack = tar.pack(), chunks = [];
  pack.on('data', chunk => chunks.push(chunk));
  const end = new Promise(resolve => pack.on('end', resolve)); pack.entry({ name: 'unrelated.txt' }, 'hello'); pack.finalize(); await end;
  await assert.rejects(patchArchive(gzipSync(Buffer.concat(chunks))), /main.py missing/);
});

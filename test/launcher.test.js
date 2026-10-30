import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoom } from '../scripts/launcher.js';
test('accepts room code and official invite URL', () => {
  assert.equal(parseRoom(' ozyrka '), 'OZYRKA');
  assert.equal(parseRoom('https://chess-playing-ai.vercel.app/?room=abc123&fbclid=ignored'), 'ABC123');
});
test('rejects missing room and other origins', () => {
  for (const input of ['', 'ABC', 'ABCDEF; echo bad', 'https://example.com/?room=ABCDEF', 'https://chess-playing-ai.vercel.app/?fbclid=tracking']) assert.throws(() => parseRoom(input));
});

// A downloaded archive may live under a path containing spaces or a symlink
// (macOS /tmp resolves to /private/tmp). The entry point must still run.
test('launcher starts from an extracted directory with spaces', async () => {
  const { mkdtemp, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'Chess Arena '));
  try {
    const entry = join(dir, 'launcher.mjs');
    await copyFile(new URL('../scripts/launcher.js', import.meta.url), entry);
    assert.match(execFileSync(process.execPath, [entry, '--help'], { encoding: 'utf8' }), /--setup-only/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

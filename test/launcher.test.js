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

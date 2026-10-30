import tar from 'tar-stream';
import { gunzipSync, gzipSync } from 'node:zlib';

export function patchPython(source) {
  const replacements = [
    ['currentModeIndex = 0 #', 'currentModeIndex = 1 #'],
    ['playerWhiteHuman = not SET_WHITE_AS_BOT', 'playerWhiteHuman = True'],
    ['playerBlackHuman = not SET_BLACK_AS_BOT', 'playerBlackHuman = True'],
    ['    while running:', `    while running:
        import json as _arena_json
        import platform as _arena_platform
        _arena_platform.window.__arena = _arena_json.dumps({
            'board': gs.board, 'ply': len(gs.moveLog), 'white': gs.whiteToMove,
            'over': gameOver, 'result': gameResult,
            'size': list(screen.get_size()), 'rect': list(LAYOUT.board),
            'flipped': boardFlipped != (multiplayerMode and networkConnected and multiplayerRole == 'client'), 'mode': currentModeIndex,
            'moves': [m.getCode() for m in gs.moveLog],
            'connected': networkConnected, 'caughtUp': caughtUp, 'role': multiplayerRole,
            'prompt': pendingPrompt['kind'] if pendingPrompt else None,
            'accept': list(promptRects()[1]), 'room': roomCode
        })`],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error(`Game source changed: expected one ${before}`);
    source = source.replace(before, after);
  }
  return source;
}

export async function patchArchive(buffer) {
  const extract = tar.extract();
  const pack = tar.pack();
  const chunks = [];
  pack.on('data', chunk => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { pack.on('end', resolve); pack.on('error', reject); extract.on('error', reject); });
  let patched = false;
  extract.on('entry', (header, stream, next) => {
    const parts = [];
    stream.on('data', chunk => parts.push(chunk));
    stream.on('end', () => {
      try {
        let body = Buffer.concat(parts);
        if (header.name === 'assets/main.py') { body = Buffer.from(patchPython(body.toString())); patched = true; }
        pack.entry({ ...header, size: body.length }, body, next);
      } catch (error) { extract.destroy(error); pack.destroy(error); }
    });
  });
  extract.on('finish', () => pack.finalize());
  extract.end(gunzipSync(buffer));
  await finished;
  if (!patched) throw new Error('assets/main.py missing from game archive');
  return gzipSync(Buffer.concat(chunks));
}

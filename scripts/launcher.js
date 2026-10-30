import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// Windows .cmd requires cmd.exe. All arguments below are fixed, never user input.
function command(file, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && file.endsWith('.cmd') });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`${file} failed (${signal ?? code})`)));
  });
}
export function parseRoom(input) {
  let room = input.trim();
  if (room.startsWith('https://')) {
    const url = new URL(room);
    if (url.hostname !== 'chess-playing-ai.vercel.app') throw new Error('Link phải thuộc chess-playing-ai.vercel.app');
    room = url.searchParams.get('room') ?? '';
  }
  room = room.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(room)) throw new Error('Nhập mã phòng gồm 6 chữ/số hoặc link mời có ?room=');
  return room;
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Cần Node.js 22 trở lên: https://nodejs.org/');
  console.log('\n♞ Chess Bot Arena — mở game cùng Stockfish menu\n');
  const flags = process.argv.slice(2);
  if (flags.includes('--help')) { console.log('node scripts/launcher.js [--setup-only | --local | --room=ABC123]'); return; }
  const lockHash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  const stamp = resolve(root, 'node_modules/.arena-lock');
  const installed = ['playwright', 'stockfish', 'chess.js', 'tar-stream'].every(name => existsSync(resolve(root, 'node_modules', name, 'package.json')));
  if (!installed || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== lockHash || flags.includes('--setup-only')) {
    console.log('Cài thư viện từ package-lock.json…'); await command(npm, ['ci']); writeFileSync(stamp, lockHash);
  }
  console.log('Kiểm tra / tải Chromium (lần đầu có thể mất vài phút)…');
  await command(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  if (flags.includes('--setup-only')) { console.log('Cài đặt hoàn tất.'); return; }
  let target = flags.includes('--local') ? 'local' : undefined;
  const roomArg = flags.find(arg => arg.startsWith('--room='));
  if (roomArg) target = parseRoom(roomArg.slice(7));
  if (!target) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      console.log('1. Vào phòng online — bot cầm Đen\n2. Xem hai bot đấu với nhau');
      let mode;
      do { mode = (await rl.question('Chọn 1 hoặc 2 [1]: ')).trim() || '1'; } while (!['1', '2'].includes(mode));
      if (mode === '2') target = 'local';
      else while (!target) { try { target = parseRoom(await rl.question('Mã phòng / link mời: ')); } catch (error) { console.log(error.message); } }
    } finally { rl.close(); }
  }
  console.log('Đang mở game. Đóng cửa sổ game hoặc Ctrl+C để thoát.');
  await command(process.execPath, target === 'local' ? ['src/run.js'] : ['src/online.js', target]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\nKhông khởi động được: ${error.message}\nXem README.md → Khắc phục sự cố.`); process.exitCode = 1; });
}

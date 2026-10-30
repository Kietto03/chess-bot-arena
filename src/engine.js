import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
const require = createRequire(import.meta.url);
export class Engine {
  constructor(name, skill, log) {
    this.name = name;
    this.waiters = new Set();
    const file = join(dirname(require.resolve('stockfish/package.json')), 'bin/stockfish-19-lite-single.js');
    this.child = spawn(process.execPath, [file], { stdio: ['pipe', 'pipe', 'pipe'] });
    createInterface({ input: this.child.stdout }).on('line', line => {
      log({ type: 'uci', bot: name, line });
      for (const waiter of [...this.waiters]) if (line.startsWith(waiter.prefix)) waiter.resolve(line);
    });
    this.child.stderr.on('data', data => log({ type: 'engine-stderr', bot: name, message: String(data) }));
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', code => this.fail(new Error(`${name} exited (${code})`)));
    this.skill = skill;
  }
  fail(error) { this.error = error; for (const waiter of [...this.waiters]) waiter.reject(error); }
  send(command) { this.child.stdin.write(command + '\n'); }
  wait(prefix, timeout = 30000) {
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.waiters.delete(waiter); };
      const waiter = { prefix, resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } };
      const timer = setTimeout(() => waiter.reject(new Error(`${this.name}: timeout ${prefix}`)), timeout);
      this.waiters.add(waiter);
    });
  }
  async init() {
    let ready = this.wait('uciok'); this.send('uci'); await ready;
    this.send(`setoption name Skill Level value ${this.skill}`);
    this.send('setoption name Hash value 32');
    ready = this.wait('readyok'); this.send('isready'); await ready;
  }
  async move(fen, milliseconds) {
    const answer = this.wait('bestmove ', milliseconds + 30000);
    this.send(`position fen ${fen}`); this.send(`go movetime ${milliseconds}`);
    return (await answer).split(' ')[1];
  }
  close() { if (!this.child.killed) this.child.kill(); }
}

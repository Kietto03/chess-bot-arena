// Runs inside the game page. Shadow DOM keeps the game and widget styles isolated.
export function installWidget({ room = '', enabled = true, skill = 10, think = 700 } = {}) {
  if (document.getElementById('stockfish-widget')) return;
  const control = window.__botControl = { enabled, skill, think, revision: 0 };
  const host = document.createElement('div');
  host.id = 'stockfish-widget';
  Object.assign(host.style, { position: 'fixed', top: '24px', left: '24px', zIndex: '2147483647', width: '280px', maxWidth: 'calc(100vw - 16px)' });
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{color-scheme:dark;font:13px/1.5 system-ui,sans-serif;color:#e9edf5}
    *{box-sizing:border-box}section{background:#111820f5;border:1px solid #354251;border-radius:16px;box-shadow:0 16px 48px #0007;overflow:hidden;backdrop-filter:blur(16px)}
    header{display:flex;align-items:center;gap:9px;padding:13px 14px;cursor:grab;touch-action:none;user-select:none;border-bottom:1px solid #ffffff12}
    .icon{color:#b9f577;font-size:24px}strong{font-size:14px;letter-spacing:.2px}small{display:block;color:#8797a9;font-size:10px;letter-spacing:1.2px}
    button{font:inherit;cursor:pointer;border:1px solid #41505e;border-radius:8px;background:#23303d;color:#e9edf5;padding:7px 10px}button:hover{filter:brightness(1.18)}button:focus-visible,input:focus-visible{outline:2px solid #b9f577;outline-offset:3px}
    #fold{margin-left:auto;font-size:18px;padding:0 8px}main{padding:14px}.badge{display:flex;justify-content:space-between;color:#94a3b4;font-size:11px;margin-bottom:12px}.badge b{color:#b9f577}
    #toggle{width:100%;background:#b9f577;color:#182213;font-weight:750;border:0;padding:10px}.paused{background:#344253!important;color:#e9edf5!important}
    label{display:block;margin-top:15px;color:#b8c3d0;font-size:12px}label span{float:right;color:#f0f5fc}input{display:block;width:100%;margin:9px 0 0;accent-color:#b9f577}
    .status{margin-top:16px;padding:10px;background:#ffffff06;border:1px solid #ffffff0d;border-radius:9px;font-size:12px;overflow-wrap:anywhere}#status{color:#b9f577}#last{color:#a6b5c4;margin-top:3px;font-size:11px}
    #history{max-height:90px;overflow:auto;margin-top:10px;font:11px/1.7 ui-monospace,monospace;color:#a6b5c4;white-space:pre-wrap}.foot{color:#6f8296;font-size:10px;margin-top:10px}main[hidden]{display:none}
  </style><section><header><span class="icon">♞</span><div><strong>Stockfish</strong><small>BOT CONTROL</small></div><button id="fold" aria-label="Thu gọn" aria-expanded="true">−</button></header><main>
    <div class="badge"><span id="room"></span><b>● ĐEN</b></div>
    <button id="toggle"></button>
    <label for="skill">Sức mạnh <span id="skill-value"></span></label><input id="skill" aria-label="Sức mạnh" type="range" min="0" max="20" step="1">
    <label for="think">Suy nghĩ <span id="think-value"></span></label><input id="think" aria-label="Thời gian suy nghĩ" type="range" min="100" max="3000" step="100">
    <div class="status"><div id="status">Đang tải game…</div><div id="last">Chưa có nước đi</div></div>
    <div id="history" aria-label="Log nước đi"></div><div class="foot">Kéo thanh tiêu đề để di chuyển · Log được lưu tự động</div>
  </main></section>`;
  for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'wheel']) root.addEventListener(type, event => event.stopPropagation());
  document.body.append(host);
  const get = id => root.getElementById(id);
  get('room').textContent = room ? `PHÒNG ${room}` : 'LOCAL ARENA';
  const render = () => {
    get('toggle').textContent = control.enabled ? 'Ⅱ  Tạm dừng bot' : '▶  Bật bot';
    get('toggle').classList.toggle('paused', !control.enabled);
    get('toggle').setAttribute('aria-pressed', String(control.enabled));
    get('skill').value = control.skill; get('skill-value').textContent = `${control.skill} / 20`;
    get('think').value = control.think; get('think-value').textContent = `${control.think} ms`;
  };
  get('toggle').onclick = () => { control.enabled = !control.enabled; control.revision++; render(); };
  for (const key of ['skill', 'think']) get(key).oninput = event => { control[key] = Number(event.target.value); control.revision++; render(); };
  get('fold').onclick = () => { const main = root.querySelector('main'); main.hidden = !main.hidden; get('fold').textContent = main.hidden ? '+' : '−'; get('fold').setAttribute('aria-expanded', String(!main.hidden)); };
  let drag;
  const header = root.querySelector('header');
  header.onpointerdown = event => { if (event.target.closest('button')) return; const box = host.getBoundingClientRect(); drag = { x: event.clientX - box.x, y: event.clientY - box.y }; header.setPointerCapture(event.pointerId); };
  header.onpointermove = event => { if (!drag) return; const box = host.getBoundingClientRect(); host.style.left = `${Math.max(0, Math.min(innerWidth - box.width, event.clientX - drag.x))}px`; host.style.top = `${Math.max(0, Math.min(innerHeight - 55, event.clientY - drag.y))}px`; };
  header.onpointerup = header.onpointercancel = () => { drag = null; };
  window.__botWidgetUpdate = ({ status, last, entry } = {}) => {
    if (status) get('status').textContent = status;
    if (last) get('last').textContent = last;
    if (entry) { const lines = get('history').textContent.split('\n').filter(Boolean); lines.push(entry); get('history').textContent = lines.slice(-30).join('\n'); get('history').scrollTop = get('history').scrollHeight; }
  };
  render();
}

export async function updateWidget(page, update) {
  await page.evaluate(update => window.__botWidgetUpdate?.(update), update);
}

// Screenshot helper for the T-090 `-v3` evidence (headless Edge over the DevTools protocol, no dependencies). MOCKED API data only.
// Needs: node docs/evidence/mock-api-v3.mjs (port 3000) and `npm run dev` in client/ (port 5173). Usage: node docs/evidence/shoot-v3.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const SHOTS = [
  ['RES-01-dashboard-360-v3', 360], ['RES-02-dashboard-768-v3', 768], ['RES-02-dashboard-1024-v3', 1024], ['RES-02-dashboard-1280-v3', 1280],
  ['RES-04-expanded-360-v3', 360, 'expand'], ['RES-04-expanded-1280-v3', 1280, 'expand'], ['RES-03-search-360-v3', 360, 'search'], ['RES-03-search-1280-v3', 1280, 'search'],
];
const ACTIONS = {
  expand: "[...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('View all tasks')).click()",
  search: "(() => { const i = document.getElementById('task-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'lab'); i.dispatchEvent(new Event('input', { bubbles: true })); })()",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--user-data-dir=' + process.env.TEMP + '\\t090-edge-v3', 'about:blank'], { stdio: 'ignore' });
await sleep(3000);
const target = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { id += 1; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalValue = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
for (const [name, width, action] of SHOTS) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
  await sleep(4000);
  if (action) { await evalValue(ACTIONS[action]); await sleep(1500); }
  const height = await evalValue('document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(OUT + name + '.png', Buffer.from(shot.data, 'base64'));
  const overflow = await evalValue('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  const rows = await evalValue("document.querySelectorAll('.task-item').length");
  const bar = await evalValue("!!document.querySelector('.filter-bar')");
  console.log(name, 'height', height, 'horizontal overflow px', overflow, 'task rows', rows, 'filter bar', bar);
}
ws.close();
edge.kill();
process.exit(0);

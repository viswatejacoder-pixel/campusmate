// Screenshot helper for the T-090 `-v2` evidence (headless Edge over the DevTools protocol, no dependencies).
// Needs: node docs/evidence/mock-api-v2.mjs (port 3000) and `npm run dev` in client/ (port 5173). Usage: node docs/evidence/shoot-v2.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const SHOTS = [['RES-01-dashboard-360-v2', 360], ['RES-02-dashboard-768-v2', 768], ['RES-02-dashboard-1024-v2', 1024], ['RES-02-dashboard-1280-v2', 1280]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--user-data-dir=' + process.env.TEMP + '\\t090-edge', 'about:blank'], { stdio: 'ignore' });
await sleep(3000);
const target = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { id += 1; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
for (const [name, width] of SHOTS) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
  await sleep(4000);
  const dims = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true });
  const height = dims.result.value;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(OUT + name + '.png', Buffer.from(shot.data, 'base64'));
  const overflow = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollWidth - document.documentElement.clientWidth', returnByValue: true });
  console.log(name, 'height', height, 'horizontal overflow px', overflow.result.value);
}
ws.close();
edge.kill();
process.exit(0);

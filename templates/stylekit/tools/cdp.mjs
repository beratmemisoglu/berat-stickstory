// Toon Studio Style Kit: a no-dependency Chrome DevTools client. Finds the installed Chrome / Edge (per OS, CZ_BROWSER
// overrides), launches it headless (never a window, muted, its own temporary profile), and drives pages over the
// DevTools protocol with Node's built-in WebSocket: open a page at a size, evaluate, collect page errors, console
// warnings / errors and failed requests (HTTP >= 400), close.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

/** The browser the kit renders with: { path, name } or null. Windows: Chrome, then Edge (always installed). macOS:
 *  Google Chrome, Chromium, Microsoft Edge, Brave in /Applications (or ~/Applications). Linux: google-chrome, chromium. */
export function findBrowser() {
  const env = process.env.CZ_BROWSER;
  if (env) return fs.existsSync(env) ? { path: env, name: path.basename(env) } : null;
  const c = [];
  if (process.platform === 'win32') {
    const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of pf) c.push([path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'Google Chrome']);
    for (const r of pf) c.push([path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), 'Microsoft Edge']);
  } else if (process.platform === 'darwin') {
    for (const r of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      c.push([path.join(r, 'Google Chrome.app/Contents/MacOS/Google Chrome'), 'Google Chrome'], [path.join(r, 'Chromium.app/Contents/MacOS/Chromium'), 'Chromium'],
        [path.join(r, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'), 'Microsoft Edge'], [path.join(r, 'Brave Browser.app/Contents/MacOS/Brave Browser'), 'Brave']);
    }
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']) {
      for (const d of (process.env.PATH || '').split(path.delimiter)) if (d) c.push([path.join(d, n), n]);
    }
  }
  const hit = c.find(([p]) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  return hit ? { path: hit[0], name: hit[1] } : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** A headless browser. `launch()` -> { newPage, probe, close, name, version }. */
export async function launch(opts = {}) {
  const b = findBrowser();
  if (!b) throw new Error(process.env.CZ_BROWSER ? `CZ_BROWSER points at ${process.env.CZ_BROWSER}, which does not exist.` : process.platform === 'darwin'
    ? 'No Chrome, Chromium, Edge or Brave found in Applications. Install Google Chrome (or set CZ_BROWSER to a Chromium browser).'
    : process.platform === 'win32' ? 'No Chrome or Edge found. Install Google Chrome or Microsoft Edge (or set CZ_BROWSER).' : 'No Chrome or Chromium found on PATH (or set CZ_BROWSER).');
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cz-browser-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDir}`, '--mute-audio', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-component-update',
    '--disable-features=Translate,MediaRouter,OptimizationHints,DialMediaRouteProvider', '--autoplay-policy=no-user-gesture-required',
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), ...(opts.args ?? []), 'about:blank'];
  const proc = spawn(b.path, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], detached: false });
  let stderr = ''; proc.stderr.on('data', d => { stderr = (stderr + d).slice(-4000); });
  let exited = null; proc.on('exit', c => { exited = c ?? -1; });
  const portFile = path.join(userDir, 'DevToolsActivePort');
  let wsPath = null, port = 0;
  for (const t0 = Date.now(); Date.now() - t0 < 30000;) {
    if (exited != null) break;
    try { const [p, w] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/); if (p && w) { port = +p; wsPath = w; break; } } catch { /* not yet */ }
    await sleep(50);
  }
  if (!wsPath) { try { proc.kill(); } catch { /* gone */ } rmDir(userDir); throw new Error(`${b.name} did not start headless (${exited != null ? `it exited with ${exited}` : 'no DevTools port after 30 s'}). ${stderr.split('\n').filter(Boolean).slice(-3).join(' ')}`); }
  if (typeof WebSocket !== 'function') throw new Error('This Node has no built-in WebSocket: use Node 22 or newer (or the Toon Studio app as the runtime).');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('Could not connect to the browser\'s DevTools port.')); });
  let nextId = 1; const pending = new Map(), listeners = new Set();
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch { return; }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result); return; }
    if (m.method) for (const l of listeners) l(m);
  };
  ws.onclose = () => { for (const p of pending.values()) p.rej(new Error('The browser closed.')); pending.clear(); };
  // (big results - a full-size PNG as a data URL - can make the DevTools socket drop: pages send pictures to the kit
  // server's frame sink instead; a send on a closed socket fails at once instead of waiting forever)
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    if (ws.readyState !== 1) return rej(new Error('The browser closed.'));
    const id = nextId++; pending.set(id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const version = await send('Browser.getVersion').then(v => v.product).catch(() => b.name);
  const pages = new Set();

  async function newPage(url, { width = 1280, height = 720, onConsole } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    const page = { targetId, sessionId, errors: [], console: [], failed: [], closed: false };
    const on = m => {
      if (m.sessionId !== sessionId) return;
      const p = m.params || {};
      if (m.method === 'Runtime.exceptionThrown') { const d = p.exceptionDetails || {}; page.errors.push(String(d.exception?.description || d.text || 'error').split('\n')[0]); }
      else if (m.method === 'Runtime.consoleAPICalled') {
        const text = (p.args || []).map(a => a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description ?? a.type).join(' ');
        if (p.type === 'error' || p.type === 'warning') page.console.push({ level: p.type === 'warning' ? 'warn' : 'error', text });
        onConsole?.(p.type, text);
      // (a HEAD request asks "is it there?": host.js probes optional files that way, so its 404 is an answer, not a failure)
      } else if (m.method === 'Network.responseReceived') { const r = p.response || {}; if (r.status >= 400 && page.reqs?.get(p.requestId)?.method !== 'HEAD') page.failed.push({ url: r.url, status: r.status }); }
      else if (m.method === 'Network.loadingFailed') { const q = page.reqs?.get(p.requestId); if (!p.canceled && !/ERR_ABORTED/.test(p.errorText || '') && q?.method !== 'HEAD') page.failed.push({ url: q?.url || p.requestId, status: 0, error: p.errorText }); }
      else if (m.method === 'Network.requestWillBeSent') { (page.reqs ||= new Map()).set(p.requestId, { url: p.request?.url, method: p.request?.method }); }
    };
    listeners.add(on); pages.add(page);
    await Promise.all([s('Page.enable'), s('Runtime.enable'), s('Network.enable'), s('Network.setCacheDisabled', { cacheDisabled: true })]);
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await s('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    page.evaluate = async (expression, { timeout = 120000, awaitPromise = true } = {}) => {
      let timer; const dl = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`The page did not answer within ${Math.round(timeout / 1000)} s (a scene stuck in a loop, or a very slow graphics card).`)), timeout); });
      try {
        const r = await Promise.race([s('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true }), dl]);
        if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluate failed').split('\n')[0]);
        return r.result?.value;
      } finally { clearTimeout(timer); }
    };
    page.waitFor = async (expression, timeout = 180000) => {
      const t0 = Date.now();
      for (;;) { const v = await page.evaluate(expression, { timeout: 15000 }).catch(() => false); if (v) return v; if (Date.now() - t0 > timeout) throw new Error(`Timed out after ${Math.round(timeout / 1000)} s waiting for the page.`); await sleep(100); }
    };
    page.goto = async u => { await s('Page.navigate', { url: u }); };
    page.screenshot = async () => Buffer.from((await s('Page.captureScreenshot', { format: 'png' })).data, 'base64');
    page.close = async () => { if (page.closed) return; page.closed = true; listeners.delete(on); pages.delete(page); await Promise.race([send('Target.closeTarget', { targetId }).catch(() => {}), sleep(5000)]); };
    if (url) await page.goto(url);
    return page;
  }

  /** What this browser can do: H.264 encoding (WebCodecs) and the WebGL renderer (software = slow). Needs a page on a
   *  secure origin (the kit server's /__kit/blank.html). */
  async function probe(url) {
    const p = await newPage(url, { width: 320, height: 200 });
    try {
      await p.waitFor('document.readyState === "complete"', 20000);
      return await p.evaluate(`(async () => {
        const r = { h264: false, h264hw: false, gl: null, software: false };
        try { const base = { codec: 'avc1.640032', width: 1920, height: 1080, bitrate: 16e6, framerate: 30, avc: { format: 'annexb' } };
          r.h264 = !!(await VideoEncoder.isConfigSupported(base)).supported;
          r.h264hw = !!(await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: 'prefer-hardware' })).supported; } catch (e) { r.h264err = String(e && e.message || e); }
        try { const gl = document.createElement('canvas').getContext('webgl2'); const x = gl && gl.getExtension('WEBGL_debug_renderer_info');
          r.gl = gl ? String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null; } catch (e) { r.gl = null; }
        r.software = !r.gl || /swiftshader|llvmpipe|software|basic render/i.test(r.gl);
        return r; })()`, { timeout: 30000 });
    } finally { await p.close(); }
  }

  async function close() {
    for (const p of [...pages]) await p.close().catch(() => {});
    try { await Promise.race([send('Browser.close'), sleep(3000)]); } catch { /* gone */ }
    try { ws.close(); } catch { /* closed */ }
    for (let k = 0; k < 30 && exited == null; k++) await sleep(100);
    if (exited == null) { try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); else proc.kill('SIGKILL'); } catch { /* gone */ } }
    rmDir(userDir);
  }
  return { name: b.name, path: b.path, version, newPage, probe, close };
}
function rmDir(d) { for (let k = 0; k < 5; k++) { try { fs.rmSync(d, { recursive: true, force: true }); return; } catch { const t = Date.now(); while (Date.now() - t < 200) { /* wait for the browser to let go */ } } } }

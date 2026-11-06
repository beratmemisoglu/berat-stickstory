// Load berat studio's own main-process code (appcore/main/index.js) as a library,
// without Electron and without starting the app: `electron` is a stand-in whose app never becomes ready (so no window, no
// server, no updater starts), pointed at berat studio's own folders. The app's functions are then called directly - its
// project setup, CLAUDE.md writer, build instructions, crew agents and Claude tools - so berat studio says and does exactly
// what the app does. Anything that needs a real Electron window (render pages) is done by pipeline/suite.mjs instead.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const cp = require('node:child_process');

const ROOT = path.dirname(__dirname);                         // toon-studio
const USERDATA = path.join(ROOT, 'appdata');                  // the app's userData (config.json, logs, caches)
fs.mkdirSync(USERDATA, { recursive: true });
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'studio.json'), 'utf8'));

// ---- nativeImage: the few calls the app makes (pictures for Flow / Higgsfield, sizes), through Python + Pillow
function pyImage(op, input, arg) {
  const code = 'import sys,io,base64,json\nfrom PIL import Image\nop=sys.argv[1]\nraw=sys.stdin.buffer.read()\n' +
    'im=Image.open(io.BytesIO(raw))\n' +
    'if op=="size": print(json.dumps([im.width,im.height]))\n' +
    'elif op=="png": b=io.BytesIO(); im.save(b,"PNG"); sys.stdout.buffer.write(b.getvalue())\n' +
    'elif op=="jpeg": b=io.BytesIO(); im.convert("RGB").save(b,"JPEG",quality=int(sys.argv[2])); sys.stdout.buffer.write(b.getvalue())\n' +
    'elif op=="resize": w,h=json.loads(sys.argv[2]); b=io.BytesIO(); im.resize((w,h),Image.LANCZOS).save(b,"PNG"); sys.stdout.buffer.write(b.getvalue())\n';
  const r = cp.spawnSync(CFG.python, ['-I', '-c', code, op, arg ?? ''], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) return null;
  return r.stdout;
}
class NativeImage {
  constructor(buf) { this.buf = buf && buf.length ? buf : null; this._size = null; }
  isEmpty() { return !this.buf || !this.getSize().width; }
  getSize() {
    if (!this._size) { const o = this.buf ? pyImage('size', this.buf) : null; const [w, h] = o ? JSON.parse(String(o)) : [0, 0]; this._size = { width: w, height: h }; }
    return this._size;
  }
  getAspectRatio() { const s = this.getSize(); return s.height ? s.width / s.height : 1; }
  toPNG() { return this.buf ? pyImage('png', this.buf) ?? Buffer.alloc(0) : Buffer.alloc(0); }
  toJPEG(q = 90) { return this.buf ? pyImage('jpeg', this.buf, String(q)) ?? Buffer.alloc(0) : Buffer.alloc(0); }
  toDataURL() { return 'data:image/png;base64,' + this.toPNG().toString('base64'); }
  resize(o) {
    const s = this.getSize(), w = o.width ?? Math.round(s.width * (o.height / s.height)), h = o.height ?? Math.round(s.height * (o.width / s.width));
    return new NativeImage(pyImage('resize', this.buf, JSON.stringify([Math.max(1, Math.round(w)), Math.max(1, Math.round(h))])));
  }
  crop(r) { return this; }
}
const nativeImage = {
  createFromPath: (f) => { try { return new NativeImage(fs.readFileSync(f)); } catch { return new NativeImage(null); } },
  createFromBuffer: (b) => new NativeImage(b),
  createFromDataURL: (u) => new NativeImage(Buffer.from(String(u).split(',')[1] || '', 'base64')),
  createEmpty: () => new NativeImage(null)
};

// ---- BrowserWindow: the app's hidden render windows, as pages of one headless Chrome driven over CDP. The app only
// loads its own local pages in them (host.html / blender.html / the prop and hold viewers) and talks to them with
// executeJavaScript and console messages, so this is all it needs.
const net = require('node:net');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chromeP = null;
function chrome() {
  if (chromeP) return chromeP;
  chromeP = (async () => {
    const exe = [CFG.chrome, ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
      .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))].find((p) => p && fs.existsSync(p));
    if (!exe) throw new Error('Google Chrome is not installed (the render pages run in it).');
    const port = await new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const prof = path.join(ROOT, '.render-chrome'); fs.mkdirSync(prof, { recursive: true });
    const proc = cp.spawn(exe, [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
      `--remote-allow-origins=http://127.0.0.1:${port}`, '--no-first-run', '--no-default-browser-check', '--headless=new', '--use-angle=d3d11',
      '--force_high_performance_gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'],
    { stdio: 'ignore', windowsHide: true });
    process.on('exit', () => { try { proc.kill(); } catch {} });
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return { port, proc }; } catch {} await sleep(250); }
    throw new Error('Chrome did not start for the render pages.');
  })();
  chromeP.catch(() => { chromeP = null; });
  return chromeP;
}
class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) { this._h.set(ev, [...this._h.get(ev) ?? [], fn]); return this; }
  once(ev, fn) { const w = (...a) => { this.off(ev, w); fn(...a); }; return this.on(ev, w); }
  off(ev, fn) { this._h.set(ev, (this._h.get(ev) ?? []).filter((f) => f !== fn)); return this; }
  removeListener(ev, fn) { return this.off(ev, fn); }
  emit(ev, ...a) { for (const f of this._h.get(ev) ?? []) try { f(...a); } catch {} }
}
const LEVEL = { error: 3, warning: 2, info: 1, log: 1, debug: 0 };
class WebContents extends Emitter {
  constructor(win) { super(); this.win = win; this.ws = null; this.id = 0; this.pending = new Map(); this.url = ''; }
  async attach() {
    if (this.ws) return;
    const c = await chrome();
    this.target = await (await fetch(`http://127.0.0.1:${c.port}/json/new?about:blank`, { method: 'PUT' })).json();
    this.ws = new WebSocket(this.target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('Could not connect to the render page.')); });
    this.ws.onmessage = (m) => {
      const msg = JSON.parse(typeof m.data === 'string' ? m.data : String(m.data));
      if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); return; }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const message = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '), level = msg.params.type === 'warning' ? 'warning' : msg.params.type;
        this.emit('console-message', { message, level, sourceId: '', lineNumber: 0, preventDefault() {} }, LEVEL[level] ?? 1, message);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const message = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'error';
        this.emit('console-message', { message, level: 'error', preventDefault() {} }, 3, message);
      } else if (msg.method === 'Inspector.targetCrashed') { this.emit('render-process-gone', {}, { reason: 'crashed' }); }
      else if (msg.method === 'Page.loadEventFired') this._loaded?.();
    };
    this.ws.onclose = () => { for (const p of this.pending.values()) p.rej(new Error('The render page was closed.')); this.pending.clear(); };
    await Promise.all([this.cdp('Page.enable'), this.cdp('Runtime.enable'), this.cdp('Inspector.enable').catch(() => {})]);
    await this.cdp('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    const o = this.win.opts || {};
    if (o.width && o.height) await this.cdp('Emulation.setDeviceMetricsOverride', { width: o.width, height: o.height, deviceScaleFactor: 1, mobile: false }).catch(() => {});
  }
  cdp(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async loadURL(url) {
    await this.attach(); this.url = url;
    const loaded = new Promise((r) => { this._loaded = r; });
    await this.cdp('Page.navigate', { url });
    await Promise.race([loaded, sleep(6e4)]);
  }
  async executeJavaScript(code) {
    if (this.win.destroyed) throw new Error('Object has been destroyed');
    await this.attach();
    const r = await this.cdp('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text || 'Script failed');
    return r.result.value;
  }
  async capturePage() { await this.attach(); const r = await this.cdp('Page.captureScreenshot', { format: 'png' }); return nativeImage.createFromBuffer(Buffer.from(r.data, 'base64')); }
  getURL() { return this.url; }
  setWindowOpenHandler() {} setAudioMuted() {} setZoomFactor() {} getZoomFactor() { return 1; } openDevTools() {} send() {}
  insertText(t) { return this.attach().then(() => this.cdp('Input.insertText', { text: t })); }
  forcefullyCrashRenderer() { this.win.destroy(); }
  isDestroyed() { return this.win.destroyed; }
  close() { this.win.destroy(); }
}
class BrowserWindow extends Emitter {
  constructor(opts = {}) { super(); this.opts = opts; this.destroyed = false; this.webContents = new WebContents(this); }
  loadURL(url) { return this.webContents.loadURL(url); }
  loadFile(f) { return this.webContents.loadURL(require('node:url').pathToFileURL(f).href); }
  isDestroyed() { return this.destroyed; }
  destroy() {
    if (this.destroyed) return; this.destroyed = true;
    const wc = this.webContents;
    try { wc.ws?.close(); } catch {}
    if (wc.target) chrome().then((c) => fetch(`http://127.0.0.1:${c.port}/json/close/${wc.target.id}`)).catch(() => {});
    this.emit('closed');
  }
  close() { this.destroy(); }
  show() {} hide() {} showInactive() {} focus() {} minimize() {} maximize() {} restore() {} setTitleBarOverlay() {}
  isVisible() { return false; } isMinimized() { return false; } isMaximized() { return false; } isFocused() { return false; }
  getContentSize() { return [this.opts.width || 1280, this.opts.height || 720]; } getNormalBounds() { return { x: 0, y: 0, width: 1280, height: 720 }; }
  static getAllWindows() { return []; } static fromWebContents() { return null; }
}

// ---- the electron stand-in
const noop = () => {};
const deep = (name) => new Proxy(function () {}, {
  get: (_, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => `[stub ${name}]` : deep(`${name}.${String(k)}`),
  apply: () => undefined,
  construct: () => { throw new Error(`berat studio has no Electron: ${name} needs the app (a window or a web view).`); }
});
const app = {
  isPackaged: true,
  getPath: (n) => n === 'userData' || n === 'appData' ? USERDATA : n === 'temp' ? require('node:os').tmpdir() : n === 'home' ? require('node:os').homedir()
    : n === 'documents' ? path.join(require('node:os').homedir(), 'Documents') : n === 'logs' ? path.join(USERDATA, 'logs') : n === 'exe' ? process.execPath : USERDATA,
  getAppPath: () => path.join(ROOT, 'appcore'),
  getVersion: () => '0.20.0',
  getName: () => 'berat studio',
  whenReady: () => new Promise(noop),                         // never ready: the app's startup never runs
  isReady: () => false,
  on: noop, once: noop, off: noop, removeListener: noop, quit: noop, exit: noop, relaunch: noop, focus: noop,
  requestSingleInstanceLock: () => true, setAppUserModelId: noop, setName: noop, setPath: noop, commandLine: { appendSwitch: noop, hasSwitch: () => false },
  disableHardwareAcceleration: noop, getGPUFeatureStatus: () => ({}), setLoginItemSettings: noop, dock: deep('app.dock')
};
const electron = new Proxy({
  app, nativeImage,
  ipcMain: { handle: noop, on: noop, once: noop, removeHandler: noop, removeAllListeners: noop },
  shell: {
    // the app sends replaced files to the Recycle Bin: here they go to toon-studio/.trash
    trashItem: async (f) => { const t = path.join(ROOT, '.trash'); fs.mkdirSync(t, { recursive: true }); fs.renameSync(f, path.join(t, `${Date.now()}-${path.basename(f)}`)); },
    openExternal: async () => {}, openPath: async () => '', showItemInFolder: noop
  },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => String(b) },
  BrowserWindow, screen: deep('screen'), dialog: deep('dialog'), Menu: deep('Menu'), Tray: deep('Tray'),
  powerSaveBlocker: { start: () => 0, stop: noop, isStarted: () => false }, powerMonitor: { on: noop }, nativeTheme: { on: noop, shouldUseDarkColors: false },
  session: deep('session'), protocol: deep('protocol'), webContents: deep('webContents'), net: deep('net'), crashReporter: deep('crashReporter'),
  systemPreferences: deep('systemPreferences'), clipboard: deep('clipboard'), desktopCapturer: deep('desktopCapturer'), utilityProcess: deep('utilityProcess')
}, { get: (t, k) => k in t ? t[k] : deep(`electron.${String(k)}`) });

// ---- load the bundle with its internals exported
const stubs = { electron, 'electron-updater': { autoUpdater: deep('autoUpdater') } };
const origResolve = Module._resolveFilename;
const nodeModules = path.join(__dirname, 'node_modules');
Module._resolveFilename = function (req, parent, ...r) {
  if (req in stubs) return req;
  try { return origResolve.call(this, req, parent, ...r); }
  catch (e) { return origResolve.call(this, req, { ...parent, paths: [nodeModules] }, ...r); }
};
const origLoad = Module._load;
Module._load = function (req, ...r) { return req in stubs ? stubs[req] : origLoad.call(this, req, ...r); };
Object.defineProperty(process, 'resourcesPath', { value: ROOT });  // templatesDir() = toon-studio/templates

// the part of the app's startup that sets up its data (and nothing that opens a window, a server or the updater):
// ensureWorkspace, openDb + migrations, the built-in looks (seedPresets), the style files
const INIT = ['ensureWorkspace', 'openDb', 'ws', 'seedPresets', 'writeStyleFiles'];
function load(names) {
  const file = path.join(__dirname, 'main', 'index.js');
  const all = [...new Set([...INIT, ...names])];
  // the app's keys live encrypted in its own secrets file; berat studio reads them from environment variables instead
  // (never written to a file): ELEVENLABS_API_KEY, HIGGSFIELD_API_KEY, FAL_KEY, FISH_AUDIO_API_KEY
  const envKeys = `{ elevenlabs: 'ELEVENLABS_API_KEY', higgsfield: 'HIGGSFIELD_API_KEY', fal: 'FAL_KEY', fishaudio: 'FISH_AUDIO_API_KEY' }`;
  const patch = `\n{ const __gs = getSecret, __env = ${envKeys};
    getSecret = function (n) { return __gs(n) || (__env[n] && process.env[__env[n]]) || null; }; }\n`;
  const src = fs.readFileSync(file, 'utf8') + patch + `\nmodule.exports = { ${all.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} };\n`;
  const m = new Module(file, module);
  m.filename = file; m.paths = [path.join(__dirname, 'main'), nodeModules, ...Module._nodeModulePaths(__dirname)];
  m._compile(src, file);
  const A = m.exports;
  A.ensureWorkspace(); A.openDb(A.ws.db()); A.seedPresets();
  try { A.writeStyleFiles(); } catch {}
  return A;
}
module.exports = { load, ROOT, USERDATA, chrome };

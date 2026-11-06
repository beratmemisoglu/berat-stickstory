#!/usr/bin/env node
// Headless render host for pixel-explainer projects. Serves the project folder, launches the system
// Chrome/Edge (puppeteer-core), and drives the engine. No browser pane or GUI needed.
//
//   node render.mjs <project> video   [--fps 30] [--from 0] [--to END] [--bitrate 10e6] [--name video]
//   node render.mjs <project> stills  --times 3.1,12.5,40 [--name check] [--scale 0.5]
//   node render.mjs <project> events                      (writes audio/events.json for sound design)
//   node render.mjs <project> serve   [--port 8765]       (live preview at http://localhost:PORT)
//
// Outputs land in <project>/out/. `video` writes out/<name>.h264 and, if ffmpeg exists, muxes
// out/<name>.mp4 with the project's mix (audio/final_mix.wav, else audio/clean.wav).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [, , projArg, mode = 'video', ...rest] = process.argv;
if (!projArg) { console.error('usage: node render.mjs <project> video|stills|events|serve [opts]'); process.exit(1); }
const PROJ = path.resolve(projArg);
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
let PORT = +(opt.port || (mode === 'serve' ? 8765 : 0));   // 0 = any free port
const OUT = path.join(PROJ, 'out'); fs.mkdirSync(OUT, { recursive: true });

// ---------- static server + sinks ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST') {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const body = Buffer.concat(chunks);
      let m;
      if ((m = url.match(/^\/frame\/([\w-]+)\/(\d+)$/))) {
        const d = path.join(OUT, `${m[1]}_frames`); fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, String(+m[2]).padStart(6, '0') + '.png'), body);
      } else if ((m = url.match(/^\/append\/([\w-]+)$/))) {
        const f = path.join(OUT, `${m[1]}.h264`);
        if (req.url.includes('reset=1')) fs.writeFileSync(f, body); else fs.appendFileSync(f, body);
      } else if ((m = url.match(/^\/save\/([\w./-]+)$/))) {
        const f = path.join(PROJ, m[1]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body);
      } else { res.writeHead(404); return res.end(); }
      res.writeHead(204); res.end();
    });
    return;
  }
  const f = path.join(PROJ, url === '/' ? 'index.html' : url);
  if (!f.startsWith(PROJ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
PORT = server.address().port;
if (mode === 'serve') { console.log(`preview: http://localhost:${PORT}/index.html  (Ctrl+C to stop)`); await new Promise(() => {}); }

// ---------- browser ----------
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return c.find(p => p && fs.existsSync(p));
}
const exe = findChrome();
if (!exe) { console.error('No Chrome/Edge/Chromium found. Install one or set CHROME_PATH.'); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', protocolTimeout: 0,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
         '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1400,900',
         ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !t.startsWith('Failed to load resource')) || t.startsWith('cue miss') || t.startsWith('scene module')) { errors.push(t); console.log('[page]', t); }
                         if (t.startsWith('PROGRESS')) process.stdout.write('\r' + t + '   '); });
page.on('response', r => { if (r.status() >= 400) { errors.push(`HTTP ${r.status()} ${r.url()}`); console.log('[page] missing file:', r.url()); } });
page.on('pageerror', e => { errors.push(String(e)); console.log('[page error]', e.message); });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
try { await page.waitForFunction('window.ready === true', { timeout: 90000 }); }
catch { console.error('PAGE FAILED TO LOAD (window.ready never set). Errors:\n  ' + (errors.join('\n  ') || 'none captured - open `serve` mode in a browser and check the console'));
        await browser.close(); server.close(); process.exit(4); }
const info = await page.evaluate(() => ({ end: window.END, shots: window.E.SHOTS.length, sceneErrors: window.sceneErrors,
  gpu: (() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c?.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() }));
console.log(`project loaded: ${info.shots} shots, ${info.end}s, GPU: ${info.gpu}`);
if (info.sceneErrors.length) { console.log('SCENE MODULE ERRORS:\n  ' + info.sceneErrors.join('\n  ')); }
if (/SwiftShader|llvmpipe|software/i.test(info.gpu)) console.log('WARNING: software WebGL - rendering will be slow. Check GPU drivers / flags.');

let code = 0;
try {
  if (mode === 'video') {
    const name = opt.name || 'video', fps = +(opt.fps || 30), from = +(opt.from || 0), to = +(opt.to || info.end);
    const res = await page.evaluate(async (a) => {
      window.exporting = true;
      return await window.E.exportVideo({ ...a, onProgress: (f, n, s) => console.log(`PROGRESS ${f}/${n} frames  ${(f / Math.max(s, .001)).toFixed(0)} fps`) });
    }, { name, fps, from, to, bitrate: +(opt.bitrate || 10e6) });
    console.log('\nrender:', JSON.stringify(res));
    const h264 = path.join(OUT, `${name}.h264`), mp4 = path.join(OUT, `${name}.mp4`);
    const mix = ['final_mix.wav', 'clean.wav'].map(f => path.join(PROJ, 'audio', f)).find(f => fs.existsSync(f));
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-r', String(fps), '-i', h264, ...(mix && from === 0 ? ['-i', mix, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k'] : []),
      '-c:v', 'copy', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    if (ff.status === 0) { fs.unlinkSync(h264); console.log('wrote', mp4, mix && from === 0 ? `(audio: ${path.basename(mix)})` : '(no audio)'); }
    else console.log('ffmpeg mux failed; raw stream kept at', h264);
  } else if (mode === 'stills') {
    const times = (opt.times || '').split(',').map(Number).filter(x => !isNaN(x));
    const name = opt.name || 'check', scale = +(opt.scale || .5);
    fs.rmSync(path.join(OUT, `${name}_frames`), { recursive: true, force: true });
    for (let i = 0; i < times.length; i += 8)                                  // batches keep each evaluate short
      await page.evaluate(async (a) => { window.exporting = true; await window.E.checkFrames(a.t, a.name, a.scale); }, { t: times.slice(i, i + 8), name, scale });
    console.log(`wrote ${times.length} stills to out/${name}_frames/`);
  } else if (mode === 'events') {
    const ev = await page.evaluate(async () => { window.exporting = true; return await window.E.collectEvents(window.END); });
    fs.writeFileSync(path.join(PROJ, 'audio', 'events.json'), JSON.stringify(ev, null, 1));
    console.log(`events: ${ev.shots.length} shots, ${ev.hits.length} accents, ${ev.cards.length} cards -> audio/events.json`);
  } else { console.error('unknown mode', mode); code = 1; }
} catch (e) { console.error('RENDER FAILED:', e.message); code = 3; }
if (errors.length) { console.log(`\n${errors.length} page error(s) logged above - fix them before delivering.`); }
await browser.close(); server.close(); process.exit(code);

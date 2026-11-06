// Toon Studio Style Kit: the local server. Serves every style exactly the way the app's server (src/main/server.ts)
// serves a project, so a style previews, checks and renders like it will in the app:
//   /p/<style>/...                 the style folder (styles/<style>/: engine at the root, scenes/, assets/, audio/, project.json)
//   /p/<style>/__suite/...         the host page (templates/host: the installed app's when kit.json.appTemplates exists)
//   POST /p/<style>/__suite/append/<name>[?reset=1]   encoded H.264 -> styles/<style>/out/<name>.h264
//   POST /p/<style>/__suite/frame/<batch>/<n>         PNG frames -> styles/<style>/.suite/frames/<batch>/
//   /p/<style>/__lib/...           the low-poly library (index.json + allow-listed files; the app's, read-only)
//   /p/<style>/__anims/catalog.json   { version: 1, builtin, user: [] }   /p/<style>/__chars3d/index.json (empty)
//   /p/<style>/__library/<id>/v<N>/... a built-in Library entry delivered by reference
//   /__kit/player.html, /__kit/blank.html, /health
// 127.0.0.1 only, Host (and Origin) checked: a web page elsewhere can't read the files (DNS rebinding).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { KIT, STYLES, appTemplates, hostDir, readJson, exists, settingsFor } from './kitlib.mjs';

export const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.srt': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.webm': 'video/webm', '.gif': 'image/gif', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac', '.pdf': 'application/pdf',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2',
  '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream' };
const NAME = /^[A-Za-z0-9][\w-]{0,60}$/;
const LIB_ID_RX = /^(look|module|pitfall|pose|recipe|solution)\.[a-z0-9-]{1,40}\.[a-z0-9-]{1,48}$/;

const low = x => process.platform === 'win32' ? x.toLowerCase() : x;
/** A path inside root, following symlinks (server.ts inside). null = outside. */
function inside(root, rel) {
  const f = path.resolve(root, rel);
  if (f !== root && !f.startsWith(root + path.sep)) return null;
  try { const rf = fs.realpathSync.native(f), rr = fs.realpathSync.native(root); return low(rf) === low(rr) || low(rf).startsWith(low(rr) + path.sep) ? rf : null; }
  catch { return f; }
}
function sendFile(req, res, f) {
  let st; try { st = fs.statSync(f); } catch { res.writeHead(404); return res.end(); }
  if (st.isDirectory()) { res.writeHead(404); return res.end(); }
  const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const stream = opts => { const rs = fs.createReadStream(f, opts).on('error', () => res.destroy()); res.on('close', () => rs.destroy()); rs.pipe(res); };
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range.trim());
  if (range && (range[1] || range[2]) && st.size > 0) {
    const start = range[1] ? +range[1] : Math.max(0, st.size - +range[2]), end = range[1] && range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    return stream({ start, end });
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  stream();
}
const sendJson = (res, v) => { res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(v)); };
const notFound = res => { res.writeHead(404); res.end(); };
const readBody = req => new Promise((ok, no) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });

/** The shared, read-only content the app serves to every project: from the installed app when it is there, else the kit's copy. */
function sharedDirs() {
  const app = appTemplates();
  return {
    lowpoly: [app && path.join(app, 'lowpoly', 'library'), path.join(KIT, 'shared', 'lowpoly-library')].find(d => d && exists(path.join(d, 'index.json'))) || null,
    anims: [app && path.join(app, 'recon', 'assets', 'anims', 'builtin.json'), path.join(KIT, 'bases', 'recon', 'engine', 'assets', 'anims', 'builtin.json')].find(f => f && exists(f)) || null,
    library: [app && path.join(app, 'library'), path.join(KIT, 'shared', 'library')].find(d => d && exists(d)) || null,
    figures: app ? path.join(app, 'recon', 'assets', 'figures') : null,
  };
}
let lpCache = null;
function lowpolyIndex(seed) {
  const f = path.join(seed, 'index.json'); let mt = 0; try { mt = fs.statSync(f).mtimeMs; } catch { /* none */ }
  if (lpCache?.key === f + mt) return lpCache.idx;
  const idx = { version: 1, about: 'Merged low-poly library: the app seed + this computer\'s own finds.', entries: readJson(f, {})?.entries || [] };
  lpCache = { key: f + mt, idx }; return idx;
}

/**
 * Start the kit server. `roots`: extra { name: folder } served at /p/<name>/ (e.g. a temporary check workspace); every
 * styles/<name>/ folder is served by default.
 * @returns {Promise<{ url: string, port: number, styleUrl: (name: string, rel?: string) => string, close: () => Promise<void> }>}
 */
export function startServer({ roots = {}, port = 0, log = null } = {}) {
  const dirOf = name => roots[name] ?? (NAME.test(name) && exists(path.join(STYLES, name, 'project.json')) ? path.join(STYLES, name) : null);
  const server = http.createServer(async (req, res) => {
    try {
      const host = String(req.headers.host || '').replace(/:\d+$/, '');
      if (host !== '127.0.0.1' && host !== 'localhost') { res.writeHead(403); return res.end(); }
      const origin = req.headers.origin;
      if (origin && origin !== 'null' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) { res.writeHead(403); return res.end(); }
      const url = new URL(req.url || '/', 'http://x');
      let parts; try { parts = decodeURIComponent(url.pathname).split('/').filter(Boolean); } catch { return notFound(res); }
      if (parts[0] === 'health') return sendJson(res, { ok: true, kit: true });
      if (parts[0] === '__kit') {
        if (parts[1] === 'blank.html' && parts.length === 2) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end('<!doctype html><meta charset="utf-8"><title>kit</title>'); }
        if (parts[1] === 'player.html' && parts.length === 2) return sendFile(req, res, path.join(KIT, 'tools', 'player.html'));
        // the player's view of a style: views, aspects, the settings of each aspect, the narration audio
        if (parts[1] === 'style' && parts[2] && parts.length === 3 && req.method === 'GET') {
          const d = dirOf(parts[2]); if (!d) return notFound(res);
          const pj = readJson(path.join(d, 'project.json'), {}) || {}, sj = readJson(path.join(d, 'style.json'), {}) || {}, aspects = Array.isArray(sj.aspects) && sj.aspects.length ? sj.aspects : ['16:9'];
          const audio = [pj.previewAudio, 'audio/clean.wav', 'audio/final_mix.wav', 'audio/narration.wav', 'audio/narration.mp3'].find(f => f && !/\.\./.test(f) && exists(path.join(d, f))) || null;
          return sendJson(res, { name: parts[2], id: sj.id, base: sj.base, aspects, views: pj.views || {}, view: pj.view || null, scenes: pj.scenes || [], end: pj.end || 0, audio,
            settings: Object.fromEntries(aspects.map(a => [a, settingsFor(d, a)])) });
        }
        // the player switches the view it shows: project.json scenes / end (what the preview page loads), like the Studio does
        if (parts[1] === 'view' && parts[2] && parts[3] && parts.length === 4 && req.method === 'POST') {
          const d = dirOf(parts[2]); if (!d) return notFound(res);
          const f = path.join(d, 'project.json'), pj = readJson(f, null), v = pj?.views?.[parts[3]];
          if (!v || !Array.isArray(v.scenes)) return notFound(res);
          pj.scenes = [...v.scenes]; pj.end = +v.end; pj.view = parts[3]; fs.writeFileSync(f, JSON.stringify(pj, null, 1) + '\n');
          return sendJson(res, { ok: true });
        }
        return notFound(res);
      }
      if (parts[0] !== 'p' || !parts[1]) return notFound(res);
      const dir = dirOf(parts[1]); if (!dir) { res.writeHead(404); return res.end('unknown style'); }
      const rest = parts.slice(2), shared = sharedDirs();
      if (rest[0] === '__lib') {                                   // low-poly library (server.ts: index, then allow-listed files)
        const rel = rest.slice(1).join('/');
        if (!shared.lowpoly) return notFound(res);
        if (rel === 'index.json') return sendJson(res, lowpolyIndex(shared.lowpoly));
        if (!/^(characters|animations|animals|props|sets|textures|vehicles|previews|faces)\/[\w./ -]+\.(glb|webp|png|jpg)$|^tools\/anim-runtime\.js$|^CREDITS\.json$/.test(rel)) return notFound(res);
        const f = inside(shared.lowpoly, rel); if (f && exists(f)) return sendFile(req, res, f);
        return notFound(res);
      }
      if (rest[0] === '__anims') {                                  // the animation catalog: the app's built-in clips, no user clips in the kit
        if (rest.slice(1).join('/') === 'catalog.json') return sendJson(res, { version: 1, builtin: shared.anims ? readJson(shared.anims, {})?.entries ?? [] : [], user: [] });
        return notFound(res);
      }
      if (rest[0] === '__chars3d') {                                // your own 3D characters: none in the kit
        if (rest.slice(1).join('/') === 'index.json') return sendJson(res, { version: 1, characters: [] });
        return notFound(res);
      }
      if (rest[0] === '__library') {                                // a built-in Library entry delivered by reference: its version folder
        const id = rest[1] || '', v = rest[2] || '', rel = rest.slice(3).join('/');
        if (!shared.library || !LIB_ID_RX.test(id) || !/^v\d{1,4}$/.test(v) || !rel || rest.slice(3).some(x => x === '..' || x === '.')) return notFound(res);
        const d = path.join(shared.library, id.split('.')[0], id), e = readJson(path.join(d, 'entry.json'), null);
        if (!e || e.id !== id || e.delivery !== 'ref') return notFound(res);
        const f = inside(path.join(d, v), rel); if (!f || !exists(f)) return notFound(res);
        return sendFile(req, res, f);
      }
      if (rest[0] === '__suite') {
        if (req.method === 'POST') {
          const body = await readBody(req);
          if (rest[1] === 'frame' && rest[2] && rest[3]) {
            const d = path.join(dir, '.suite', 'frames', rest[2].replace(/[^\w-]/g, '')); fs.mkdirSync(d, { recursive: true });
            fs.writeFileSync(path.join(d, String(+rest[3]).padStart(6, '0') + '.png'), body);
          } else if (rest[1] === 'append' && rest[2]) {
            const f = path.join(dir, 'out', rest[2].replace(/[^\w-]/g, '') + '.h264'); fs.mkdirSync(path.dirname(f), { recursive: true });
            if (url.searchParams.get('reset')) fs.writeFileSync(f, body); else fs.appendFileSync(f, body);
          } else return notFound(res);
          res.writeHead(204); return res.end();
        }
        const rel = rest.slice(1).join('/'), hd = hostDir();
        let f = inside(hd, rel);
        if (!f) { res.writeHead(403); return res.end(); }
        if (!exists(f) && hd !== path.join(KIT, 'host')) { const k = inside(path.join(KIT, 'host'), rel); if (k && exists(k)) f = k; }   // (an app without a newer file)
        return sendFile(req, res, f);
      }
      const rel = rest.join('/') || 'index.html';
      const f = inside(dir, rel);
      if (!f) { res.writeHead(403); return res.end(); }
      // 3D reconstruction's figure bodies: a package never carries the male one (the Mixamo Y Bot) and the app gives every
      // recon project the app's figures, so a figure file the style lacks comes from the installed app (read-only)
      if (!exists(f) && shared.figures && /^assets\/figures\/[\w.-]+(\/[\w.-]+)?$/.test(rel)) { const g = inside(shared.figures, rel.slice('assets/figures/'.length)); if (g && exists(g)) return sendFile(req, res, g); }
      return sendFile(req, res, f);
    } catch (e) { log?.(`server error: ${e?.message || e}`); if (!res.headersSent) res.writeHead(500); res.end(String(e?.message || e)); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port, url = `http://127.0.0.1:${p}`;
      resolve({ url, port: p, styleUrl: (name, rel = '') => `${url}/p/${encodeURIComponent(name)}/${rel}`, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) });
    });
  });
}

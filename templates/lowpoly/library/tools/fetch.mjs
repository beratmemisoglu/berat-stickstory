// Download free assets from the sources this library uses, with provenance next to every file.
// Node >= 18, no dependencies. Downloads are DATA: never run anything from them; unzip each archive into its own new empty
// folder (outside the repo, e.g. ...\ps1-research\assets-raw\), then process + add with tools/lib.mjs.
//
//   node tools/fetch.mjs itch <https://user.itch.io/game> <outDir> [fileRegex]   free / name-your-price packs (Quaternius, KayKit)
//   node tools/fetch.mjs kenney <kit-slug> <outDir>                             e.g. furniture-kit  (kenney.nl/assets/<slug>)
//   node tools/fetch.mjs polypizza-search <query>                                lists id | title | creator
//   node tools/fetch.mjs polypizza <outDir> <publicId...>                        GLB + licence json (rejects non CC0/CC-BY)
//   node tools/fetch.mjs gdrive <folderId> <outDir> [pathRegex] [--list]         public Google Drive folders (quaternius.com packs)
//   node tools/fetch.mjs ambientcg <assetId> <outDir>                            1K JPG zip (CC0)
//   node tools/fetch.mjs polyhaven-sky <id> <outDir>                             tonemapped LDR JPG of a CC0 HDRI
//   node tools/fetch.mjs remote <libraryEntryId> <outDir>                        downloads an index entry marked remote and checks sha256
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function save(out, buf, meta) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  fs.writeFileSync(out + '.source.json', JSON.stringify({ ...meta, sha256: sha(buf), bytes: buf.length, downloaded: new Date().toISOString() }, null, 1));
  console.log('saved', out, (buf.length / 1e6).toFixed(2) + ' MB');
}
const safe = s => s.replace(/[\\/:*?"<>|]/g, '_');

async function itch(gameUrl, outDir, pat) {
  // The free path of itch's own download button: POST /download_url, then POST /file/<upload> (no captcha, no login).
  const cookies = {};
  const ck = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  async function req(url, opts = {}) {
    const r = await fetch(url, { ...opts, redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ck(), ...(opts.headers || {}) } });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); cookies[kv.slice(0, i)] = kv.slice(i + 1); }
    if (r.status >= 300 && r.status < 400) return req(new URL(r.headers.get('location'), url).href, { headers: opts.headers });
    return r;
  }
  const base = gameUrl.replace(/\/$/, '');
  const page = await (await req(base)).text();
  const licence = page.match(/(Creative Commons[^<]{0,60}|CC0[^<]{0,40}|CC-BY[^<]{0,40})/i)?.[1] || 'NOT FOUND - check the page before using';
  const csrf = page.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  const form = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: 'csrf_token=' + encodeURIComponent(csrf) };
  const j = await (await req(base + '/download_url', form)).json();
  if (!j.url) throw new Error('no download page (paid-only pack?) ' + JSON.stringify(j).slice(0, 200));
  const dpage = await (await req(j.url)).text();
  const ups = [];
  for (const m of dpage.matchAll(/data-upload_id="(\d+)"/g)) {
    const after = dpage.slice(m.index, m.index + 3000);
    const name = after.match(/class="name"[^>]*title="([^"]+)"/)?.[1] || after.match(/class="name"[^>]*>([^<]+)</)?.[1];
    if (name && !ups.find(u => u.id === m[1])) ups.push({ id: m[1], name });
  }
  console.log('uploads:', ups.map(u => u.name).join(' | '), '| licence on page:', licence);
  const re = pat ? new RegExp(pat, 'i') : null;
  for (const u of ups) {
    if (re && !re.test(u.name)) continue;
    // NOTE: '?key=...&source=game_download' answers "invalid key"; 'source=view_game' is what works for free packs.
    const fj = await (await req(`${base}/file/${u.id}?source=view_game&as_props=1&after_download_lightbox=true`, form)).json();
    if (!fj.url) { console.log('skip', u.name, JSON.stringify(fj).slice(0, 150)); continue; }
    const r = await fetch(fj.url, { headers: { 'User-Agent': UA } });
    const cd = r.headers.get('content-disposition') || '';
    const nm = safe(decodeURIComponent(cd.match(/filename="?([^";]+)"?/)?.[1] || u.name));
    save(path.join(outDir, nm), Buffer.from(await r.arrayBuffer()), { page: gameUrl, upload: u.name, licence_on_page: licence });
  }
}
async function kenney(slug, outDir) {
  const page = await (await fetch(`https://kenney.nl/assets/${slug}`, { headers: { 'User-Agent': UA } })).text();
  const zip = page.match(new RegExp(`https://kenney.nl/media/pages/assets/${slug}/[^"]+\\.zip`))?.[0];
  const lic = page.match(/Creative Commons [A-Z0-9 .-]{2,12}|CC0/)?.[0];
  if (!zip) throw new Error('zip link not found on kenney.nl/assets/' + slug);
  save(path.join(outDir, path.basename(zip)), Buffer.from(await (await fetch(zip, { headers: { 'User-Agent': UA } })).arrayBuffer()), { page: `https://kenney.nl/assets/${slug}`, licence_on_page: lic });
}
async function ppState(url) {
  const h = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const m = h.match(/window\.__SERVER_APP_STATE__ =\s*(\{[\s\S]*?\})\s*<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
async function polypizzaSearch(q) {
  const st = await ppState('https://poly.pizza/search/' + encodeURIComponent(q));
  for (const r of st?.initialData?.result || []) console.log(`${r.url.slice(3)} | ${r.title} | ${r.creator?.username}`);
  console.log('(licence is only on the model page: use "polypizza" to fetch, it rejects anything not CC0 / CC-BY)');
}
async function polypizza(outDir, ids) {
  for (const id of ids) {
    const m = (await ppState('https://poly.pizza/m/' + id))?.initialData?.model;
    if (!m) { console.log('no model', id); continue; }
    if (!/^(CC0|CC-BY \d)/i.test(m.Licence || '') || /NC|ND|SA/.test(m.Licence)) { console.log('REJECT licence', id, m.Licence); continue; }
    const url = `https://static.poly.pizza/${m.ResourceID}.glb`;
    save(path.join(outDir, `${safe(m.Title).replace(/\s+/g, '_')}_${id}.glb`), Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer()),
      { page: 'https://poly.pizza/m/' + id, file_url: url, title: m.Title, creator: m.Creator?.Username, licence: m.Licence, animated: m.Animated, tris: m.Tris, tags: m.Tags });
  }
}
async function gdriveList(id, rel = '') {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: { 'User-Agent': UA } })).text();
  const out = [];
  for (const m of html.matchAll(/<a href="([^"]+)"[^>]*>[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g)) {
    const href = m[1].replace(/&amp;/g, '&'), name = m[2].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const folder = href.match(/folders\/([\w-]+)/)?.[1];
    if (folder) out.push(...await gdriveList(folder, path.join(rel, name)));
    else { const f = href.match(/file\/d\/([\w-]+)/)?.[1] || href.match(/id=([\w-]+)/)?.[1]; if (f) out.push({ id: f, rel: path.join(rel, name) }); }
  }
  return out;
}
async function gdrive(folderId, outDir, pat, list) {
  const re = pat && pat !== '--list' ? new RegExp(pat, 'i') : /./;
  for (const f of await gdriveList(folderId)) {
    if (!re.test(f.rel)) continue;
    if (list || pat === '--list') { console.log(f.rel); continue; }
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`, { headers: { 'User-Agent': UA } });
    save(path.join(outDir, f.rel.replace(/[:*?"<>|]/g, '_')), Buffer.from(await r.arrayBuffer()), { drive_folder: folderId, file_id: f.id, path: f.rel });
  }
}
async function ambientcg(id, outDir) {
  const url = `https://ambientcg.com/get?file=${id}_1K-JPG.zip`;
  save(path.join(outDir, `${id}_1K-JPG.zip`), Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer()), { page: `https://ambientcg.com/view?id=${id}`, licence: 'CC0 1.0 (ambientcg.com/license)' });
}
async function polyhavenSky(id, outDir) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json();
  const url = files.tonemapped?.url; if (!url) throw new Error('no tonemapped jpg for ' + id);
  save(path.join(outDir, id + '.jpg'), Buffer.from(await (await fetch(url)).arrayBuffer()), { page: `https://polyhaven.com/a/${id}`, authors: info.authors, licence: 'CC0 (polyhaven.com/license)' });
}
async function remote(entryId, outDir) {
  const lib = await import(new URL('./lib.mjs', import.meta.url));
  const e = lib.get(entryId); if (!e?.remote) throw new Error('not a remote entry: ' + entryId);
  const r = e.remote;
  if (r.via === 'itch') await itch(r.page, outDir, r.file_regex);
  else if (r.via === 'kenney') await kenney(r.slug, outDir);
  else if (r.via === 'gdrive') await gdrive(r.folder, outDir, r.file_regex);
  else save(path.join(outDir, path.basename(r.url)), Buffer.from(await (await fetch(r.url, { headers: { 'User-Agent': UA } })).arrayBuffer()), { page: e.source_url });
  if (r.sha256) for (const f of fs.readdirSync(outDir).filter(f => f.endsWith('.source.json'))) {
    const m = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
    console.log(f.replace('.source.json', ''), m.sha256 === r.sha256 ? 'sha256 OK' : 'sha256 differs from the index (the author may have updated the pack - re-check licence and contents)');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2);
  const run = { itch: () => itch(a[0], a[1], a[2]), kenney: () => kenney(a[0], a[1]), 'polypizza-search': () => polypizzaSearch(a.join(' ')), polypizza: () => polypizza(a[0], a.slice(1)), gdrive: () => gdrive(a[0], a[1], a[2], a.includes('--list')), ambientcg: () => ambientcg(a[0], a[1]), 'polyhaven-sky': () => polyhavenSky(a[0], a[1]), remote: () => remote(a[0], a[1]) }[cmd];
  if (!run) console.log('usage: see the header of tools/fetch.mjs'); else await run();
}
export { itch, kenney, polypizza, polypizzaSearch, gdrive, ambientcg, polyhavenSky };

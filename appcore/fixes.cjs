// Fixes the app does not carry yet, applied to a project's own files (never to templates/ or main/index.js).
//   fixEncoder(dir): the stickstory and toon engines configure one H.264 encoder and use it. On this computer the GPU
//   encoder accepts the settings and then fails on the first frame ("OperationError: Encoding error"); the app's export
//   of yeniviral2 failed the same way on 2026-10-31 until that project's engine.js was fixed by hand. This puts that
//   fix into any project engine.js that still has the old block: every supported encoder encodes one test frame first,
//   and the first one that really works does the export.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const OLD_HEAD = "  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });\n" +
  "  let cfg = { codec: 'avc1.CODEC', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };\n" +
  "  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } }\n" +
  "  enc.configure(cfg);\n";
const NEW_HEAD = `  // (a DOMException crosses to the app as "[object Object]": give every encoder failure a plain Error with its message)
  const plain = (e, what) => new Error(\`video encoder \${what}: \${e?.name || ''} \${e?.message || e}\`.trim());
  // Every encoder the browser says it supports, the GPU ones first, then the software encoder (Baseline / Main only).
  // A GPU encoder can accept the settings and still fail on the first frame ("OperationError: Encoding error" on a
  // two-GPU laptop): each candidate encodes one test frame first, and the first one that really works does the export.
  const base = { width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  const CODECS = ['avc1.640033', 'avc1.64002A', 'avc1.4D4033', 'avc1.4D402A', 'avc1.42E033', 'avc1.42E02A', 'avc1.420033', 'avc1.42002A'];
  const cands = [];
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) for (const codec of CODECS) {
    const c = { ...base, codec, hardwareAcceleration: hw };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) cands.push(c); } catch { /* not this one */ }
  }
  if (!cands.length) throw new Error(\`no H.264 encoder for \${FW}x\${FH} on this computer (hardware and software both refused)\`);
  compose(from);
  let cfg = null, lastErr = null;
  for (const c of cands) {
    let bad = null, got = 0; const test = new VideoEncoder({ output: () => { got++; }, error: e => { bad = e; } });
    try {
      test.configure(c);
      const vf = new VideoFrame(outCanvas, { timestamp: 0, duration: Math.round(1e6 / fps) }); test.encode(vf, { keyFrame: true }); vf.close();
      await test.flush();
    } catch (e) { bad ??= e; }
    try { if (test.state !== 'closed') test.close(); } catch { /* closed by its error */ }
    if (!bad && got > 0) { cfg = c; break; }
    lastErr = bad;
  }
  if (!cfg) throw plain(lastErr, 'error (every encoder failed its test frame)');
  console.log(\`export encoder: \${cfg.codec} \${cfg.hardwareAcceleration}\`);
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = plain(e, 'error') });
  try { enc.configure(cfg); } catch (e) { throw plain(e, 'configure'); }
`;
const OLD_FRAME = "    const vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });\n" +
  "    enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();\n";
const NEW_FRAME = "    let vf;\n" +
  "    try { vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) }); enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); }\n" +
  "    catch (e) { throw plain(e, `frame ${f}`); } finally { vf?.close(); }\n";
const OLD_END = "  await enc.flush(); await flush(true); enc.close();\n";
const NEW_END = "  try { await enc.flush(); } catch (e) { throw err || plain(e, 'flush'); }\n  if (err) throw err;\n  await flush(true); enc.close();\n";

function fixEncoder(dir) {
  const f = path.join(dir, 'engine.js');
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { return false; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n', n = (s) => s.replace(/\n/g, eol);
  // the engines differ only in their first codec (stickstory/toon 640033, starter 640032)
  const codec = /let cfg = \{ codec: 'avc1\.([0-9A-Fa-f]{6})', width: FW/.exec(src)?.[1], head = n(OLD_HEAD.replace('CODEC', codec));
  if (!codec || !src.includes(head) || !src.includes(n(OLD_FRAME)) || !src.includes(n(OLD_END))) return false;
  src = src.replace(head, () => n(NEW_HEAD)).replace(n(OLD_FRAME), () => n(NEW_FRAME)).replace(n(OLD_END), () => n(NEW_END));
  fs.writeFileSync(f, src);
  return true;
}

module.exports = { fixEncoder };

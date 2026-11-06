"""Step 6 - render the edited master audio (32-bit float) with 20 ms equal-power crossfades at every join,
write timeline.json (the single map that drives audio AND both videos), then click-scan every join.
usage: python render_audio.py
"""
import os, sys, json, numpy as np, scipy.io.wavfile as w
sys.path.insert(0, os.path.dirname(__file__)); from common import fmt, gate, AUDIO
sr, x = w.read('scr48f.wav'); x = x.astype(np.float32)
if x.ndim == 1: x = x[:, None]
S = json.load(open('spans.json'))
XF = 0.020; nx = int(XF * sr)
fi = np.sin(np.linspace(0, np.pi/2, nx))[:, None]; fo = np.cos(np.linspace(0, np.pi/2, nx))[:, None]
segs, tl, o = [], [], 0
for a, b, _ in S:
    sa, sb = int(round(a * sr)), int(round(b * sr))
    segs.append(x[sa:sb].copy()); tl.append([sa / sr, sb / sr, o / sr]); o += (sb - sa) - nx
out = np.zeros((o + nx, x.shape[1]), np.float32)
for i, (s, (_, _, os_)) in enumerate(zip(segs, tl)):
    pos = int(round(os_ * sr))
    if i > 0: s[:nx] *= fi
    if i < len(segs) - 1: s[-nx:] *= fo
    out[pos:pos + len(s)] += s
json.dump(tl, open('timeline.json', 'w'))
w.write(AUDIO, sr, out)
# click scan: biggest sample step around each join vs the 99.9th percentile step of the whole edit
m = out.mean(1); d = np.abs(np.diff(m)); base = np.percentile(d, 99.9); bad = []
for _, _, os_ in tl[1:]:
    pos = int(os_ * sr); win = d[max(0, pos - 200):pos + 1200]
    if win.size and win.max() > base * 1.5:
        # is the step inside the crossfade (edit artifact) or in untouched source audio next to it (natural transient)?
        inxf = d[pos:pos + nx].max() > base * 1.5
        bad.append((fmt(os_), 'IN CROSSFADE - investigate' if inxf else 'outside crossfade (natural transient; confirm in source)', bool(inxf)))
gate('audio', duration=len(out)/sr, joins=len(tl)-1, in_crossfade=[b[0] for b in bad if b[2]], outside=[b[0] for b in bad if not b[2]])
print(f'audio {fmt(len(out)/sr)} ({len(out)/sr:.3f} s) | peak {20*np.log10(np.abs(out).max()+1e-9):.1f} dBFS | joins {len(tl)-1} | flagged: {bad if bad else "none"}')

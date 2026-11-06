"""Step 2 - locate every camera clip inside the screen recording and fit offset + drift per clip.

Model per clip:  screen_time = cam_time * (1 + m) + c        (writes sync.json)

How it stays robust (all learned the hard way):
 * Clips are LOCATED with 30 s envelope windows voting on an offset (whole-clip matching fails on clips
   with long quiet stretches). A clip with no votes matches nothing: usually a warm-up take shot before
   the screen recording started -> excluded and reported.
 * Fine points use 3 s sample-level windows. Only VOICE points are kept: while desktop audio plays, OBS
   records it digitally but the camera hears the speakers ~150-200 ms later, which forms a cluster of
   points at a constant wrong offset. Points more than 60 ms off the coarse offset are rejected.
 * Drift is a property of the camera crystal. It is fitted on clips with enough time span (>= 600 s of
   points); shorter clips use the median of those fits (or --drift ppm if no long clip exists).
usage: python sync.py [--drift -44]      (ppm fallback only used when no clip is long enough)
"""
import argparse, os, sys, json
import numpy as np, scipy.io.wavfile as w
from scipy.signal import fftconvolve
sys.path.insert(0, os.path.dirname(__file__)); from common import load, save, fmt
ap = argparse.ArgumentParser(); ap.add_argument('--drift', type=float, default=None, help='fallback drift in ppm'); a = ap.parse_args()
p = load()
_, b = w.read('scr8k.wav'); b = b.astype(np.float32)
def env(x, hop=80):
    n = len(x) // hop; e = np.abs(x[:n*hop]).reshape(n, hop).mean(1); return e - e.mean()
eb = env(b)
res = {}
for k in p['cams']:
    fn = f'cam_{k}_8k.wav'
    if not os.path.exists(fn): print(f'{k}: no audio track - cannot sync'); continue
    _, x = w.read(fn); x = x.astype(np.float32); dur = len(x) / 8000; ea = env(x)
    Wn = int(min(30, max(8, dur - 2))); votes = []
    for t in range(0, max(1, int(dur) - Wn), 10):
        y = ea[t*100:(t+Wn)*100]; y = y - y.mean()
        if (y**2).sum() == 0: continue
        c = fftconvolve(eb, y[::-1], 'valid'); j = int(np.argmax(c)); seg = eb[j:j+len(y)] - eb[j:j+len(y)].mean()
        q = c[j] / np.sqrt((y**2).sum() * (seg**2).sum() + 1e-9)
        if q > 0.5: votes.append(j / 100 - t)
    if not votes:
        rms = 20*np.log10(np.sqrt((x**2).mean())/32768 + 1e-12)
        print(f'{k}: NO MATCH anywhere in the screen recording (dur {fmt(dur)}, level {rms:.0f} dBFS) -> warm-up / pre-roll take? EXCLUDED')
        res[k] = {'nomatch': True, 'dur': dur}; continue
    v = np.array(votes); mode = np.bincount(np.round(v - v.min()).astype(int)).argmax() + round(v.min())
    agree = v[np.abs(v - mode) < 1.5]; lag = float(np.median(agree))
    pts = []
    for t in np.arange(2, dur - 5, 2):
        s = int(t*8000); L = 8000*3; cam = x[s:s+L]; o = s + int(lag*8000); scr = b[o-2400:o+L+2400]
        if o - 2400 < 0 or len(scr) < L + 4800 or (cam**2).sum() == 0: continue
        cc = fftconvolve(scr, cam[::-1], 'valid'); j = int(np.argmax(cc))
        q = cc[j] / np.sqrt((cam**2).sum() * (scr[j:j+L]**2).sum() + 1e-9)
        if q > 0.35: pts.append((t, lag + (j - 2400) / 8000))
    P = np.array(pts) if pts else np.zeros((0, 2))
    rough = np.polyfit(P[:, 0], P[:, 1], 1) if len(P) > 5 else [0, lag]
    dev = (P[:, 1] - np.polyval(rough, P[:, 0])) if len(P) else np.array([])
    voice = P[np.abs(dev) < 0.06] if len(P) else P
    rej = len(P) - len(voice)
    res[k] = {'dur': dur, 'lag': lag, 'votes': f'{len(agree)}/{len(v)}', 'P': voice.tolist(), 'rejected': rej}
# drift: fit on long clips only
fits = []
for k, r in res.items():
    if r.get('nomatch'): continue
    V = np.array(r['P'])
    if len(V) >= 30 and np.ptp(V[:, 0]) >= 600:
        m, c0 = np.polyfit(V[:, 0], V[:, 1], 1); rr = V[:, 1] - (m*V[:, 0] + c0); V2 = V[np.abs(rr) < 0.025]
        m, c0 = np.polyfit(V2[:, 0], V2[:, 1], 1); r['m_fit'] = m; fits.append(m)
m_default = float(np.median(fits)) if fits else ((a.drift or 0.0) * 1e-6)
print(f'drift: fitted on {len(fits)} long clip(s) {[round(f*1e6,1) for f in fits]} ppm -> short clips use {m_default*1e6:+.1f} ppm'
      + ('' if fits or a.drift is not None else '  (NO long clip and no --drift given: using 0 - pass --drift from a previous session of the same camera)'))
out = {}
for k, r in res.items():
    if r.get('nomatch'): continue
    V = np.array(r['P']); m = r.get('m_fit', m_default)
    if len(V) == 0:
        print(f'{k}: located at {r["lag"]:.2f}s but NO fine voice points - using coarse offset only (check lipsync!)'); c = r['lag']; spread = (np.nan, np.nan)
    else:
        cs = V[:, 1] - m * V[:, 0]; c = float(np.median(cs)); spread = (1000*(np.percentile(cs, 5) - c), 1000*(np.percentile(cs, 95) - c))
    st, en = c, c + r['dur'] * (1 + m)
    out[k] = {'m': m, 'c': c, 'dur': r['dur'], 'scr_start': st, 'scr_end': en}
    print(f'{k}: votes {r["votes"]} | {len(V)} voice pts ({r["rejected"]} rejected: playback/speaker-latency or noise) | screen {fmt(st)} -> {fmt(en)} | '
          f'drift {m*1e6:+.1f} ppm{" (fitted)" if "m_fit" in r else ""} | spread p5..p95 {spread[0]:+.1f}..{spread[1]:+.1f} ms')
p['sync'] = out; p['excluded_cams'] = [k for k, r in res.items() if r.get('nomatch')]; save(p)
json.dump(out, open('sync.json', 'w'), indent=1)
cl = sorted(out.items(), key=lambda kv: kv[1]['scr_start'])
if cl:
    print('coverage order:', ' -> '.join(k for k, _ in cl))
    if cl[0][1]['scr_start'] > 0.5: print(f'  no camera before {fmt(cl[0][1]["scr_start"])}')
    for (k1, x1), (k2, x2) in zip(cl, cl[1:]):
        g = x2['scr_start'] - x1['scr_end']
        print(f'  {"OVERLAP (check - one camera cannot record twice; fine if it only touches silence)" if g < 0 else "no camera"} '
              f'{fmt(x1["scr_end"])} -> {fmt(x2["scr_start"])} ({g:+.1f}s)')
    if cl[-1][1]['scr_end'] < p['screen']['duration'] - 0.5: print(f'  no camera after {fmt(cl[-1][1]["scr_end"])}')

"""Step 10 - QUALITY GATE: lipsync of the finished facecam, per camera clip.
Pushes each clip's OWN mic audio through the timeline and compares it to the edited master audio with an
amplitude-ENVELOPE correlation (band-passed 300-3400 Hz, 2 ms envelope, +-50 ms search).
Sample-level correlation is NOT used here: voiced speech gives a second peak one pitch period away, which
produced fake 15-20 ms readings in the past. Target: every strong span within half a camera frame
(16.7 ms @ 29.97). A constant ~5 ms per-clip median is normal (mic distance + room reverb).
Weak matches are expected only on playback blocks (camera hears speakers late) and silent holds.
"""
import os, sys, json, subprocess, numpy as np, scipy.io.wavfile as w
from scipy.signal import fftconvolve, butter, sosfiltfilt
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fmt, gate, AUDIO, CAM_OUT
p = load(); sy = p['sync']; tl = json.load(open('timeline.json')); S = json.load(open('spans.json'))
# always regenerate the reference from the CURRENT render (a stale reference once produced fake +-100 ms errors)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', AUDIO, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'chk16.wav'])
sr = 16000; _, ed = w.read('chk16.wav'); ed = ed.astype(np.float32)
cams = {k: w.read(f'cam_{k}_16.wav')[1].astype(np.float32) for k in sy}
bp = butter(4, [300, 3400], 'bandpass', fs=sr, output='sos'); env = lambda z: np.convolve(np.abs(z), np.ones(32)/32, 'same')
res = {k: [] for k in sy}; Sx = 800
bp2 = butter(4, [200, 4000], 'bandpass', fs=sr, output='sos')
def phat(x, y):   # GCC-PHAT lag of y vs x in ms (Hann-tapered: untapered filter edges give a fake 0-lag peak)
    wd = np.hanning(len(x)); x = sosfiltfilt(bp2, x) * wd; y = sosfiltfilt(bp2, y) * wd; n = 1 << int(np.ceil(np.log2(2 * len(x))))
    R = np.fft.rfft(y, n) * np.conj(np.fft.rfft(x, n)); cc = np.fft.irfft(R / (np.abs(R) + 1e-12), n)
    cc = np.concatenate([cc[-Sx:], cc[:Sx + 1]]); return (int(np.argmax(cc)) - Sx) / 16
for (a, b, o), s in zip(tl, S):
    if b - a < 2.5: continue
    k = next((k for k, v in sy.items() if v['scr_start'] <= a and b <= v['scr_end']), None)
    if k is None: continue
    m, c = sy[k]['m'], sy[k]['c']; L = int((b - a - 0.2) * sr); ct = (a - c) / (1 + m)
    x = cams[k][int(ct*sr):int(ct*sr)+L]; y = ed[int(o*sr)-Sx:int(o*sr)+L+Sx]
    if len(x) < L or len(y) < L + 2*Sx or (x**2).sum() == 0: continue
    ex = env(sosfiltfilt(bp, x)); ey = env(sosfiltfilt(bp, y)); ex -= ex.mean(); ey -= ey.mean()
    cc = fftconvolve(ey, ex[::-1], 'valid'); j = int(np.argmax(cc)); q = cc[j] / np.sqrt((ex**2).sum() * (ey[j:j+L]**2).sum() + 1e-9)
    yc = y[Sx:Sx+L]; h = L // 2
    res[k].append(((j - Sx) / 16, q, o, s[2].startswith('[BLOCK]'), phat(x, yc), phat(x[:h], yc[:h]), phat(x[h:], yc[h:])))
allg = []; rec = {}
for k, r in res.items():
    if not r: print(f'{k}: no measurable spans'); rec[k] = {'spans': 0}; continue
    g = [x for x in r if x[1] > 0.5]
    o_ = np.array([x[0] for x in g]) if g else np.array([0.0])
    # Envelope outliers are re-measured independently (references/lessons.md #25): GCC-PHAT on the same excerpts, direct path, immune to
    # reverb/phoneme bias. A span passes only if both PHAT halves agree within 1 ms and it sits within half a camera frame
    # of the clip's PHAT median; otherwise the envelope reading stands and the gate fails.
    pm = float(np.median([x[4] for x in g])) if g else 0.0
    conf = [x for x in g if abs(x[0] - np.median(o_)) > 16.7 and abs(x[5] - x[6]) <= 1.0 and abs(x[4] - pm) <= 16.7]
    for x in conf: print(f'  {k} {fmt(x[2])}: envelope {x[0]:+.1f} ms is an outlier; GCC-PHAT {x[4]:+.1f} ms (halves {x[5]:+.1f}/{x[6]:+.1f}, clip PHAT median {pm:+.1f}) -> in sync')
    kept = [x for x in g if x not in conf]; allg += [x[0] for x in kept]
    ok_ = np.array([x[0] for x in kept]) if kept else np.array([0.0])
    ph_ = np.array([x[4] for x in g]) if g else np.array([0.0])
    rec[k] = {'spans': len(r), 'strong': len(g), 'median_ms': float(np.median(o_)),
              'max_dev_ms': float(np.abs(ok_ - np.median(o_)).max()) if g else None,
              'env_max_dev_ms': float(np.abs(o_ - np.median(o_)).max()) if g else None,
              'phat_median_ms': pm, 'phat_max_dev_ms': float(np.abs(ph_ - pm).max()) if g else None,
              'phat_confirmed': [fmt(x[2]) for x in conf],
              'weak_speech': [fmt(t) for off, q, t, blk, *_ in r if q <= 0.5 and not blk]}
    wk = [(fmt(t), round(float(off), 1), round(float(q), 2), 'block' if blk else 'SPEECH - investigate') for off, q, t, blk, *_ in r if q <= 0.5]
    if g:
        o_ = np.array([x[0] for x in g])
        print(f'{k}: {len(r)} spans, {len(g)} strong | offset ms min {o_.min():+.1f} max {o_.max():+.1f} median {np.median(o_):+.2f} | weak: {wk}')
    else: print(f'{k}: {len(r)} spans, NONE strong - investigate | weak: {wk}')
if allg:
    a_ = np.array(allg); md = np.median(a_)
    print(f'ALL strong spans: median {md:+.2f} ms | spread around median p5..p95 {np.percentile(a_,5)-md:+.1f}..{np.percentile(a_,95)-md:+.1f} ms | '
          f'max |off| {np.abs(a_).max():.1f} ms (half a 29.97 frame = 16.7 ms)')
gate('sync', clips=rec, max_abs_ms=float(np.abs(np.array(allg)).max()) if allg else None, cam_mtime=os.path.getmtime(CAM_OUT) if os.path.exists(CAM_OUT) else None,
     audio_mtime=os.path.getmtime(AUDIO))

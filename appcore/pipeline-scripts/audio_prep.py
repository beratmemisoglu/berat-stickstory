#!/usr/bin/env python3
"""Step 1 of the audio pipeline: decode the voiceover and tighten its pauses without clipping words.

  python audio_prep.py <project> [--keep-pauses] [--min-gap 0.12] [--max-pause 0.20]

Writes audio/raw.wav (48 kHz mono), audio/clean.wav, audio/cuts.json, audio/prep_report.json and
out/audio_overview.png (envelope with gaps marked; LOOK at it).

How pauses are tightened (the part that must not damage the voice):
  * a pause = RMS below -50 dB for >= min-gap seconds;
  * the true word tail / next onset is found at a much lower threshold (-62 dB) so soft decays and
    breathy onsets are kept, plus a 25 ms guard on each side;
  * only the middle of the silence is removed; each pause keeps 110-200 ms (longer pauses stay longer,
    so sentence rhythm survives);
  * every join gets a 20 ms equal-power crossfade (no clicks);
  * peak-normalised to -1 dBFS.
Checks printed in the report: click test at every join (max sample jump near joins vs the file's
99.9th percentile) and any cut region that contained energy above -55 dB (inspect those).
"""
import argparse, glob, json, os, subprocess, wave
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--keep-pauses', action='store_true')
ap.add_argument('--min-gap', type=float, default=.12); ap.add_argument('--max-pause', type=float, default=.20)
# Trim silences (the editor's panel): a pause = 10 ms RMS frames below --thr dBFS for >= --min-ms; --amount % of it
# (minus 20 ms of speech tail kept on each side) is removed from its middle. Same rule as src/shared/trim.ts.
ap.add_argument('--thr', type=float, default=-40); ap.add_argument('--min-ms', type=float, default=350)
ap.add_argument('--amount', type=float, default=None)
a = ap.parse_args()
A = os.path.join(os.path.abspath(a.project), 'audio'); OUT = os.path.join(os.path.abspath(a.project), 'out')
src = next(iter(sorted(f for f in glob.glob(os.path.join(A, 'source.*')) if not f.endswith(('.json', '.incoming')))), None)
if not src: raise SystemExit('no audio/source.* - run init_project.py --audio first')
raw = os.path.join(A, 'raw.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', raw], check=True)

def load(p):
    w = wave.open(p); return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768, w.getframerate()
def save(p, y, sr):
    w = wave.open(p, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
x, sr = load(raw)
# the deliberate pauses of a voiceover the app made (beats like "(beat 3s)", paced sentences): .suite/tts/pauses.json,
# written for this very audio/source.wav (its size). A pause that overlaps one is never shortened, by either rule below.
keep = []
try:
    with open(os.path.join(os.path.abspath(a.project), '.suite', 'tts', 'pauses.json'), encoding='utf-8') as f: kp = json.load(f)
    if os.path.basename(src) == 'source.wav' and kp.get('size') == os.path.getsize(src): keep = [(float(s), float(e)) for s, e in kp.get('keep', [])]
except Exception: pass
kept = lambda t0, t1: any(s < t1 and e > t0 for s, e in keep)
if keep: print(f'Keeping {len(keep)} marked pauses (beats and paced sentences) as they are.')
HOP = .005; hop = int(sr * HOP)
db = 20 * np.log10(np.sqrt((x[: len(x) // hop * hop].reshape(-1, hop) ** 2).mean(1) + 1e-12))
T = lambda i: i * HOP
GAP_DB, TAIL_DB, GUARD, XF = -50, -62, .025, .020
target = lambda gap: min(a.max_pause, .11 + .25 * (gap - a.min_gap))

cuts, i, n = [], 0, len(db)
quiet = db < GAP_DB
if a.amount is not None:
    fr = int(sr * .01); nf = len(x) // fr
    e10 = 20 * np.log10(np.sqrt((x[: nf * fr].reshape(-1, fr) ** 2).mean(1) + 1e-12))
    q10, k = e10 < a.thr, 0
    while k < nf:
        if q10[k]:
            m = k
            while m < nf and q10[m]: m += 1
            L = (m - k) * .01
            if k > 0 and m < nf and L * 1000 >= a.min_ms and not kept(k * .01, m * .01):
                rem = min(L * a.amount / 100, L - 2 * XF)
                if rem >= .03: mid = (k + m) * .005; cuts.append((mid - rem / 2, mid + rem / 2))
            k = m
        else: k += 1
while i < n and not a.keep_pauses and a.amount is None:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        if (j - i) * HOP >= a.min_gap and i > 0 and j < n and not kept(T(i), T(j)):
            s = i
            while s < j and db[s] > TAIL_DB: s += 1           # extend word tail forward
            e = j
            while e > s and db[e - 1] > TAIL_DB: e -= 1       # extend next onset backward
            s0, s1 = T(s) + GUARD, T(e) - GUARD
            remove = (s1 - s0) - (target(T(j) - T(i)) - 2 * GUARD)
            if remove > XF * 2:
                mid = (s0 + s1) / 2; cuts.append((mid - remove / 2, mid + remove / 2))
        i = j
    else: i += 1

fade = int(XF * sr); tt = np.linspace(0, np.pi / 2, fade); fo, fi = np.cos(tt), np.sin(tt)
out, pos, tail = [], 0, None
for c0, c1 in cuts:
    s0, s1 = int(c0 * sr), int(c1 * sr)
    seg = x[pos:s0 + fade // 2].copy()
    if tail is not None: seg[:fade] = tail * fo + seg[:fade] * fi
    out.append(seg[:-fade]); tail = seg[-fade:]; pos = s1 - fade // 2
seg = x[pos:].copy()
if tail is not None: seg[:fade] = tail * fo + seg[:fade] * fi
out.append(seg)
y = np.concatenate(out); y *= .89 / (np.abs(y).max() + 1e-9)
save(os.path.join(A, 'clean.wav'), y, sr)
json.dump(cuts, open(os.path.join(A, 'cuts.json'), 'w'))

# ---- checks ----
joins, removed = [], 0
for c0, c1 in cuts: joins.append(c0 - removed); removed += c1 - c0
d = np.abs(np.diff(y))
near = max((d[max(0, int((j - .03) * sr)):int((j + .03) * sr)].max() for j in joins), default=0)
env = np.convolve(np.abs(x), np.ones(240) / 240, 'same')
loud = [(round(c0, 2), round(20 * np.log10(env[int(c0 * sr):int(c1 * sr)].max() + 1e-9), 1)) for c0, c1 in cuts
        if env[int(c0 * sr):int(c1 * sr)].max() > 10 ** (-55 / 20)]
gaps_all = []; i = 0
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        if (j - i) * HOP >= .09 and i > 0 and j < n: gaps_all.append((j - i) * HOP)
        i = j
    else: i += 1
rep = {'source': os.path.basename(src), 'kept_pauses': len(keep), 'median_gap_s': round(float(np.median(gaps_all)), 3) if gaps_all else None, 'duration_in': round(len(x) / sr, 2), 'duration_out': round(len(y) / sr, 2),
       'pauses_tightened': len(cuts), 'removed_s': round(sum(c1 - c0 for c0, c1 in cuts), 2),
       'click_check': {'max_jump_near_joins': round(float(near), 4), 'file_p99_9': round(float(np.percentile(d, 99.9)), 4),
                       'ok': bool(near < np.percentile(d, 99.9))},
       'cuts_with_energy_above_-55dB': loud[:40],
       'note': 'cuts_with_energy entries are usually breaths/room tone mid-pause; spot-check a few with the overview if any word might be affected.'}
json.dump(rep, open(os.path.join(A, 'prep_report.json'), 'w'), indent=1)

# ---- overview image: 12 rows, gaps (red) ----
try:
    from PIL import Image, ImageDraw
    os.makedirs(OUT, exist_ok=True)
    rows, Wd, Hr = 12, 2400, 70; img = Image.new('RGB', (Wd, rows * Hr), 'white'); dr = ImageDraw.Draw(img); per = len(db) / rows
    for r in range(rows):
        sg = db[int(r * per): int((r + 1) * per)]
        for px in range(Wd):
            v = sg[min(len(sg) - 1, int(px / Wd * len(sg)))]; h = int(max(0, (v + 70) / 70) * (Hr - 10))
            dr.line([(px, r * Hr + Hr - 5), (px, r * Hr + Hr - 5 - h)], fill=(40, 60, 120))
        for c0, c1 in cuts:
            f0, f1 = c0 / HOP, c1 / HOP
            if int(r * per) <= f0 < int((r + 1) * per):
                dr.rectangle([(f0 - r * per) / per * Wd, r * Hr, (f1 - r * per) / per * Wd, r * Hr + 4], fill=(220, 60, 60))
        dr.text((4, r * Hr + 2), f'{r * per * HOP:.0f}s', fill='black')
    img.save(os.path.join(OUT, 'audio_overview.png'))
except Exception as e:
    print('overview skipped:', e)
print(json.dumps(rep, indent=1))

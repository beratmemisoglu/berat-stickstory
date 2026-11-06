# Camera smoothness measured IN THE PICTURE (the owner judges the video, not the keys): from measure.py's per-frame
# similarity transforms (tx, ty, rot, zoom) the frame-to-frame motion m(f); its jitter = |m(f) - (m(f-1)+m(f+1))/2|
# (the part of the motion a smooth camera would not have), relative to the motion itself. Per second of film and per
# shot of a SHOTS-like range list, ours vs the reference:
#   .venv/Scripts/python.exe tools/camsmooth.py <ours measure.json> <ref measure.json> [--ranges film/everest/assemble.json]
# Prints the jitter index per window (lower = smoother) and FAILs windows over 1.5x the reference's median.
import json, os, sys, re
import numpy as np

def load(p):
    F = json.load(open(p))['frames']
    m = np.array([[f.get('tx', 0) or 0, f.get('ty', 0) or 0, (f.get('rot', 0) or 0) * 20, ((f.get('zoom', 1) or 1) - 1) * 300] for f in F])
    ok = np.array([(f.get('inl', 0) or 0) >= 20 for f in F])     # frames whose transform was measured reliably
    return m, ok

def jitter(m, ok):
    j = np.zeros(len(m)); mag = np.zeros(len(m))
    for i in range(1, len(m) - 1):
        if ok[i - 1] and ok[i] and ok[i + 1]:
            j[i] = np.linalg.norm(m[i] - (m[i - 1] + m[i + 1]) / 2); mag[i] = np.linalg.norm(m[i])
    return j, mag

A, R = load(sys.argv[1]), load(sys.argv[2])
ja, ma = jitter(*A); jr, mr = jitter(*R)
win = 30
def idx(j, m, a, b):
    s = j[a:b]; t = m[a:b]
    return float(np.sum(s) / max(1e-6, np.sum(t) + 0.5 * (b - a)))
n = min(len(ja), len(jr))
ra = [idx(ja, ma, a, a + win) for a in range(0, n - win, win)]
rr = [idx(jr, mr, a, a + win) for a in range(0, n - win, win)]
lim = 1.5 * float(np.median(rr))
print(f'jitter index (lower = smoother): ours median {np.median(ra):.3f}, reference median {np.median(rr):.3f}, limit {lim:.3f}')
bad = 0
for k, (x, y) in enumerate(zip(ra, rr)):
    flag = 'FAIL' if x > lim else 'ok'
    bad += flag == 'FAIL'
    print(f'  {k * win / 30:5.1f}s  ours {x:.3f}  ref {y:.3f}  {flag}')
print(f'CAMSMOOTH {"PASS" if bad == 0 else "FAIL"} {bad} of {len(ra)} seconds over the limit')

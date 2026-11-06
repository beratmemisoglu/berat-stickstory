"""Find non-silent audio BELOW the speech threshold, >= 1.5 s: quiet playback, ambience previews, music beds.
Regions around -85..-100 dB are room tone leaking through the gate (ignore). Regions around -40..-75 dB
next to "let me play / listen to this" in the transcript are real playback -> keep them inside a block.
"""
import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fmt
th = load().get('vad_db') or -55
db = np.load('db.npy'); q = (db > -95) & (db <= th); i = 0; n = len(q)
while i < n:
    if q[i]:
        j = i
        while j < n and (q[j] or (j + 30 < n and q[j:j+30].any())): j += 1
        if j - i >= 150:
            m = float(np.median(db[i:j]))
            print(f'{fmt(i/100)} -> {fmt(j/100)} ({(j-i)/100:5.1f}s) median {m:.0f} dB {"  <- likely real playback" if m > -78 else ""}')
        i = j
    else: i += 1

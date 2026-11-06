"""Print word indices + times (and waveform micro-dips) for utterances you want to trim inside.
usage: python words.py 17 40 101
Word ranges in script.md ("U17 3-12 | text") refer to these indices. A stutter the aligner hid ("it it" -> "it")
needs nothing from you: build_cut.py cuts at the dip before the kept word and check_edit.py fails if it survives.
"""
import os, sys, json, numpy as np
U = json.load(open('utt.json')); db = np.load('db.npy')
for i in map(int, sys.argv[1:]):
    a, b, t, ws = U[i]
    print(f'== {i} [{a:.2f}-{b:.2f}] {t}')
    print('   ' + ' '.join(f'{k}:{x[2]}@{x[0]:.2f}-{x[1]:.2f}' for k, x in enumerate(ws)))
    s, e = int(a * 100), int(b * 100); dd = db[s:e]; low = dd < min(-48, np.median(dd) - 22); cuts = []; j = 0
    while j < len(low):
        if low[j]:
            k = j
            while k < len(low) and low[k]: k += 1
            if k - j >= 3: cuts.append(round((s + j + (k - j) / 2) / 100, 2))
            j = k
        else: j += 1
    print('   micro-dips (candidate cut points):', cuts)
    if ws and ws[0][0] - a > 0.8: print(f'   NOTE: {ws[0][0]-a:.2f}s of sound before the first aligned word -> likely an unaligned false start')

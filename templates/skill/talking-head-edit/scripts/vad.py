"""Step 3a - 10 ms loudness envelope of the master audio (db.npy) + speech threshold choice.
Noise-gated mics give true digital silence (-120 dB) between phrases -> threshold -55 dBFS is ideal.
If the audio is NOT gated, the threshold is set 15 dB above the noise floor. Override: python vad.py --thresh -50
"""
import argparse, os, sys, numpy as np, scipy.io.wavfile as w
sys.path.insert(0, os.path.dirname(__file__)); from common import load, save
ap = argparse.ArgumentParser(); ap.add_argument('--thresh', type=float); a = ap.parse_args()
sr, x = w.read('scr48f.wav'); x = x.astype(np.float32)
if x.ndim > 1: x = x.mean(1)
if np.abs(x).max() > 2: x = x / 32768
hop = sr // 100; n = len(x) // hop
db = 20 * np.log10(np.sqrt((x[:n*hop].reshape(n, hop)**2).mean(1)) + 1e-6)
np.save('db.npy', db.astype(np.float32))
pc = {q: round(float(np.percentile(db, q)), 1) for q in (5, 10, 20, 30, 50, 70, 90, 99)}
gated = pc[20] <= -100
th = a.thresh if a.thresh is not None else (-55.0 if gated else min(-40.0, pc[20] + 15))
print('percentiles', pc, '| noise-gated' if gated else '| NOT gated (room tone present)', f'-> speech threshold {th:.1f} dBFS')
print(f'speech (above threshold): {(db > th).mean()*100:.0f}% of the recording')
p = load(); p['vad_db'] = th; save(p)

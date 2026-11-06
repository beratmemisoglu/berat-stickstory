"""Transcribe arbitrary time ranges (one model load). Used to VERIFY every trim before committing it:
transcribe exactly what would remain, and what would be removed.

usage: python ptr.py jobs.json [--align]
jobs.json: [{"id": "t36", "src": "scr16.wav", "ranges": [[173.9, 175.67], [175.90, 179.9]]}, ...]
  src defaults to scr16.wav (screen time). Use "chk16.wav" for OUTPUT time of the rendered edit,
  or "cam_<key>_16.wav" for camera time.
"""
import os, sys, json, numpy as np, scipy.io.wavfile as w
sys.path.insert(0, os.path.dirname(__file__)); from common import load, run_asr, read_asr
jobs = json.load(open(sys.argv[1])); align = '--align' in sys.argv
p = load() if os.path.exists('project.json') else {}
d = 'ptr_tmp'; os.makedirs(d, exist_ok=True)
for f in os.listdir(d): os.remove(os.path.join(d, f))
cache = {}; files = []
for j in jobs:
    src = j.get('src', 'scr16.wav')
    if src not in cache: cache[src] = w.read(src)
    sr, x = cache[src]
    seg = np.concatenate([np.zeros(sr // 2, x.dtype)] + [x[int(a*sr):int(b*sr)] for a, b in j['ranges']] + [np.zeros(sr // 2, x.dtype)])
    f = os.path.join(d, f"{j['id']}.wav"); w.write(f, sr, seg); files.append(f)
run_asr(files, d, align=align, p=p)
for j in jobs:
    r = read_asr(os.path.join(d, f"{j['id']}.json"))
    print(f"{j['id']} {[[round(a, 2), round(b, 2)] for a, b in j['ranges']]} | {r['text'].strip() if r else '<no output>'}")

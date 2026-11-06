"""Step 3b - utterances from the WAVEFORM, text from per-utterance ASR (never trust a single full-file pass).

1. Full-file ASR pass (used only for the coverage report; in the same transcriber call as step 3).
2. Utterances = regions above the speech threshold, gaps < 0.30 s merged, blips < 80 ms dropped.
3. EVERY utterance is transcribed on its own, with forced alignment -> exact text + ~20 ms word times
   in screen time. (Full-file passes silently drop speech: 488 words on one 64-min recording, incl. an
   entire intro; Whisper full passes also hallucinated a 20x repeated sentence over silence.)
Outputs: utt.json  [[start, end, text, [[w_start, w_end, word], ...]], ...]   and utt.txt (human readable)
"""
import os, sys, json, numpy as np, scipy.io.wavfile as w
sys.path.insert(0, os.path.dirname(__file__)); from common import load, run_asr, read_asr, fmt
p = load(); th = p.get('vad_db') or -55
# 2. utterances
db = np.load('db.npy'); on = db > th; R = []; i = 0; n = len(on)
while i < n:
    if on[i]:
        j = i
        while j < n and on[j]: j += 1
        R.append([i, j]); i = j
    else: i += 1
M = []
for a, b in R:
    if M and a - M[-1][1] < 30: M[-1][1] = b
    else: M.append([a, b])
U = [[a / 100, b / 100] for a, b in M if b - a >= 8]
# 3. per-utterance ASR with alignment
sr, x = w.read('scr16.wav'); d = 'utt_tmp'; os.makedirs(d, exist_ok=True)
for f in os.listdir(d): os.remove(os.path.join(d, f))
PAD = 0.5; files = []; offs = []
for i, (a, b) in enumerate(U):
    s = max(0.0, a - 0.12); e = b + 0.2
    seg = np.concatenate([np.zeros(int(PAD*sr), x.dtype), x[int(s*sr):int(e*sr)], np.zeros(int(PAD*sr), x.dtype)])
    f = os.path.join(d, f'u{i:04d}.wav'); w.write(f, sr, seg); files.append(f); offs.append(s - PAD)
print(f'{len(U)} utterances -> per-utterance ASR with alignment (models load once; ~0.3 s per utterance on a GPU)...', flush=True)
# the full-file pass (coverage report only) rides along in the same call: one model load for both
full_first = not os.path.exists('scr16.json')
run_asr((['scr16.wav'] if full_first else []) + files, d, align=True, p=p)
if full_first:
    for ext in ('.json', '.srt', '.words.srt', '.txt'):
        if os.path.exists(os.path.join(d, 'scr16' + ext)): os.replace(os.path.join(d, 'scr16' + ext), 'scr16' + ext)
full = read_asr('scr16.json'); fw = full['words'] if full else []
out = []
for i, (a, b) in enumerate(U):
    j = read_asr(os.path.join(d, f'u{i:04d}.json'))
    if not j: out.append([a, b, '', []]); continue
    ws = [[wd['start'] + offs[i], wd['end'] + offs[i], wd['word']] for wd in j.get('words', [])]
    out.append([a, b, j['text'].strip(), ws])
json.dump(out, open('utt.json', 'w'))
with open('utt.txt', 'w', encoding='utf-8') as f:
    for i, (a, b, t, _) in enumerate(out):
        f.write(f"{i}|{fmt(a)}|{a:.2f}-{b:.2f}|gap{(a - out[i-1][1]) if i else 0:.1f}|{t}\n")
nw = sum(len(o[3]) for o in out); empty = [(i, fmt(o[0]), round(o[1]-o[0], 2)) for i, o in enumerate(out) if not o[2]]
print(f'full-file pass: {len(fw)} words | per-utterance: {nw} words ({nw - len(fw):+d}) | utterances with no text: {len(empty)}')
print('  empty ones >= 0.5 s (listen/re-check if many):', [e for e in empty if e[2] >= 0.5][:40])

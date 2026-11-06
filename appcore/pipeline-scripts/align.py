#!/usr/bin/env python3
"""Step 3: frame-accurate word/phrase timing for audio/clean.wav from the corrected audio/transcript.txt.

  python align.py <project> [--lang en] [--align-model medium.en] [--verify-model small.en]

Pipeline (each stage exists because the previous one had a real failure mode):
  1. stable-ts forced alignment of the exact corrected text  -> word times (can squeeze/merge words).
  2. snap to the waveform: starts that sit in silence move to the first voiced frame; ends extend
     through the decay tail (never into the next word).
  3. pause anchoring: every real pause (< -50 dB, >= 90 ms) must fall BETWEEN words; a word
     straddling a pause is split to the side holding most of its voiced frames.
  4. phrases = the audio's own voiced regions between pauses (ground truth), words assigned by midpoint.
  5. independent check: every phrase region is transcribed on its own (with 200 ms silence padding,
     because Whisper drops the first word of clips that start abruptly) and words are moved across a
     pause when the recogniser clearly hears them on the other side.
  6. false pauses (stop-consonant closures such as the silent 'k' in "se-ctors") are merged: a tiny
     region whose heard text doesn't match, next to a very short gap, joins its neighbour.
Outputs: audio/timeline.json  [{s,e,text,words:[{w,s,e}]}], audio/script_timed.txt (one phrase per line
with start time - use it to storyboard), audio/captions.srt, audio/align_report.json.
Remaining mismatches in the report are usually recogniser spellings ("47gb", "3" vs "III"); read them.
"""
import argparse, difflib, json, os, re, sys, unicodedata, wave
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--lang', default='en')
ap.add_argument('--align-model', default=None); ap.add_argument('--verify-model', default=None)
a = ap.parse_args()
A = os.path.join(os.path.abspath(a.project), 'audio')
en = a.lang == 'en'

# the script's words; punctuation typed apart from its word stays with it (French "mot ?" and its quote marks): never a word of its own
def wnorm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(c for c in s if c.isalnum() and not unicodedata.combining(c))
OPEN = '\u00bb\u203a\u201e\u00bf\u00a1' if a.lang in ('de', 'da') else '\u00ab\u2039\u201e\u00bf\u00a1'
CLOSE = ',.;:!?\u2026%\u2030\u20ac' + ('\u00ab\u2039' if a.lang in ('de', 'da') else '\u00bb\u203a')
# Japanese, Chinese and Thai have no spaces between words: the script's words come from audio/transcript_words.txt (the
# app's word breaker), what was heard is compared letter by letter (Korean too: its spacing varies), a phrase keeps the
# script's own spacing and a word with no space after it gets "ns": 1 (like parakeet_timeline.py)
SOLID = a.lang in ('ja', 'zh', 'th')
CHARS = SOLID or a.lang == 'ko'
if SOLID:
    OPEN += '\u300c\u300e\uff08([\u3010\u3014\u201c\u2018\u300a\u3008'
    CLOSE += '\u3001\u3002\uff0c\uff0e\uff01\uff1f\uff1a\uff1b\u300d\u300f\uff09)]\u3011\u3015\u201d\u2019\u300b\u3009'
def tokens(t):
    out, carry = [], ''
    for x in t.split():
        if wnorm(x) or not all(c in OPEN + CLOSE for c in x): out.append(carry + x); carry = ''
        elif all(c in OPEN for c in x) or not out: carry += x
        else: out[-1] += x
    if carry and out: out[-1] += carry
    elif carry: out.append(carry)
    return out
transcript = open(os.path.join(A, 'transcript.txt'), encoding='utf-8').read()
script = tokens(transcript)
text = ' '.join(script)
ns = [False] * len(script)
if SOLID:
    def solid(c): return unicodedata.category(c)[0] == 'L' and (ord(c) >= 0x2E80 or 0x0E00 <= ord(c) <= 0x0E7F)
    def letters(t):                                # one piece per character when the word breaker's words are missing
        out = []
        for run in t.split():
            cur = ''
            for c in run:
                if cur and (solid(c) or (c.isalnum() and solid(cur[-1]))): out.append(cur); cur = ''
                cur += c
            if cur: out.append(cur)
        return tokens(' '.join(out))
    wf = os.path.join(A, 'transcript_words.txt')
    seg = open(wf, encoding='utf-8').read() if os.path.exists(wf) else ''
    script = tokens(seg) if seg and re.sub(r'\s+', '', seg) == re.sub(r'\s+', '', transcript) else letters(transcript)
    ns, pos = [False] * len(script), 0
    for j, t in enumerate(script):
        at = transcript.find(t, pos)
        if at < 0: continue
        pos = at + len(t); ns[j] = pos < len(transcript) and not transcript[pos].isspace()
    text = ' '.join(transcript.split())                   # aligned as written (the recogniser has no spaces either)
def join(ws, nsf):                                     # words as the script spaces them
    return ''.join(w + ('' if nsf(k) or k == len(ws) - 1 else ' ') for k, w in enumerate(ws))
def units(s):                                          # what is compared: words, or letters (CHARS)
    return list(wnorm(s)) if CHARS else [wnorm(w) for w in s.split()]

# what Whisper heard (transcribe.py, audio/transcript_raw.txt) against the script: another narration, or a script in
# another language, would be force-aligned into nonsense and look timed. Like parakeet_timeline.py: under 60% it stops,
# and it says how many words were heard (the app reads that line: many unheard words are said, not called clean).
raw = os.path.join(A, 'transcript_raw.txt')
heard_n = [wnorm(w) for w in open(raw, encoding='utf-8').read().split()] if os.path.exists(raw) else None
want_n = [wnorm(w) for w in script]
total = sum(1 for x in want_n if x)
if heard_n is not None and total and CHARS:
    # letter by letter (letters heard in runs of 2 in Japanese and Chinese, 3 in Thai and Korean: a script that is not this
    # narration shares many single letters with it); a word is heard when half its letters are
    ha, wb, owner = list(''.join(heard_n)), [], []
    for j, w in enumerate(want_n):
        for c in w: wb.append(c); owner.append(j)
    RUN = 2 if a.lang in ('ja', 'zh') else 3
    sm = difflib.SequenceMatcher(None, ha, wb, autojunk=False)
    heard = [False] * len(wb)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' and i2 - i1 >= RUN:
            for k in range(j1, j2): heard[k] = True
    got = {}
    for k, j in enumerate(owner): got.setdefault(j, [0, 0]); got[j][0] += heard[k]; got[j][1] += 1
    total = len(got) or 1
    matched = sum(1 for h, n in got.values() if h * 2 >= n)
    if matched / total < .6 and total >= 8:
        miss = [script[j] for j, (h, n) in sorted(got.items()) if h * 2 < n]
        sys.exit(f'Only {matched / total:.0%} of the script matched what was spoken. Check that script.txt is the narration of this voiceover '
                 f'(and that the video\'s language is the one spoken), or delete script.txt to use what was heard. First unmatched words: {" ".join(miss[:12])}')
elif heard_n is not None and total:
    sm = difflib.SequenceMatcher(None, [x for x in heard_n if x], want_n, autojunk=False)
    matched = sum(1 for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == 'equal' for j in range(j1, j2) if want_n[j])
    if matched / total < .6 and total >= 8:
        miss = [script[j] for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal' for j in range(j1, j2) if want_n[j]]
        sys.exit(f'Only {matched / total:.0%} of the script matched what was spoken. Check that script.txt is the narration of this voiceover '
                 f'(and that the video\'s language is the one spoken), or delete script.txt to use what was heard. First unmatched words: {" ".join(miss[:12])}')
else: matched = None

import torch, stable_whisper
DEV = 'cuda' if torch.cuda.is_available() else 'cpu'

w = wave.open(os.path.join(A, 'clean.wav')); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
HOP = .005; hop = int(sr * HOP)
db = 20 * np.log10(np.sqrt((x[: len(x) // hop * hop].reshape(-1, hop) ** 2).mean(1) + 1e-12))
F = lambda t: min(len(db) - 1, max(0, int(round(t / HOP))))
ON, OFF = -42, -50

# 1. forced alignment
print(f'aligning on {DEV} ...')
am = stable_whisper.load_model(a.align_model or ('medium.en' if en else 'medium'), device=DEV)
res = am.align(os.path.join(A, 'clean.wav'), text, language=a.lang)
words = [{'w': wd.word.strip(), 's': float(wd.start), 'e': float(wd.end)} for sg in res.segments for wd in sg.words if wd.word.strip()]
del am
if DEV == 'cuda': torch.cuda.empty_cache()

# 2. snap to waveform
fixed = []
for i, wd in enumerate(words):
    s, e = F(wd['s']), F(wd['e'])
    prev_e = F(fixed[-1]['e']) if fixed else 0
    nxt = F(words[i + 1]['s']) if i + 1 < len(words) else len(db) - 1
    if db[s:s + 8].max() < ON:
        k = s
        while k < min(e, s + 30) and db[k] < ON: k += 1
        s = k
    else:
        while s > prev_e and db[s - 1] > OFF: s -= 1
    while e < nxt and db[e] > OFF: e += 1
    if e <= s: e = s + 4
    fixed.append({'w': wd['w'], 's': s * HOP, 'e': e * HOP})
words = fixed

# 3. pause anchoring
q = db < -50; pauses = []; i = 0
while i < len(q):
    if q[i]:
        j = i
        while j < len(q) and q[j]: j += 1
        if (j - i) * HOP >= .09: pauses.append((i * HOP, j * HOP))
        i = j
    else: i += 1
straddle = 0
for pa, pb in pauses:
    for k, wd in enumerate(words):
        if wd['s'] < pa - .03 and wd['e'] > pb + .03:
            straddle += 1
            left = (db[F(wd['s']):F(pa)] > ON).sum(); right = (db[F(pb):F(wd['e'])] > ON).sum()
            if left >= right:
                if k + 1 < len(words): words[k + 1]['s'] = min(words[k + 1]['s'], pb)
                wd['e'] = pa
            else:
                if k > 0: words[k - 1]['e'] = max(words[k - 1]['e'], pa)
                wd['s'] = pb
            break
for k in range(1, len(words)):
    words[k]['s'] = max(words[k]['s'], words[k - 1]['s'] + .02)
    words[k - 1]['e'] = min(words[k - 1]['e'], max(words[k]['s'], words[k - 1]['s'] + .02))
    words[k]['e'] = max(words[k]['e'], words[k]['s'] + .02)

class Word(str):                                       # a word of the script; .ns: no space after it (Japanese, Chinese, Thai)
    ns = False
if SOLID:
    # the recogniser's pieces (characters or tokens) back to the script's words, letter by letter: each word from its
    # first letter's start to its last letter's end
    lt = []
    for wd in words:
        n = wnorm(wd['w'])
        for k, c in enumerate(n): lt.append((c, wd['s'] + (wd['e'] - wd['s']) * k / len(n), wd['s'] + (wd['e'] - wd['s']) * (k + 1) / len(n)))
    wb, owner = [], []
    for j, t in enumerate(script):
        for c in wnorm(t): wb.append(c); owner.append(j)
    ct = [None] * len(wb)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, [x[0] for x in lt], wb, autojunk=False).get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): ct[j1 + k] = lt[i1 + k][1:]
        elif i2 > i1:
            s, e = lt[i1][1], lt[i2 - 1][2]
            for k in range(j2 - j1): ct[j1 + k] = (s + (e - s) * k / (j2 - j1), s + (e - s) * (k + 1) / (j2 - j1))
    se = {}
    for k, j in enumerate(owner):
        if ct[k] is None: continue
        s0, e0 = se.get(j, ct[k]); se[j] = (min(s0, ct[k][0]), max(e0, ct[k][1]))
    nw = []
    for j, t in enumerate(script):
        prev = nw[-1] if nw else None
        s, e = se.get(j, (prev['e'] if prev else 0.0, (prev['e'] if prev else 0.0) + .05))
        if prev: s = max(s, prev['s'] + .02)
        w_ = Word(t); w_.ns = ns[j]
        nw.append({'w': w_, 's': s, 'e': max(e, s + .02)})
    words = nw

# 4. phrases from the audio's voiced regions
dur = len(x) / sr
edges = [0.0] + [t for p in pauses for t in p] + [dur]
regions = []
for i in range(0, len(edges) - 1, 2):
    ra, rb = edges[i], edges[i + 1]
    idx = np.nonzero(db[F(ra):F(rb)] > -50)[0]
    if len(idx) and rb - ra > .05: regions.append([ra + idx[0] * HOP, ra + (idx[-1] + 1) * HOP])
starts = np.array([r[0] for r in regions]); groups = [[] for _ in regions]
for wd in words:
    m = (wd['s'] + wd['e']) / 2
    k = int(np.clip(np.searchsorted(starts, m) - 1, 0, len(regions) - 1))
    if k + 1 < len(regions) and m > regions[k][1] and regions[k + 1][0] - m < m - regions[k][1]: k += 1
    groups[k].append(wd['w'])

# 5. independent verification per region
vm = stable_whisper.load_model(a.verify_model or ('small.en' if en else 'small'), device=DEV)
norm = lambda s: re.sub(r"[^\w ]|_", "", s.lower().replace('-', ' ').replace(',', '')).split()   # any alphabet (Spanish, Polish ...)
if CHARS: norm = lambda s: list(wnorm(s))              # (letter by letter: Japanese, Chinese, Thai, Korean)
pad = np.zeros(int(.2 * sr), np.float32); cache = {}
def hear(k):
    key = tuple(regions[k])
    if key not in cache:
        ra, rb = regions[k]
        clip = np.concatenate([pad, x[int(ra * sr):int(rb * sr)], pad])
        c16 = np.interp(np.arange(0, len(clip), sr / 16000), np.arange(len(clip)), clip).astype(np.float32)
        cache[key] = norm(vm.transcribe(c16, language=a.lang, fp16=DEV == 'cuda', condition_on_previous_text=False, verbose=None).text)
    return cache[key]
NUMW = {'zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen',
        'sixteen','seventeen','eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','hundred','thousand','million','billion'}
isnum = lambda w: w.isdigit() or (en and w in NUMW)
same = lambda p, q: p[:4] == q[:4] or (isnum(p) and isnum(q))
def edge_ok(k):
    h, e = hear(k), norm(' '.join(groups[k]))
    return not (h and e) or (same(h[0], e[0]) and same(h[-1], e[-1]))
moved = merged = 0
for _ in range(3):
    changed = 0
    # 6. merge false pauses (tiny mismatching region next to a tiny gap)
    k = 1
    while k < len(regions):
        gap = regions[k][0] - regions[k - 1][1]
        tiny = min(regions[k][1] - regions[k][0], regions[k - 1][1] - regions[k - 1][0]) < .45
        if groups[k] and groups[k - 1] and gap < .13 and tiny and not (edge_ok(k) and edge_ok(k - 1)):
            regions[k - 1][1] = regions[k][1]; groups[k - 1] += groups[k]
            del regions[k]; del groups[k]; merged += 1; changed += 1
        else: k += 1
    for k in range(len(regions) - 1):
        cur, nxt = groups[k], groups[k + 1]
        if not cur or not nxt: continue
        h, hn = hear(k), hear(k + 1); ec, en_ = norm(' '.join(cur)), norm(' '.join(nxt))
        if not h or not hn or not ec or not en_: continue
        if same(h[-1], en_[0]) and not same(h[-1], ec[-1]) and not same(hn[0], en_[0]):
            cur.append(nxt.pop(0)); moved += 1; changed += 1
        elif same(hn[0], ec[-1]) and not same(hn[0], en_[0]) and not same(h[-1], ec[-1]) and len(cur) > 1:
            nxt.insert(0, cur.pop()); moved += 1; changed += 1
    if not changed: break

# word times inside each phrase: spread by character count between the region's voiced edges
timeline = []
for (ra, rb), g in zip(regions, groups):
    if not g: continue
    L = [max(2, len(re.sub(r'\W', '', t))) for t in g]; c = np.concatenate([[0], np.cumsum(L)]) / sum(L)
    timeline.append({'s': round(ra, 3), 'e': round(rb, 3), 'text': join(g, lambda k: getattr(g[k], 'ns', False)),
                     'words': [{'w': str(t), 's': round(ra + (rb - ra) * c[i], 3), 'e': round(ra + (rb - ra) * c[i + 1], 3), **({'ns': 1} if getattr(t, 'ns', False) else {})} for i, t in enumerate(g)]})
mism = [{'t': round(regions[k][0], 2), 'expected': ' '.join(groups[k]), 'heard': ('' if CHARS else ' ').join(hear(k))}
        for k in range(len(regions)) if groups[k] and not edge_ok(k)]
json.dump(timeline, open(os.path.join(A, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
open(os.path.join(A, 'script_timed.txt'), 'w', encoding='utf-8').write(''.join(f"{p['s']:7.2f}  {p['text']}\n" for p in timeline))
ts = lambda t: f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}'.replace('.', ',')
open(os.path.join(A, 'captions.srt'), 'w', encoding='utf-8').write(''.join(f"{i + 1}\n{ts(p['s'])} --> {ts(p['e'])}\n{p['text']}\n\n" for i, p in enumerate(timeline)))
rep = {'words': len(words), 'phrases': len(timeline), 'pauses': len(pauses), 'straddles_fixed': straddle,
       'words_moved_by_verification': moved, 'false_pauses_merged': merged, 'remaining_edge_mismatches': len(mism),
       'mismatches': mism[:60], 'end': round(timeline[-1]['e'], 3), 'duration': round(dur, 3)}
json.dump(rep, open(os.path.join(A, 'align_report.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in rep.items() if k != 'mismatches'}, indent=1))
for m in mism[:25]: print(f"  {m['t']:7.2f}  exp: {m['expected']}\n           got: {m['heard']}")
if matched is not None: print(f'matched {matched} of {total} script words')

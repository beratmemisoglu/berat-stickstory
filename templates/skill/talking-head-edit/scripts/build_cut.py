"""Step 5 - SCRIPT-FIRST cut. The video is built ONLY from the words listed in script.md; everything else in the
recording is cut by construction (restarts, fillers, reactions, other languages, mumbles, breaths). Nobody decides
what a "bad take" is: you write what the video needs, this pulls exactly those words out of the recording.

script.md - one line per piece, in output order:
    U4 | Okay, so Sonnet five point five just got released          the words are found in U4 (last match wins)
    U131 0-18 | i would say sonnet is completely unusable           explicit word range (utt.txt / words.py indices)
    PLAYBACK 541.75-554.40 | emergence comparison, first sentence   something the viewer must SEE; reason required
    # comment lines and blank lines are ignored
  | text   the words you mean, checked against the recording (a mismatch = error: catches wrong utterances/ranges)
  optional flags after the text:
    !earlier-take: <why>    you deliberately use a take although a later take of the same sentence exists
    !start=<sec> / !end=<sec>   explicit source-time boundary (only for aligner errors; verify with ptr.py first)
    !long: <why>             (PLAYBACK) longer than 15 s because the viewer needs all of it

Boundaries are anchored on WORDS and read from the waveform shape, never from a loudness threshold alone:
  * a word starts where its sound rises out of quiet: soft onsets (f, s, th, h) belong to it, a breath before it does
    not, a mouth click before a non-plosive word does not; a long hissing first sound (s, sh, f) is kept whole;
  * a word ends where its sound has decayed (up to 0.45 s past the aligned end for drawn-out words); a short burst
    after a dip is a stop-consonant release (the t of "can't") and stays; a dip followed by a new sustained sound
    ends the word at the dip (a hidden repeat, the next take);
  * inside a line, the gap between two consecutive words is removed whenever it is longer than 150 ms or holds
    >= 80 ms of audible sound that belongs to no word (a breath, or a stutter the transcript hid, e.g. "their their"
    transcribed as one "their"). Talking flows continuously, no pauses left in.
Hard failures (no overrides): text that does not match the words, a later take of a sentence that was not used,
the same recorded words used twice, pieces out of recording order, a playback > 15 s without !long.
"""
import os, re, sys, json, difflib
import numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fmt, gate, spoken, syllables, has_digit

U = json.load(open('utt.json')); db = np.load('db.npy'); p = load()
AUD = -50.0                      # audible (dBFS, 10 ms frames)
PRE, TAILMAX, GAPMAX, SNDMAX = 0.04, 0.45, 0.15, 0.08   # TAILMAX: a drawn-out word can sound 0.4 s past its aligned end
norm = lambda s: re.sub(r"[^a-z0-9' ]+", ' ', s.lower().replace('-', ' ')).split()
# every aligned word, source order. The forced aligner stretches a phrase's first/last word into the silence around
# it (a last word "ending" 0.7 s after the sound stopped), so words are clamped to the phrase's real sound edges.
# A word placed entirely past the phrase's end (the aligner ran out of audio) was really spoken between the previous
# word and the end of the phrase: it is re-anchored there.
W = []
for i, u in enumerate(U):
    a, b = u[0], u[1]; pe = a
    for k, w in enumerate(u[3]):
        s, e = max(w[0], a - 0.03), min(w[1], b + 0.03)
        if s > b - 0.05: s = min(pe + 0.02, b - 0.05); e = b + 0.03
        e = max(e, s + 0.05); W.append((i, k, s, e, w[2])); pe = e
starts = np.array([w[2] for w in W]); ends = np.array([w[3] for w in W])
widx = {(i, k): n for n, (i, k, *_ ) in enumerate(W)}
fr = lambda t: int(round(t * 100))
# The aligner sometimes puts words into the SILENCE after (or before) where they were spoken: "doesn't look good at
# all" with "good at all" crammed into 150 ms of quiet after the phrase, "It" 100 ms before its sound. Left there, the
# real words look like a gap and get cut out. A word whose aligned time is mostly silent is re-anchored onto the real
# sound between its neighbours (spread by letters); if there is none, it shares the previous word's sound.
def _aud_frac(a, b):
    i, j = fr(a), max(fr(b), fr(a) + 1); return float((db[i:j] > AUD).mean())
def _sound(a, b):
    idx = np.where(db[fr(a):max(fr(b), fr(a) + 1)] > AUD)[0]
    return ((fr(a) + idx[0]) / 100, (fr(a) + idx[-1] + 1) / 100) if idx.size else None
reanchored = 0
n = 0
while n < len(W):
    if _aud_frac(starts[n], ends[n]) >= 0.3: n += 1; continue
    u = W[n][0]; a_ = n
    while n + 1 < len(W) and W[n + 1][0] == u and _aud_frac(starts[n + 1], ends[n + 1]) < 0.3: n += 1
    b_ = n; prv = a_ - 1 if a_ > 0 and W[a_ - 1][0] == u else None; nxt = b_ + 1 if b_ + 1 < len(W) and W[b_ + 1][0] == u else None
    lo = ends[prv] if prv is not None else starts[a_]; hi = starts[nxt] if nxt is not None else ends[b_]
    snd = _sound(lo, hi) if hi > lo else None
    if snd is None and prv is not None:                        # no sound of their own: they are inside the previous word's
        a_ = prv; snd = _sound(starts[prv], hi)                 # interval ("that bad." with "bad" at the end of "that")
    if snd is not None:
        s0, s1 = snd; L = np.array([max(1, len(re.sub(r'[^a-z0-9]', '', W[q][4].lower()))) for q in range(a_, b_ + 1)], float)
        cut = s0 + (s1 - s0) * np.concatenate([[0], np.cumsum(L) / L.sum()])
        for q, (x0, x1) in zip(range(a_, b_ + 1), zip(cut[:-1], cut[1:])):
            starts[q], ends[q] = x0, max(x1, x0 + 0.03); W[q] = (W[q][0], W[q][1], starts[q], ends[q], W[q][4])
        reanchored += b_ - a_ + 1
    n = b_ + 1
# A number written in digits ("5.5", "$37", "51") gets a sliver of time next to its neighbour from the aligner, while
# its sound ("five point five") sits in the gap beside it - which would be cut out as a pause ("Opus 5.5 was" came out
# "Opus five was", "just thirty-seven dollars" as "just thirty"). A number shorter than it can be said (0.12 s per
# spoken syllable) takes the audible sound between its neighbours in the same utterance.
renumbered = 0
for n in range(len(W)):
    if not has_digit(W[n][4]) or ends[n] - starts[n] >= 0.12 * syllables(spoken(W[n][4])): continue
    u = W[n][0]; a_u, b_u = U[u][0], U[u][1]
    lo = ends[n - 1] if n > 0 and W[n - 1][0] == u else max(a_u - 0.05, starts[n] - 1.5)
    hi = starts[n + 1] if n + 1 < len(W) and W[n + 1][0] == u else min(b_u + 0.2, ends[n] + 2.5)
    snd = _sound(lo, hi) if hi - lo > 0.02 else None
    if snd is None: continue
    s0, s1 = min(starts[n], snd[0]), max(ends[n], min(snd[1], hi - 0.01))
    if (s0, s1) != (starts[n], ends[n]):
        starts[n], ends[n] = s0, s1; W[n] = (W[n][0], W[n][1], s0, s1, W[n][4]); renumbered += 1
def audible(a, b):
    return float((db[max(0, fr(a)):max(0, fr(b))] > AUD).sum()) / 100 if b > a else 0.0
def run_after(j, lim):
    """length (frames) of the audible run starting right after frame j"""
    k = j + 1
    while k < lim and db[k] > AUD: k += 1
    return k - j - 1
def tail_end(n):
    """where word n really ends, read from the waveform shape:
       * sustained quiet (>= 40 ms below -50 dB) -> the word is over;
       * a dip followed by a SHORT burst (<= 50 ms, then quiet) -> a stop consonant's release (the t of "can't"): keep;
       * a dip followed by SUSTAINED sound (>= 60 ms) -> something new starts (the next word, a hidden repeat, a
         breath): cut in the dip.  Never past TAILMAX or into the next aligned word."""
    # hard limit: the next aligned word (and 0.8 s); past TAILMAX a still-sounding (drawn-out) word is followed until it
    # drops below -45 dB instead of being cut mid-sound
    e = ends[n]; nxt = starts[n + 1] - 0.02 if n + 1 < len(W) else e + 0.8
    hard = fr(min(e + 0.8, nxt)); soft = fr(e + TAILMAX); j = fr(e); peak = db[max(0, j - 3):j + 1].max() if j > 0 else db[j]
    while j < hard:
        if db[j:j + 4].size == 4 and (db[j:j + 4] < AUD).all(): return j / 100 + 0.02
        if 0 < j and db[j] <= db[j - 1] and db[j] <= db[j + 1] and db[j] <= peak - 8:
            r = run_after(j, hard + 20)
            # a NEW sound (next word, hidden repeat, breath) = sustained AND rising well above the dip; a word's own
            # fading tail (-30 -> -42 dB after a small dip) is not one
            if r >= 6 and db[j + 1:j + 1 + r].max() >= db[j] + 10: return j / 100 + 0.005
        if j >= soft and db[j] < -45: return j / 100 + 0.01
        peak = max(peak, db[j]); j += 1
    return hard / 100
def lead_start(n):
    c = _lead_start(n); w = W[n][4].lstrip('"(').lower()
    # a mouth click right before a non-plosive word: a <=20 ms burst, then a dip >= 8 dB under it (to <= -45 dB),
    # then the word rising. The click is not part of the word -> start at the dip. (plosives p t k b d g keep their burst)
    if w[:1] and w[0] not in 'ptkbdgcq':
        i = fr(c)
        for L in (1, 2):
            if i + L + 1 < len(db):
                bu = db[i:i + L].max(); dp = db[i + L:i + L + 2]; k = i + L + int(np.argmin(dp))
                if db[k] <= -45 and bu - db[k] >= 8 and k / 100 < starts[n]: return k / 100 + 0.005
    return c
def _lead_start(n):
    """where word n really starts: where its sound first rises out of DEEP quiet (-60 dB: soft onsets like the f of
       "fix" at -51 dB belong to the word), at most 100 ms before the aligned start (a longer breath before a word
       stays out), never inside the previous word's own ending"""
    s = starts[n]; low = tail_end(n - 1) if n > 0 and ends[n - 1] < s else max(0.0, s - 0.2)
    # a soft onset (f, s, th, h at -60..-45 dB) rising straight into the word belongs to it: up to 150 ms back
    j0, j1 = fr(max(low, s - 0.15)), fr(s - 0.005)
    if j1 > j0:
        deep = np.where(db[j0:j1] < -60)[0]
        if deep.size:
            c = j0 + deep[-1] + 1
            if c >= fr(s - 0.03) or db[c:fr(s - 0.03)].max() <= -45: return c / 100 + 0.005
    # otherwise (a breath or anything louder sits there): the last quiet (-50 dB) moment within 100 ms of the word
    i0, i1 = fr(max(low, s - 0.10)), fr(s - 0.005)
    if i1 <= i0: return max(low, s - 0.01)
    seg = db[i0:i1]; quiet = np.where(seg < AUD)[0]
    if quiet.size: return (i0 + quiet[-1]) / 100 + 0.01
    # no quiet moment within 100 ms: if ONE steady sound (a long s/sh/f, within 8 dB of the word's own onset) runs
    # straight into the word from a quiet moment up to 250 ms back, it is the word's first sound -> keep all of it
    wd = W[n][4].lstrip('"(').lower(); fric = wd[:1] in ('s', 'f', 'z', 'h', 'x') or wd[:2] in ('th', 'ce', 'ci', 'cy')
    k0 = fr(max(low, s - 0.25)) - 1; k = i1 - 1
    while k > k0 and db[k] >= AUD: k -= 1
    if fric and db[k] < AUD:                                        # only a hissing first sound can run that long
        run = db[k + 3:i1]; own = db[fr(s):fr(s) + 5].mean()            # skip the 20 ms rise
        if run.size and run.max() - run.min() <= 10 and abs(run.mean() - own) <= 8: return (k + 1) / 100 + 0.005
    return (i0 + int(np.argmin(seg))) / 100 + 0.005               # continuous voice: the deepest dip
def quietest(t, lo, hi):
    """move a cut point to the quietest 10 ms frame in [lo, hi] (a join inside quiet audio cannot click)"""
    lo, hi = max(lo, 0.0), max(hi, lo + 0.01); i0, i1 = fr(lo), max(fr(hi), fr(lo) + 1)
    return (i0 + int(np.argmin(db[i0:i1]))) / 100 + 0.005 if i1 > i0 else t
def snap_start(n, t):          # before word n: search back up to 60 ms, never into the previous word's decay
    lim = tail_end(n - 1) if n > 0 else 0.0
    return quietest(t, max(lim, starts[n] - 0.10), starts[n] - 0.01)
def snap_end(n, t):            # after word n: search around its decay, never into the next word
    nxt = starts[n + 1] - 0.02 if n + 1 < len(W) else t + 0.05
    return quietest(t, max(ends[n], t - 0.03), min(nxt, t + 0.05))

lines = [l.rstrip() for l in open('script.md', encoding='utf-8').read().splitlines()]
items, errors, warns = [], [], []
for ln, raw in enumerate(lines, 1):
    s = raw.strip()
    if not s or s.startswith('#'): continue
    head, _, rest = s.partition('|'); parts = rest.split(' !'); text = parts[0].strip(); flags = {}
    for f in parts[1:]:
        fm = re.match(r'\s*([a-z-]+)\s*[:=]?\s*(.*)$', f.strip().lstrip('!'))
        if fm: flags[fm.group(1)] = fm.group(2).strip() or 'yes'
    if text.startswith('!'): errors.append(f'line {ln}: text missing before the flags')
    m = re.match(r'PLAYBACK\s+([\d.]+)\s*-\s*([\d.]+)', head.strip(), re.I)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        if b - a > 15 and 'long' not in flags: errors.append(f'line {ln}: playback {b-a:.0f} s > 15 s - trim it to what is shown, or add "!long: <why>"')
        if not text: errors.append(f'line {ln}: playback needs a reason after |')
        items.append({'kind': 'B', 'a': a, 'b': b, 'line': ln, 'text': text}); continue
    m = re.match(r'U(\d+)(?:\s+(\d+)\s*-\s*(\d+))?\s*$', head.strip())
    if not m: errors.append(f'line {ln}: cannot parse "{head.strip()}" (expected "U<utt> | text", "U<utt> <from>-<to> | text" or "PLAYBACK a-b | why")'); continue
    ui = int(m.group(1))
    if ui >= len(U) or not U[ui][3]: errors.append(f'line {ln}: U{ui} does not exist or has no words'); continue
    if m.group(2) is None:
        # locate the text inside the utterance: best matching word window; ties -> the LAST one (a restart inside one
        # breath says the sentence twice: the second, complete one wins)
        want = norm(text); uw = [norm(x[2]) for x in U[ui][3]]; best = (0, None)
        for a0 in range(len(uw)):
            for L in range(max(1, len(want) - 2), len(want) + 3):
                if a0 + L > len(uw): break
                got = [t for x in uw[a0:a0 + L] for t in x]; r = difflib.SequenceMatcher(None, got, want).ratio()
                if r >= best[0] - 1e-9 and r >= 0.85: best = (r, (a0, a0 + L - 1))
        if not best[1]: errors.append(f'line {ln}: "{text}" not found in U{ui} ("{U[ui][2][:90]}")'); continue
        k0, k1 = best[1]
    else: k0, k1 = int(m.group(2)), int(m.group(3))
    if k1 >= len(U[ui][3]) or k0 > k1: errors.append(f'line {ln}: U{ui} {k0}-{k1} out of range (U{ui} has {len(U[ui][3])} words)'); continue
    ws = U[ui][3][k0:k1 + 1]; got = norm(' '.join(w[2] for w in ws)); want = norm(text)
    if difflib.SequenceMatcher(None, got, want).ratio() < 0.85:
        errors.append(f'line {ln}: text does not match U{ui} {k0}-{k1}: recording has "{" ".join(got)}"'); continue
    items.append({'kind': 'W', 'u': ui, 'k0': k0, 'k1': k1, 'n0': widx[(ui, k0)], 'n1': widx[(ui, k1)], 'line': ln, 'text': text,
                  'start': float(flags['start']) if flags.get('start') else None, 'end': float(flags['end']) if flags.get('end') else None,
                  'earlier': flags.get('earlier-take')})
# last-take rule: a later occurrence of (most of) the same sentence in the next 60 utterances that was not used
used = set()
for it in items:
    if it['kind'] != 'W': continue
    for n in range(it['n0'], it['n1'] + 1):
        if n in used: errors.append(f"line {it['line']}: words of U{it['u']} are used twice")
        used.add(n)
for it in items:
    if it['kind'] != 'W' or it['n1'] - it['n0'] < 3 or it['earlier']: continue
    mine = norm(' '.join(W[n][4] for n in range(it['n0'], it['n1'] + 1))); L = len(mine)
    for j in range(it['u'] + 1, min(len(U), it['u'] + 60)):
        tw = norm(U[j][2])
        for s0 in range(0, max(1, len(tw) - L + 3)):
            win = tw[s0:s0 + L]
            if len(win) >= max(4, L - 2) and difflib.SequenceMatcher(None, mine, win).ratio() >= 0.85:
                later = [n for n in range(len(W)) if W[n][0] == j]
                if not any(n in used for n in later):
                    errors.append(f"line {it['line']}: a LATER take of this sentence exists in U{j} (\"{U[j][2][:70]}\") and is not used - use the last "
                                  f"clean take, or add \"!earlier-take: <why>\"")
                break
        else: continue
        break
# order
last_b = -1
for it in items:
    a = starts[it['n0']] if it['kind'] == 'W' else it['a']
    if a < last_b - 1e-6: errors.append(f"line {it['line']}: out of recording order")
    last_b = ends[it['n1']] if it['kind'] == 'W' else it['b']
if errors:
    print('SCRIPT REJECTED:'); [print('  -', e) for e in errors]; sys.exit(1)

# pieces
spans, split_gaps, removed_snd = [], 0, 0.0
for it in items:
    if it['kind'] == 'B': spans.append([it['a'], it['b'], '[BLOCK] ' + it['text'], it['line']]); continue
    n0, n1 = it['n0'], it['n1']; cur = [it['start'] if it['start'] is not None else lead_start(n0), None, [W[n0][4]]]
    for n in range(n0, n1):
        te, ls = tail_end(n), lead_start(n + 1)
        snd = audible(te, ls)
        # remove what lies between the two words only if there IS something to remove (a pause > GAPMAX, or >= SNDMAX of
        # sound that is neither word); a split where the voice runs straight on would only add a join (and a click risk)
        if ls - te > GAPMAX or snd >= SNDMAX:
            cur[1] = te; spans.append([cur[0], cur[1], ' '.join(cur[2]), it['line']]); split_gaps += 1; removed_snd += snd
            cur = [ls, None, [W[n + 1][4]]]
        else: cur[2].append(W[n + 1][4])
    cur[1] = it['end'] if it['end'] is not None else tail_end(n1); spans.append([cur[0], cur[1], ' '.join(cur[2]), it['line']])
for a_, b_ in zip(spans, spans[1:]):
    if b_[0] < a_[1] - 1e-6: print('SCRIPT REJECTED: overlapping pieces at', fmt(a_[1])); sys.exit(1)
json.dump([[a, b, t] for a, b, t, _ in spans], open('spans.json', 'w'), indent=0)
# every kept word with its aligned times AND its audible extent (where its sound really starts/ends, read from the
# waveform exactly as the cut uses it); check_edit.py audits both
json.dump({'items': items, 'words': [[int(n), float(starts[n]), float(ends[n]), W[n][4], float(lead_start(n)), float(tail_end(n))] for n in sorted(used)]},
          open('script_words.json', 'w'))
tot = sum(b - a for a, b, *_ in spans); blocks = [(fmt(a), f'{b-a:.0f}s') for a, b, t, _ in spans if t.startswith('[BLOCK]')]
unused = [i for i, u in enumerate(U) if u[3] and not any(W[n][0] == i for n in used)]
print(f"{len([i for i in items if i['kind']=='W'])} script lines + {len(blocks)} playback -> {len(spans)} pieces, {fmt(tot)} "
      f"({100*(1-tot/p['screen']['duration']):.0f}% removed) | {split_gaps} in-sentence gaps removed ({removed_snd:.1f} s of breath/unaligned sound among them)")
if reanchored: print(f'{reanchored} word(s) the aligner had put into silence were moved onto their real sound')
if renumbered: print(f'{renumbered} number(s) the aligner had squeezed next to a neighbour now cover their spoken sound')
print(f'utterances with words that are NOT in the script: {len(unused)} (read them once more: is anything the video NEEDS missing?)')
gate('cut', spans=len(spans), duration=tot, blocks=blocks, script_mtime=os.path.getmtime('script.md'))

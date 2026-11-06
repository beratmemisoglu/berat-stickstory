"""FINAL CHECK of the edit against the script (run by finalize.py itself; you may run it anytime).

1. Waveform (deterministic): every kept script word has a KNOWN position in the output (the cut is exact). Every
   audible stretch of the edited audio that belongs to no kept word (+ its natural decay) is unaccounted sound -
   an inhale, a mumble, a stutter the transcript hid, a word from outside the script. >= 120 ms of it = FAIL.
2. Text: the edited audio is transcribed chunk by chunk and compared with the script. A repeat inside a sentence
   that the script does not have, or a filler (um, uh, ...) = FAIL. Missing script words / other differences are
   REVIEW (the transcriber drops and respells words): listen to each with ptr.py.
3. Hidden words: a kept word far longer than its text explains is transcribed together with its neighbour; more
   words than expected = FAIL (a repeat inside the aligner's interval).
4. Long extents: a word whose kept sound reaches > 250 ms past its aligned timing is transcribed in context
   (neighbouring script words); any extra word = FAIL.
Playback blocks are excluded from 1 and 2. Exit code 1 on any FAIL.
"""
import os, re, sys, json, subprocess, difflib
import numpy as np, scipy.io.wavfile as w
sys.path.insert(0, os.path.dirname(__file__)); from common import fmt, gate, AUDIO, spoken, syllables, has_digit
here = os.path.dirname(os.path.abspath(__file__))
S = json.load(open('spans.json')); tl = json.load(open('timeline.json')); SW = json.load(open('script_words.json'))['words']
assert len(S) == len(tl), 'spans.json and timeline.json differ - run build_cut.py and render_audio.py again'
AUD, PAD, MINRUN = -50.0, 0.02, 0.12
# kept words -> output time. Each word covers its AUDIBLE extent (x0..x1: where its sound really starts/ends, the
# same waveform reading the cut uses); extents that reach far past the transcriber's word timing are audited in step 4.
ow, blocks, ext = [], [], []
sw = sorted(SW, key=lambda x: x[1])
for (a, b, t), (sa, sb, o) in zip(S, tl):
    if t.startswith('[BLOCK]'): blocks.append((o, o + (sb - sa))); continue
    for n, ws, we, word, x0, x1 in sw:
        if ws >= sa - 0.2 and ws <= sb and we <= sb + 0.9:
            c0, c1 = max(min(x0, ws), sa), min(max(x1, we), sb)
            ow.append((o + (c0 - sa), o + (c1 - sa), word, ws, we))
            if x1 - we > 0.25: ext.append((o + (we - sa), word, we, min(x1, sb), 'after'))
            if ws - x0 > 0.25: ext.append((o + (c0 - sa), word, max(x0, sa), ws, 'before'))
ow.sort()
# 1. waveform
sr, x = w.read(AUDIO); x = x.astype(np.float32); x = x.mean(1) if x.ndim > 1 else x
hop = sr // 100; n = len(x) // hop; db = 20 * np.log10(np.sqrt((x[:n*hop].reshape(n, hop)**2).mean(1)) + 1e-6)
cover = np.zeros(n, bool)
for a, b, *_ in ow: cover[max(0, int((a - PAD) * 100)):int((b + PAD) * 100) + 1] = True
for a, b in blocks: cover[max(0, int(a * 100)):int(b * 100) + 1] = True
bad = (db > AUD) & ~cover; runs = []; i = 0
while i < n:
    if bad[i]:
        k = i
        while k < n and (bad[k] or (k + 3 < n and bad[k:k+3].any())): k += 1
        if (bad[i:k].sum()) / 100 >= MINRUN: runs.append((i / 100, k / 100, float(db[i:k].max())))
        i = k
    else: i += 1
# a kept script word with NO audible sound where it is kept: the aligner put it into silence and the real word was cut
# out as a "gap" ("the characters doesn't [look good at all]" -> "doesn't ... li-")
silent = [(fmt(a), wd) for a, b, wd, *_ in ow if b - a >= 0.03 and db[max(0, int(a * 100)):int(b * 100) + 1].max(initial=-200) <= AUD]
# a kept NUMBER shorter than it can be said (80 ms per spoken syllable; people say ~5 syllables a second): the aligner
# squeezed "5.5" next to its neighbour and the spoken "five point five" was cut as a pause. The read-back cannot see it
# (numbers are collapsed there), so this is checked on the cut itself.
short_num = [(fmt(a), wd, round(b - a, 2), round(0.08 * syllables(spoken(wd)), 2)) for a, b, wd, *_ in ow if has_digit(wd) and b - a < 0.08 * syllables(spoken(wd))]
# ... and the usual shape of it: a number kept shorter than normal speech (0.2 s per syllable) with >= 150 ms of AUDIBLE
# sound cut out right beside it, between it and its neighbour in the same script line (the rest of the number). A
# restart before a line is not "in line", so it never counts.
sdb = np.load('db.npy'); kept_src = [(a, b) for a, b, t in S if not t.startswith('[BLOCK]')]
def cut_run(a, b):
    best = cur = 0
    for i in range(max(0, int(a * 100)), int(b * 100)):
        t = i / 100 + 0.005
        if i < len(sdb) and sdb[i] > AUD and not any(x <= t <= y for x, y in kept_src): cur += 1; best = max(best, cur)
        else: cur = 0
    return best / 100
wx = {w_[0]: w_ for w_ in SW}
for it in json.load(open('script_words.json'))['items']:
    if it.get('kind') != 'W': continue
    for n in range(it['n0'], it['n1'] + 1):
        w_ = wx.get(n)
        if not w_ or not has_digit(w_[3]) or w_[5] - w_[4] >= 0.2 * syllables(spoken(w_[3])): continue
        for m, side in ((n - 1, 'before'), (n + 1, 'after')):
            if not (it['n0'] <= m <= it['n1']) or m not in wx: continue
            a, b = (wx[m][5], w_[4]) if side == 'before' else (w_[5], wx[m][4])
            r = cut_run(a, b) if 0 < b - a < 3 else 0
            if r >= 0.15: short_num.append((f'src {w_[1]:.2f}', w_[3], round(w_[5] - w_[4], 2), f'{r:.2f} s of its sound was cut {side} it'))
# 2. text: chunks of ~25 s at piece boundaries, playback excluded
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', AUDIO, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'chk16.wav'])
chunks, cur = [], []
for (a, b, t), (sa, sb, o) in zip(S, tl):
    if t.startswith('[BLOCK]'):
        if cur: chunks.append(cur); cur = []
        continue
    cur.append((o, o + (sb - sa)))
    if cur[-1][1] - cur[0][0] > 25: chunks.append(cur); cur = []
if cur: chunks.append(cur)
jobs = [{'id': f'c{i:03d}', 'src': 'chk16.wav', 'ranges': [[c[0][0], c[-1][1]]]} for i, c in enumerate(chunks)]
# 3. a word far longer than its text may hide a repeat inside the aligner's interval: transcribe it on its own
# Transcribed TOGETHER WITH the kept word before it (a word cut out on its own gets the previous word's last sound
# misheard as an extra word: "Opus|5.5" -> "It's 5.5").
say = lambda t: ' '.join(spoken(x) if has_digit(x) else x for x in t.split())   # "$37" is "thirty seven dollars" long
cand = []
for q, (a, b, wd, ws, we) in enumerate(ow):
    if (we - ws) > max(0.8, 0.09 * len(say(wd)) + 0.45):
        pv = ow[q - 1] if q > 0 and 0 <= ws - ow[q - 1][4] < 0.4 else None
        cand.append((a, wd, ws, we, pv[2] if pv else '', pv[3] if pv else ws))
wjobs = [{'id': f'w{i:03d}', 'src': 'scr16.wav', 'ranges': [[s0, we]]} for i, (a, wd, ws, we, pw, s0) in enumerate(cand)]
# 4. extents audit: sound kept as part of a word although it lies > 250 ms outside the transcriber's timing of that
# word must be the word itself (a drawn-out ending, a slow soft onset) - transcribed on its own it may be nothing, a
# vowel, or the word; a DIFFERENT real word there means the cut kept something outside the script
# A tail transcribed on its own is meaningless ("-vive" comes out as "voice"), so the word is transcribed IN CONTEXT:
# the kept word before it + the word with its whole extent + the kept word after it, compared with those script words.
sws = sorted(SW, key=lambda x: x[1]); jobs3 = []
for i, (o, wd, a, b, side) in enumerate(ext):
    q = min(range(len(sws)), key=lambda z: abs(sws[z][1] - (b if side == 'before' else a)) if sws[z][3] == wd else 1e9)
    pv = sws[q - 1] if q > 0 and sws[q][1] - sws[q - 1][2] < 1.5 else None; nx = sws[q + 1] if q + 1 < len(sws) and sws[q + 1][1] - sws[q][2] < 1.5 else None
    r0 = pv[1] if pv else min(a, sws[q][1]); r1 = nx[2] if nx else max(b, sws[q][2])
    jobs3.append({'id': f'x{i:03d}', 'src': 'scr16.wav', 'ranges': [[r0, r1]], 'want': ' '.join(w_[3] for w_ in (pv, sws[q], nx) if w_)})
def hear(js):                  # ONE transcriber call for a list of jobs (every call is a model load)
    if not js: return {}
    json.dump(js, open('check_jobs.json', 'w'))
    r = subprocess.run([sys.executable, os.path.join(here, 'ptr.py'), 'check_jobs.json'], capture_output=True, text=True)
    return {l.split(' ', 1)[0]: l.split(' | ', 1)[1] for l in r.stdout.splitlines() if ' | ' in l}
heard = hear(jobs + wjobs + jobs3)
CONTR = {"we're": 'we are', "it's": 'it is', 'wanna': 'want to', 'gonna': 'going to', "'cause": 'because', 'cause': 'because', "i'm": 'i am',
         "don't": 'do not', "doesn't": 'does not', "that's": 'that is', "there's": 'there is', "you're": 'you are', "they're": 'they are',
         "can't": 'can not', 'cannot': 'can not', "won't": 'will not', "i'd": 'i would', "let's": 'let us', "what's": 'what is', "isn't": 'is not',
         "didn't": 'did not', "i've": 'i have', "you've": 'you have', "couldn't": 'could not', "shouldn't": 'should not', "wouldn't": 'would not',
         "he's": 'he is', "she's": 'she is', "we've": 'we have', "i'll": 'i will', "you'll": 'you will', "it'll": 'it will', 'kinda': 'kind of', 'gotta': 'got to'}
NUM = set('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million point percent'.split())
def toks(s):
    out = []
    s = ' '.join(CONTR.get(t.strip(".,!?"), t) for t in s.lower().replace('-', ' ').split())
    for t in re.sub(r"[^a-z0-9.' ]+", ' ', s).split():
        t = t.strip(".'")
        if not t: continue
        tok = '#' if (re.search(r'\d', t) or t in NUM) else t
        if not (tok == '#' and out and out[-1] == '#'): out.append(tok)
    return out
same = lambda p, q: p == q or difflib.SequenceMatcher(None, p, q).ratio() >= 0.7
# The transcriber spells the same sound differently all the time ("Vincent" / "when Sonnet"), so a plain text diff is
# a REVIEW list, never the gate. The gate looks for the defects themselves: a repeat the script does not have, and
# fillers. (Anything audible outside the script words is already caught deterministically by the waveform check.)
FILL = {'uh', 'um', 'erm', 'hmm', 'mm', 'uhm', 'ah', 'eh'}
def reps(t):
    out = set()
    for n in range(1, 5):
        for i in range(len(t) - 2 * n + 1):
            if t[i:i+n] == t[i+n:i+2*n] and t[i] != '#': out.add(' '.join(t[i:i+2*n]))
    return out
def in_script(r, want):        # the script has this repetition too (spelled a bit differently by the transcriber)
    x = r.split(); n = len(x) // 2
    return any(all(same(want[i + q], x[q]) and same(want[i + n + q], x[n + q]) for q in range(n)) for i in range(len(want) - 2 * n + 1))
def defects(txt, want):
    """repeats the script does not have + fillers, in one transcription of a chunk"""
    # a stutter repeats INSIDE a sentence ("say that their their"); "...with Sonnet. Sonnet spent..." is two sentences
    got_r = set().union(*[reps(toks(s_)) for s_ in re.split(r'[.?!]+', txt)] or [set()])
    out = {r: 'repeated words the script does not have' for r in got_r - reps(want) if not in_script(r, want)}
    out.update({f_: 'filler' for f_ in {t for t in toks(txt) if t in FILL} - set(want)})
    return out
extra, missing, review, cwant, once = [], [], [], {}, []
for ci, (jb, c) in enumerate(zip(jobs, chunks)):
    a0, b0 = c[0][0], c[-1][1]
    want = toks(' '.join(wd for a, b, wd, *_ in ow if a >= a0 - 0.05 and b <= b0 + 0.05)); got = toks(heard.get(jb['id'], '')); cwant[ci] = want
    if len(want) >= 3 and not got: extra.append((fmt(a0), '(nothing heard)', 'the transcriber heard nothing in this chunk: it could not be verified', ci)); continue
    for r, why in sorted(defects(heard.get(jb['id'], ''), want).items()): extra.append((fmt(a0), r, why, ci))
    sm = difflib.SequenceMatcher(None, want, got, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal': continue
        wseg, gseg = want[i1:i2], got[j1:j2]
        if op == 'replace' and len(wseg) == len(gseg) and all(same(p, q) for p, q in zip(wseg, gseg)): continue
        if op in ('delete', 'replace') and len(wseg) - len(gseg) >= 3: missing.append((fmt(a0), ' '.join(wseg)))
        else: review.append((fmt(a0), ' '.join(wseg), ' '.join(gseg)))
# A repeat or filler heard ONCE can be the transcriber (the same audio passed a minute earlier, then failed in the final
# gate). Every flagged chunk is heard again - whole with its edges moved in, and as two overlapping halves (different
# context) - and a defect fails only when a second listen hears it too. A real stutter or "um" is heard every time.
if extra:
    cj = []
    for ci in sorted({e[3] for e in extra}):
        c = chunks[ci]; a0, b0 = c[0][0], c[-1][1]; cj.append({'id': f'cc{ci:03d}', 'src': 'chk16.wav', 'ranges': [[a0 + 0.03, b0 - 0.03]]})
        if len(c) >= 2:
            m = len(c) // 2
            cj += [{'id': f'ca{ci:03d}', 'src': 'chk16.wav', 'ranges': [[a0, c[m][1]]]}, {'id': f'cb{ci:03d}', 'src': 'chk16.wav', 'ranges': [[c[m - 1][0], b0]]}]
    again = hear(cj); confirmed = []
    for t, r, why, ci in extra:
        reads = [again.get(f'{p}{ci:03d}', '') for p in ('cc', 'ca', 'cb')]
        if r == '(nothing heard)':
            if not toks(reads[0]): confirmed.append((t, r, why, ci)); continue
            # heard on the second listen: judge it on that read, a defect confirmed by one of the halves
            for r2, why2 in defects(reads[0], cwant[ci]).items():
                if any(r2 in defects(x, cwant[ci]) for x in reads[1:] if x): confirmed.append((t, r2, why2, ci))
                else: once.append((t, r2, why2))
            continue
        if any(r in defects(x, cwant[ci]) for x in reads if x): confirmed.append((t, r, why, ci))
        else: once.append((t, r, why))
    extra = confirmed
extra = [e[:3] for e in extra]
# an empty read of a word / extent job proves nothing: once more with 0.3 s of padding (the transcriber sometimes returns
# nothing on a tight range), all retries in one call; still empty = FAIL, never a silent pass
heard.update(hear([dict(j, ranges=[[j['ranges'][0][0] - 0.3, j['ranges'][0][1] + 0.3]]) for j in wjobs + jobs3 if not toks(heard.get(j['id'], ''))]))
sus = []
if cand:
    got2 = heard
    for i, (a, wd, ws, we, pw, s0) in enumerate(cand):
        h = toks(got2.get(f'w{i:03d}', '')); ww = toks(say((pw + ' ' + wd).strip()))
        if not h: sus.append((fmt(a), (pw + ' ' + wd).strip(), 'NOTHING (could not be verified)', round(ws, 2), None)); continue
        if len(h) > len(ww):
            sus.append((fmt(a), (pw + ' ' + wd).strip(), ' '.join(h), round(ws, 2), i))
def src_of(t):
    for (a_, b_, t_), (sa, sb, o) in zip(S, tl):
        if o <= t <= o + (sb - sa): return sa + (t - o), t_
    return None, ''
for a, b, m in runs[:60]:
    sa, txt = src_of(a)
    print(f'  FAIL {fmt(a)}-{fmt(b)} ({b-a:.2f}s, peak {m:.0f} dB, source {sa:.2f}s in piece "{txt[:40]}"): sound that is no kept word '
          f'(inhale / mumble / hidden repeat / out-of-script word)' if sa is not None else f'  FAIL {fmt(a)}-{fmt(b)}: unaccounted sound')
# 4. (jobs3, transcribed above) the extents: in context, extra words between the context words = FAIL
ext_bad = []
if ext:
    got3 = heard
    for i, ((o, wd, a, b, side), jb) in enumerate(zip(ext, jobs3)):
        h = [t for t in toks(got3.get(jb['id'], '')) if t not in FILL]; ww = toks(jb['want'])
        if not h: ext_bad.append((fmt(o), wd, side, f'script "{jb["want"]}" / heard NOTHING (could not be verified)', round(a, 2), round(b, 2), None)); continue
        ops = difflib.SequenceMatcher(None, ww, h, autojunk=False).get_opcodes()
        eq = [x for x in ops if x[0] == 'equal']
        # words heard OUTSIDE the context words come from past the window's edge (the transcriber catches the start of
        # the next word): ignored, but only when that context word itself was heard. Anything between them is kept sound.
        lo = eq[0][3] if eq and eq[0][1] == 0 else 0
        hi = eq[-1][4] if eq and eq[-1][2] == len(ww) else len(h)
        more = [h[j] for op, i1, i2, j1, j2 in ops
                if op in ('insert', 'replace') and (j2 - j1) > (i2 - i1)
                and not (op == 'replace' and difflib.SequenceMatcher(None, ''.join(ww[i1:i2]), ''.join(h[j1:j2])).ratio() >= 0.6)
                for j in range(j1, j2) if lo <= j < hi]
        if more: ext_bad.append((fmt(o), wd, side, f'script "{jb["want"]}" / heard "{" ".join(h)}"', round(a, 2), round(b, 2), i))
# A FAIL heard once can be the transcriber catching the NEIGHBOURING word at the window's edge ("right now I" heard as
# "right now you can" - the same audio passed a minute earlier). Every extent / hidden-word FAIL gets a second listen
# with that edge moved off the neighbour: a word really kept inside the tested sound is heard again, a misheard edge is
# not. Unconfirmed ones are listed for a listen, confirmed ones fail.
conf_jobs = []
for t, wd, side, h, a, b, i in ext_bad:
    if i is None: continue
    jb, (o_, wd_, a_, b_, side_) = jobs3[i], ext[i]; r0, r1 = jb['ranges'][0]; parts = jb['want'].split()
    k = parts.index(wd_) if wd_ in parts else (1 if len(parts) > 2 else 0)
    if side_ == 'after': conf_jobs.append({'id': f'cx{i:03d}', 'src': 'scr16.wav', 'ranges': [[r0, b_ + 0.06]], 'want': ' '.join(parts[:k + 1]), 'tail': 1})
    else: conf_jobs.append({'id': f'cx{i:03d}', 'src': 'scr16.wav', 'ranges': [[a_ - 0.06, r1]], 'want': ' '.join(parts[k:]), 'tail': 0})
for t, g, h, ws_, i in sus:
    if i is not None: conf_jobs.append({'id': f'cw{i:03d}', 'src': 'scr16.wav', 'ranges': [[cand[i][5] + 0.04, cand[i][3] - 0.04]], 'want': say(g)})
heard2 = hear(conf_jobs); unconfirmed = []
def still_extra(j):
    h = [t for t in toks(heard2.get(j['id'], '')) if t not in FILL]; ww = toks(j['want'])
    if not h: return False
    if j['id'].startswith('cw'): return len(h) > len(ww)
    # the tested sound is now at the window's edge: tokens beyond the target on that side are kept sound
    ops = difflib.SequenceMatcher(None, ww, h, autojunk=False).get_opcodes(); eq = [x for x in ops if x[0] == 'equal']
    lo = eq[0][3] if (j['tail'] and eq and eq[0][1] == 0) else 0
    hi = eq[-1][4] if (not j['tail'] and eq and eq[-1][2] == len(ww)) else len(h)
    return any(op in ('insert', 'replace') and (j2 - j1) > (i2 - i1) and any(lo <= q < hi for q in range(j1, j2))
               and not (op == 'replace' and difflib.SequenceMatcher(None, ''.join(ww[i1:i2]), ''.join(h[j1:j2])).ratio() >= 0.6)
               for op, i1, i2, j1, j2 in ops)
keep = {j['id']: still_extra(j) for j in conf_jobs}
for x in list(ext_bad):
    if x[6] is not None and not keep.get(f'cx{x[6]:03d}', True): ext_bad.remove(x); unconfirmed.append((x[0], x[1], x[3]))
for x in list(sus):
    if x[4] is not None and not keep.get(f'cw{x[4]:03d}', True): sus.remove(x); unconfirmed.append((x[0], x[1], x[2]))
print(f'waveform: {len(runs)} unaccounted sound stretch(es) >= {int(MINRUN*1000)} ms; {len(ext)} long word extent(s) audited, {len(ext_bad)} hold other words')
for t, wd, side, h, a, b, _ in ext_bad: print(f'  FAIL {t}: the sound kept {side} "{wd}" (src {a}-{b}) is "{h}" - not part of that word')
for t, wd, h in unconfirmed: print(f'  REVIEW {t}: "{wd}" - heard once as "{h}", not on a second listen (a neighbour misheard at the edge?)')
print(f'script words kept as silence: {len(silent)}; numbers kept too short to be said: {len(short_num)}')
for t, wd, got, need in short_num[:60]: print(f'  FAIL {t}: "{wd}" ("{spoken(wd)}") is kept for {got} s; ' + (f'it needs at least {need} s' if isinstance(need, float) else need) + ' - the spoken number was cut')
for t, wd in silent[:60]: print(f'  FAIL {t}: "{wd}" is kept with no sound - the aligner misplaced it and the real word is probably cut out (listen with ptr.py)')
print(f'text: {len(extra)} repeat/filler(s), {len(missing)} run(s) of 3+ script words not heard, {len(sus)} word(s) hiding extra words')
for t, g, why in extra[:60]: print(f'  FAIL {t}: "{g}" - {why}')
for t, g, h, ws, _ in sus[:30]: print(f'  FAIL {t}: the recording of "{g}" (src {ws}) holds "{h}" - a hidden extra word; re-take or cut it')
for t, g in missing[:30]: print(f'  REVIEW {t}: script words not heard "{g}" - listen with ptr.py on the output (the transcriber drops words; a cut can too)')
open('check_review.txt', 'w', encoding='utf-8').write('\n'.join(f'{t}: script "{w_}" / heard "{g}"' for t, w_, g in review) + '\n')
for t, r, why in once: print(f'  REVIEW {t}: "{r}" ({why}) heard once, not on a second listen - listen with ptr.py')
print(f'  ({len(review)} small transcriber differences - spellings, dropped short words - are listed in check_review.txt)')
ok = not runs and not extra and not sus and not ext_bad and not silent and not short_num
gate('check', ok=ok, unaccounted=[(fmt(a), round(b - a, 2)) for a, b, m in runs], extra=[e[:2] for e in extra], missing=missing,
     hidden=sus, review=review, audio_mtime=os.path.getmtime(AUDIO))
print('CHECK PASSED' if ok else 'CHECK FAILED'); sys.exit(0 if ok else 1)

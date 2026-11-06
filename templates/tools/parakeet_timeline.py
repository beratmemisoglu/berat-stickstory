"""Parakeet word timings (audio/clean.json) + corrected script (audio/transcript.txt)
-> audio/timeline.json [{s,e,text,words:[{w,s,e}]}], audio/script_timed.txt, audio/captions.srt.

  python parakeet_timeline.py <project> [--lang es]     (the narration's language, ISO 639-1; English by default)

Words are compared without case, accents or punctuation, in any alphabet ("Transcripción," = "transcripcion").
Japanese, Chinese and Thai have no spaces between words: the script's words come from audio/transcript_words.txt (the app
splits them with the system's word breaker; one character at a time when it is missing or out of date), the spoken
words are compared letter by letter (a transcriber splits them its own way), a word that has no space after it in the
script gets "ns": 1 in timeline.json, and a phrase's text keeps the script's own spacing. Korean is compared letter by
letter too (its spacing varies between writers and transcribers)."""
import json, os, re, sys, difflib, wave, unicodedata
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
LANG = sys.argv[sys.argv.index('--lang') + 1].lower() if '--lang' in sys.argv[:-1] else 'en'
if LANG in args: args.remove(LANG)
A = os.path.join(os.path.abspath(args[0] if args else '.'), 'audio')
pk = json.load(open(os.path.join(A, 'clean.json'), encoding='utf-8'))['words']
SOLID = LANG in ('ja', 'zh', 'th')                # written without spaces between words
CHARS = SOLID or LANG == 'ko'                     # spoken words matched letter by letter
def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(c for c in s if (c.isalnum() and not unicodedata.combining(c)))
# punctuation typed apart from its word stays with it (French "mot ?", "« je »": the app's transcript joins them, a
# transcript written elsewhere may not): never a word of its own to hear, highlight or leave dangling on a caption card.
# Closing marks go with the word before, opening ones with the word after (German and Danish quote »like this«).
OPEN = '»›„¿¡' if LANG in ('de', 'da') else '«‹„¿¡'
CLOSE = ',.;:!?…%‰€' + ('«‹' if LANG in ('de', 'da') else '»›')
if SOLID: OPEN += '「『（([【〔“‘《〈'; CLOSE += '、。，．！？：；」』）)]】〕”’》〉'
def tokens(text):
    out, carry = [], ''
    for t in text.split():
        if norm(t) or not all(c in OPEN + CLOSE for c in t): out.append(carry + t); carry = ''
        elif all(c in OPEN for c in t) or not out: carry += t
        else: out[-1] += t
    if carry and out: out[-1] += carry
    elif carry: out.append(carry)
    return out
def solid(c):                                      # a letter of a script without spaces (CJK, Thai; not a mark)
    return unicodedata.category(c)[0] == 'L' and (ord(c) >= 0x2E80 or 0x0E00 <= ord(c) <= 0x0E7F)
def letters(text):
    """A text without spaces in its smallest pieces: each Chinese character, kana or Thai letter (with its marks), each
    Latin word or number whole, punctuation with the piece before it."""
    out = []
    for run in text.split():
        cur = ''
        for c in run:
            if cur and (solid(c) or (c.isalnum() and solid(cur[-1]))): out.append(cur); cur = ''
            cur += c
        if cur: out.append(cur)
    return tokens(' '.join(out))
transcript = open(os.path.join(A, 'transcript.txt'), encoding='utf-8').read()
script = tokens(transcript)
if SOLID:                                          # the words the app's word breaker found, when they are this transcript's
    wf = os.path.join(A, 'transcript_words.txt')
    seg = open(wf, encoding='utf-8').read() if os.path.exists(wf) else ''
    script = tokens(seg) if seg and re.sub(r'\s+', '', seg) == re.sub(r'\s+', '', transcript) else letters(transcript)
# which words have no space after them in the transcript (Japanese, Chinese, Thai): a phrase keeps the script's spacing
ns = [False] * len(script)
if SOLID:
    pos = 0
    for j, t in enumerate(script):
        at = transcript.find(t, pos)
        if at < 0: continue
        pos = at + len(t)
        ns[j] = pos < len(transcript) and not transcript[pos].isspace()
if not pk: sys.exit('No words were heard in the voiceover (music, silence, or a language the transcriber does not know?).')
if not script: sys.exit('The transcript is empty. Add the narration to script.txt, or remove script.txt to use what the transcriber heard.')
try:
    with wave.open(os.path.join(A, 'clean.wav')) as wv: DUR = wv.getnframes() / wv.getframerate()
except Exception: DUR = pk[-1]['end'] + 1
NUM = {'10': 'ten', '40': 'forty', '100': 'onehundred', '1': 'one'} if LANG == 'en' else {}   # the recogniser writes some numbers in digits
words = [None] * len(script)
if not CHARS:
    a = [NUM.get(norm(w['word']), norm(w['word'])) for w in pk]
    b = [norm(w) for w in script]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): words[j1 + k] = (pk[i1 + k]['start'], pk[i1 + k]['end'])
        elif i2 > i1:                                   # replace: spread the heard span over the script words
            s, e = pk[i1]['start'], pk[i2 - 1]['end']
            n = j2 - j1
            for k in range(n): words[j1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    # (words only: a mark that is a token of its own, like a dash, is neither heard nor missed)
    total = sum(1 for x in b if x) or 1
    matched = sum(1 for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == 'equal' for j in range(j1, j2) if b[j])
    miss = [script[j] for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal' for j in range(j1, j2) if b[j]]
else:
    # letter by letter: each heard word's time is shared by its letters, each script letter knows its word
    a, at = [], []
    for w in pk:
        n = norm(w['word'])
        for k, c in enumerate(n): a.append(c); at.append((w['start'] + (w['end'] - w['start']) * k / len(n), w['start'] + (w['end'] - w['start']) * (k + 1) / len(n)))
    b, owner = [], []
    for j, t in enumerate(script):
        for c in norm(t): b.append(c); owner.append(j)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    ct, heard = [None] * len(b), [False] * len(b)
    # letters only count as heard in runs (two in a row in Japanese and Chinese, three in Thai and Korean, whose letters
    # repeat more): a script that is not this narration still shares many single letters with it
    RUN = 2 if LANG in ('ja', 'zh') else 3
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): ct[j1 + k] = at[i1 + k]; heard[j1 + k] = i2 - i1 >= RUN
        elif i2 > i1:
            s, e = at[i1][0], at[i2 - 1][1]
            n = j2 - j1
            for k in range(n): ct[j1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    have = {}
    for k, j in enumerate(owner):
        if ct[k] is None: continue
        s, e = have.get(j, (ct[k][0], ct[k][1]))
        have[j] = (min(s, ct[k][0]), max(e, ct[k][1]))
    for j, se in have.items(): words[j] = se
    # a word counts as heard when at least half its letters were
    got = {}
    for k, j in enumerate(owner): got.setdefault(j, [0, 0]); got[j][0] += heard[k]; got[j][1] += 1
    total = len(got) or 1
    matched = sum(1 for h, n in got.values() if h * 2 >= n)
    miss = [script[j] for j, (h, n) in sorted(got.items()) if h * 2 < n]
ratio = matched / total
if ratio < .6 and total >= 8:                   # a wrong script (or wrong audio) would time every word to nonsense
    sys.exit(f'Only {ratio:.0%} of the script matched what was spoken. Check that script.txt is the narration of this voiceover '
             f'(and that the video\'s language is the one spoken), or delete script.txt to use what was heard. First unmatched words: {" ".join(miss[:12])}')
for i in range(len(words)):                          # fill unmatched with neighbours
    if words[i] is None:
        p = min(words[i - 1][1] if i else 0, DUR - .05)
        words[i] = (p, min(p + .05, DUR))
for i in range(1, len(words) if CHARS else 0):      # (letter by letter, a word may start a hair before the last ended)
    if words[i][0] < words[i - 1][0]: words[i] = (words[i - 1][0], max(words[i][1], words[i - 1][0]))
W = [{'w': script[i], 's': round(words[i][0], 3), 'e': round(max(words[i][1], words[i][0] + .04), 3), **({'ns': 1} if ns[i] else {})} for i in range(len(script))]

# phrases: split at real pauses (gap >= 0.28 s) or sentence ends with gap >= 0.18
END = '.?!:…。？！：।'
phr, cur = [], []
for i, w in enumerate(W):
    if cur:
        gap = w['s'] - cur[-1]['e']
        if gap >= .28 or (gap >= .18 and cur[-1]['w'][-1] in END):
            phr.append(cur); cur = []
    cur.append(w)
phr.append(cur)
def join(ws): return ''.join(x['w'] + ('' if x.get('ns') or k == len(ws) - 1 else ' ') for k, x in enumerate(ws))
TL = [{'s': p[0]['s'], 'e': p[-1]['e'], 'text': join(p), 'words': p} for p in phr]
json.dump(TL, open(os.path.join(A, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(A, 'script_timed.txt'), 'w', encoding='utf-8').write('\n'.join(f"{p['s']:7.2f}  {p['text']}" for p in TL))
def ts(t): h, r = divmod(t, 3600); m, s = divmod(r, 60); return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'.replace('.', ',')
srt, n, buf = [], 1, []
CUE = 20 if LANG in ('ja', 'zh') else 38                # captions: <= ~42 characters per cue (Japanese and Chinese: ~22, twice as wide)
for p in TL:
    for w in p['words']:
        buf.append(w)
        if len(join(buf)) > CUE or w is p['words'][-1]:
            srt.append(f"{n}\n{ts(buf[0]['s'])} --> {ts(buf[-1]['e'] + .15)}\n{join(buf)}\n"); n += 1; buf = []
open(os.path.join(A, 'captions.srt'), 'w', encoding='utf-8').write('\n'.join(srt))
print(f'{len(W)} words, {len(TL)} phrases, unmatched script words: {miss}')
print(f'matched {matched} of {total} script words')    # the app reads this line: many unheard words are said, not called clean

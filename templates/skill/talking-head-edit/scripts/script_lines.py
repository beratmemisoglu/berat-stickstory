"""Write script.md lines straight from the transcript, so no sentence has to be typed out by hand.
usage: python script_lines.py 4 5 11-13 20 >> script.md
Prints "U<n> | <the utterance's full text>" for each utterance (ranges inclusive), in the order given. For an utterance
you need only PART of (it starts with a false start, ends in a restart), edit that line down to the words you mean -
build_cut.py finds them inside the utterance (the last match wins). Nothing here decides anything: you choose the numbers.

usage: python script_lines.py --read
Prints the finished script.md AS THE VIEWER HEARS IT: flowing text, a paragraph per ~45 s, playbacks marked. Read it
with one question per line: would the viewer miss it? (references/editing-doctrine.md, "The viewer test")
"""
import re, sys, json
sys.stdout.reconfigure(encoding='utf-8')
U = json.load(open('utt.json'))
if '--read' in sys.argv:
    par, out, t = [], [], 0.0
    for l in open('script.md', encoding='utf-8').read().splitlines():
        m = re.match(r'^U(\d+)(?:\s+\d+-\d+)?\s*\|\s*(.*?)(?:\s+!.*)?$', l)
        if m:
            u = int(m.group(1)); par.append(f'[{u}] {m.group(2).strip()}'); t += U[u][1] - U[u][0] if u < len(U) else 0
            if t > 45: out.append(' '.join(par)); par, t = [], 0.0
        elif l.startswith('PLAYBACK'):
            if par: out.append(' '.join(par)); par, t = [], 0.0
            out.append(f'   >> {l}')
    if par: out.append(' '.join(par))
    print('\n\n'.join(out)); sys.exit(0)
out = []
for a in sys.argv[1:]:
    lo, _, hi = a.partition('-'); lo = int(lo); hi = int(hi) if hi else lo
    for i in range(lo, hi + 1):
        if i >= len(U) or not U[i][3]: print(f'# U{i}: no words (skipped)', file=sys.stderr); continue
        out.append(f'U{i} | {U[i][2].strip()}')
print('\n'.join(out))

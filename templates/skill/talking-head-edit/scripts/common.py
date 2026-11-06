"""Shared helpers. Every script runs with CWD = the work folder (Toon Studio: <project>/work; standalone:
<footage folder>/Edit/work) and reads project.json there.

Deliverables go to OUT: $CZ_OUT when set (Toon Studio: <project>/out/edit), else the folder above work/.
Every quality gate records its result in gates.json (read by finalize.py)."""
import json, os, subprocess, sys, time
from fractions import Fraction

OUT = os.environ.get('CZ_OUT') or os.path.abspath('..')
os.makedirs(OUT, exist_ok=True)
AUDIO = os.path.join(OUT, 'Edited_Audio.wav')
SCREEN_OUT = os.path.join(OUT, 'ScreenRecording_Edited.mov')
CAM_OUT = os.path.join(OUT, 'Facecam_Edited.mov')

def load():
    return json.load(open('project.json', encoding='utf-8'))

def save(p):
    json.dump(p, open('project.json', 'w', encoding='utf-8'), indent=1)

def gate(name, **data):
    """Record a gate result (with a timestamp, so finalize.py can tell a stale check from a fresh one)."""
    g = json.load(open('gates.json', encoding='utf-8')) if os.path.exists('gates.json') else {}
    g[name] = {**data, 'at': time.time()}
    json.dump(g, open('gates.json', 'w', encoding='utf-8'), indent=1)

def fmt(t):
    t = max(0.0, float(t)); return f"{int(t // 60)}:{t % 60:05.2f}"

def fps_of(s):
    return Fraction(s) if '/' in str(s) else Fraction(int(float(s)))

def _parakeet():
    """The local Parakeet pipeline (~/tools/parakeet), if installed: (python, script) or None."""
    root = os.path.join(os.path.expanduser('~'), 'tools', 'parakeet')
    for py in (os.path.join(root, '.venv', 'Scripts', 'python.exe'), os.path.join(root, '.venv', 'bin', 'python')):
        if os.path.exists(py) and os.path.exists(os.path.join(root, 'transcribe.py')):
            return py, os.path.join(root, 'transcribe.py')
    return None

def asr_base(p=None):
    """Local ASR command, never cloud. Order: project.json asr_python / asr_script; the app's choice
    (CZ_ASR_PYTHON / CZ_ASR_SCRIPT, set by Toon Studio); the user's Parakeet; else the bundled Whisper fallback
    (asr_whisper.py, same output format) on this Python."""
    p = p or {}
    py, sc = p.get('asr_python') or os.environ.get('CZ_ASR_PYTHON'), p.get('asr_script') or os.environ.get('CZ_ASR_SCRIPT')
    if not (py and sc):
        pk = _parakeet()
        if pk: py, sc = py or pk[0], sc or pk[1]
        else: py, sc = py or sys.executable, sc or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'asr_whisper.py')
    return [os.path.expanduser(os.path.expandvars(py)), os.path.expanduser(os.path.expandvars(sc))]

def run_asr(files, out, align=True, p=None):
    """Transcribe many files in ONE call (model load is the main cost). Writes <stem>.json with text/segments/words."""
    cmd = asr_base(p) + [str(f) for f in files] + ['--out', out] + ([] if align else ['--no-align'])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print('ASR FAILED:', r.stderr[-1500:])
    return r

def read_asr(path):
    if not os.path.exists(path): return None
    return json.load(open(path, encoding='utf-8'))

def cam_keys(p):
    return list(p['cams'].keys())

# ---- numbers: the forced aligner cannot place a word written in digits ("5.5", "$37", "51") - it gets a sliver of
# time next to its neighbour while its sound ("five point five") sits in the gap beside it. build_cut.py uses the
# spoken form to see that a number is timed too short, check_edit.py to prove every kept number has room to be said.
import re as _re
_ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
_TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()
def _int_words(n):
    if n < 20: return _ONES[n]
    if n < 100: return _TENS[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + _ONES[n % 10])
    if n < 1000: return _ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + _int_words(n % 100))
    if n < 1_000_000: return _int_words(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + _int_words(n % 1000))
    return ' '.join(_ONES[int(d)] for d in str(n))
def spoken(word):
    """how a word is SAID: '5.5' -> 'five point five', '$37' -> 'dollars thirty seven', '2019' -> 'twenty nineteen'"""
    out = []; cur = False; grouped = bool(_re.search(r'\d,\d', word))   # "2,000" is two thousand, "2019" is said like a year
    for tok in _re.findall(r'\d+(?:\.\d+)?|[a-z]+|[%$]', word.lower().replace(',', '')):
        if tok == '%': out.append('percent')
        elif tok == '$': cur = True                   # said after the number: thirty seven dollars
        elif tok[0].isdigit():
            ip, _, fp = tok.partition('.'); n = int(ip)
            if len(ip) == 4 and 1100 <= n <= 2099 and n % 1000 and not fp and not grouped: out.append(_int_words(n // 100) + ' ' + (_int_words(n % 100) if n % 100 else 'hundred'))
            else: out.append(_int_words(n) if len(ip) <= 6 else ' '.join(_ONES[int(d)] for d in ip))
            if fp: out.append('point ' + ' '.join(_ONES[int(d)] for d in fp))
            if cur: out.append('dollars'); cur = False
        elif tok == 'k': out.append('thousand')
        else: out.append(tok)
    return ' '.join(out)
def syllables(text):
    """rough syllable count (vowel groups; a vowel-less token like 'gpt' is spelled out letter by letter)"""
    n = 0
    for t in text.split():
        v = len(_re.findall(r'[aeiouy]+', t))
        if v > 1 and t.endswith('e') and not t.endswith(('le', 'ee')): v -= 1       # silent e: five, one, minute
        n += v if v else len(t)
    return max(1, n)
has_digit = lambda w: bool(_re.search(r'\d', w))

#!/usr/bin/env python3
"""Recorded sound effects for every style's sound designer: the built-in CC0 / public-domain library
(templates/lowpoly/library/sfx) merged with the user's own library (<workspace>/assets/sfx, Settings > Media > Sound
effects library). Both have an index.json {"entries": [{id, category, tags, file, duration, licence, author, source_url,
credit_text, (user) lufs, name}]}; the user's entries win per category ("Yours" in the app).

    from sfxlib import Library
    LIB = Library(project_dir, sys.argv[2:], sr=48000)      # --sfx-lib DIR (repeatable; the app passes yours, then the built-in)
    x = LIB.recorded('impact', dur, REC)                      # mono float64 at sr, or None (no clip of that kind)
    LIB.write_credits()                                       # DESCRIPTION.txt block: built-ins by author/licence, yours as "user library"

Types: a category name, a REC map key ('crowd' -> 'applause'), "tag:<words>", or an exact id ("sfx.coin.02",
"user.whoosh.big_whoosh"). The project's choice (project.json "sound": {"effects": "auto" | "library" | "off"}) is
LIB.mode: auto = recordings (yours first) and the style's own synthesized sounds where none fits; library = only YOUR
library (nothing built-in, nothing synthesized); off = no effects at all. The Investigation look defaults to off.
"""
import hashlib, json, os, random, re, subprocess
import numpy as np

B0, B1 = '--- sound effect credits (kept up to date by berat) ---', '--- end of sound effect credits ---'
HERE = os.path.dirname(os.path.abspath(__file__))
BUILTIN = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'lowpoly', 'library', 'sfx'))


def lib_dirs(argv):
    """Every --sfx-lib DIR (in order), then CZ_SFX_LIB (os.pathsep list), then the built-in library next to the templates."""
    out = [argv[i + 1] for i, a in enumerate(argv[:-1]) if a == '--sfx-lib']
    out += [d for d in os.environ.get('CZ_SFX_LIB', '').split(os.pathsep) if d]
    if not out: out = [BUILTIN]
    seen, res = set(), []
    for d in out:
        d = os.path.abspath(d)
        if d not in seen and os.path.exists(os.path.join(d, 'index.json')): seen.add(d); res.append(d)
    return res


def norm(s): return re.sub(r'[^a-z0-9]+', '_', str(s or '').lower()).strip('_')


# the words a downloaded pack may call a kind of sound (folder and file names, matched as word starts: "wooshes" ->
# woosh, "punches_combat" -> punch). Used for YOUR clips only, when none is named exactly like the event: members add
# whole packs ("Wooshes", "Random SFX", "YouTube shorts SFX") whose folder names never were the engine's event types.
ALIASES = {
    'whoosh': ['whoosh', 'woosh', 'swoosh', 'swish', 'swipe', 'transition'], 'swish': ['swish', 'swoosh', 'whoosh', 'woosh', 'swipe'],
    'slide': ['slide', 'swish', 'swoosh', 'woosh', 'whoosh'], 'swipe': ['swipe', 'swish', 'swoosh', 'woosh', 'whoosh'],
    'impact': ['impact', 'hit', 'punch', 'slam', 'boom', 'smash', 'crash', 'thud', 'bonk'], 'hit': ['hit', 'impact', 'punch', 'slam', 'smash'],
    'thud': ['thud', 'thump', 'fall', 'impact', 'hit'], 'punch': ['punch', 'hit', 'impact', 'slap'], 'bonk': ['bonk', 'boing', 'hit'],
    'boom': ['boom', 'drop', 'explosion', 'impact'], 'explosion': ['explosion', 'explode', 'blast', 'boom'],
    'pop': ['pop', 'bubble', 'plop', 'blip'], 'appear': ['pop', 'appear', 'blip', 'sparkle', 'shine'],
    'click': ['click', 'tick', 'mouse', 'button'], 'tick': ['tick', 'click', 'clock'], 'blip': ['blip', 'beep', 'pop', 'click'],
    'beep': ['beep', 'blip', 'notification'], 'ding': ['ding', 'chime', 'bell', 'notification'], 'chime': ['chime', 'ding', 'bell', 'shine', 'sparkle'],
    'notification': ['notification', 'ding', 'chime', 'bell'], 'sparkle': ['sparkle', 'shine', 'star', 'twinkle', 'chime'],
    'grow': ['riser', 'rise', 'swell', 'grow'], 'riser': ['riser', 'rise', 'swell'], 'sting': ['sting', 'riser', 'boom', 'impact'],
    'glitch': ['glitch', 'static', 'distort', 'twitch'], 'camera': ['camera', 'shutter', 'flash', 'photo'], 'flash': ['flash', 'camera', 'shutter'],
    'snap': ['snap', 'shutter', 'camera'], 'coin': ['coin', 'cash', 'money', 'ching'], 'cash': ['cash', 'register', 'money', 'coin', 'ching'],
    'typing': ['typing', 'keyboard', 'typewriter'], 'type': ['typing', 'keyboard', 'typewriter'], 'typewriter': ['typewriter', 'typing', 'keyboard'],
    'paper': ['paper', 'page', 'rustle'], 'door': ['door'], 'footstep': ['footstep', 'step'], 'step': ['footstep', 'step'],
    'splash': ['splash'],'win': ['win', 'success', 'correct', 'tada'], 'lose': ['lose', 'fail', 'wrong', 'error', 'buzzer'],
    'error': ['error', 'wrong', 'buzzer', 'fail'], 'gun': ['gun', 'shot'], 'gunshot': ['gunshot', 'gun', 'shot'],
}


def words_of(e):
    """A clip's words: its category's words and its tags."""
    return [w for w in e['category'].split('_') + e['tags'] if w]


def effects_mode(project):
    """project.json sound.effects; the default is 'off' for the Investigation look (no effects unless you add them), else 'auto'."""
    try: pj = json.load(open(os.path.join(project, 'project.json'), encoding='utf-8'))
    except Exception: return 'auto'
    m = (pj.get('sound') or {}).get('effects')
    if m in ('auto', 'library', 'off'): return m
    return 'off' if (pj.get('settings') or {}).get('theme') == 'investigation' else 'auto'


class Library:
    def __init__(self, project, argv=(), sr=48000):
        self.P, self.sr, self.mode = os.path.abspath(project), sr, effects_mode(project)
        self.dirs, self.entries, self.used, self._cache, self.n_user = lib_dirs(list(argv)), [], {}, {}, 0
        for d in self.dirs:
            try: j = json.load(open(os.path.join(d, 'index.json'), encoding='utf-8'))
            except Exception: continue
            mine = bool(j.get('user'))
            for e in j.get('entries', []):
                if not e.get('file') or not e.get('id'): continue
                self.entries.append({**e, '_dir': d, 'user': mine or bool(e.get('user')), 'category': norm(e.get('category')),
                                     'tags': [norm(t) for t in e.get('tags', []) if t]})
        self.rng = random.Random(int(hashlib.md5(self.P.encode('utf-8')).hexdigest()[:8], 16))   # same project -> same picks

    @property
    def has_user(self): return any(e['user'] for e in self.entries)

    def _pool(self):
        if self.mode == 'off': return []
        return [e for e in self.entries if e['user']] if self.mode == 'library' else self.entries

    def candidates(self, typ, rec=None):
        pool = self._pool()
        if typ.startswith(('sfx.', 'user.')): return [e for e in pool if e['id'] == typ]
        if typ.startswith('tag:'):
            w = [norm(x) for x in typ[4:].split() if x]
            return [e for e in pool if all(any(x in t for t in e['tags'] + [e['category']]) for x in w)]
        want = norm((rec or {}).get(typ, typ))
        def hit(e):
            c = e['category']
            return c in (want, want + 's', want + 'es') or c.rstrip('s') == want or (e['user'] and (want in e['tags'] or norm(typ) in e['tags']))
        c = [e for e in pool if hit(e)]
        mine = [e for e in c if e['user']]
        if not mine:                                                              # your packs name kinds their own way ("Wooshes", "Punches", "Swoosh 03")
            al = [w for k in {norm(typ), want} for w in ALIASES.get(k, [k])]
            mine = [e for e in pool if e['user'] and any(w.startswith(a) for w in words_of(e) for a in al)]
            short = [e for e in mine if 0 < float(e.get('duration') or 0) <= 3]  # (a pack's 8-second "long woosh" is no cut whoosh)
            mine = short or mine
        return mine or c                                                          # your clips win per category

    def pick(self, typ, rec=None, user_only=False):
        c = self.candidates(typ, rec)
        if user_only: c = [e for e in c if e['user']]
        return self.rng.choice(c) if c else None

    def load(self, e):
        if e['id'] not in self._cache:
            r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', os.path.join(e['_dir'], e['file']), '-f', 'f32le', '-ac', '1', '-ar', str(self.sr), '-'],
                               capture_output=True)
            x = np.frombuffer(r.stdout, np.float32).astype(np.float64) if r.returncode == 0 else None
            self._cache[e['id']] = x if x is not None and len(x) else None
        return self._cache[e['id']]

    def recorded(self, typ, d=0, rec=None, user_only=False, jitter=True):
        """A recorded clip for an event type (mono, at sr), cut to d seconds with a fade when the event is timed; None if none fits."""
        e = self.pick(typ, rec, user_only)
        if not e: return None
        x = self.load(e)
        if x is None: return None
        if jitter:                                                                # +-1 semitone, by resampling; +-1.5 dB
            rate = 2 ** (self.rng.uniform(-1, 1) / 12)
            x = np.interp(np.arange(0, len(x) - 1, rate), np.arange(len(x)), x)
        if d and d > .3 and len(x) > d * self.sr:
            n = int(d * self.sr); f = min(n, int(.12 * self.sr)); x = x[:n].copy(); x[-f:] *= np.linspace(1, 0, f)
        self.used[e['id']] = e; self.n_user += 1 if e['user'] else 0
        return x * (10 ** (self.rng.uniform(-1.5, 1.5) / 20) if jitter else 1)

    def write_credits(self):
        """The credits of the recordings used, as their own block in DESCRIPTION.txt (kept up to date on every run)."""
        df = os.path.join(self.P, 'DESCRIPTION.txt')
        prev = ''
        if os.path.exists(df):                                    # (a credits block written through a Windows shell redirect is cp1252: "™" = 0x99)
            raw = open(df, 'rb').read()
            try: prev = raw.decode('utf-8')
            except UnicodeDecodeError: prev = raw.decode('cp1252', errors='replace')
            prev = prev.replace('\r\n', '\n')
        if B0 in prev and B1 in prev: prev = (prev[:prev.index(B0)] + prev[prev.index(B1) + len(B1):]).rstrip() + '\n'
        built = sorted({f"{e.get('author', 'unknown')} ({e.get('licence', '?')}, {e.get('source_url', '')})" for e in self.used.values() if not e['user']})
        mine = sorted({(e.get('credit_text') or (f"{e.get('author')} ({e.get('licence', '')})" if e.get('author') else '') or e.get('name') or e['id']).strip() for e in self.used.values() if e['user']})
        lines = ([f"Sound effects: {'; '.join(built)}"] if built else []) + ([f"Sound effects (user library): {'; '.join(mine)}"] if mine else [])
        if lines: prev = prev.rstrip() + ('\n\n' if prev.strip() else '') + B0 + '\n' + '\n'.join(lines) + '\n' + B1 + '\n'
        if lines or B0 in prev or os.path.exists(df): open(df, 'w', encoding='utf-8').write(prev)
        try:                                                      # what the app's Sound step says afterwards (audio.ts soundSummary)
            json.dump({'mode': self.mode, 'has_user': self.has_user, 'user_placed': self.n_user, 'user_clips': sum(1 for e in self.entries if e['user'])},
                      open(os.path.join(self.P, 'audio', 'sfx_used.json'), 'w', encoding='utf-8'))
        except OSError: pass
        return lines


def place_report(project, placed):
    """audio/sfx_placed.txt: one line per effect ('  12.40s  impact       recorded')."""
    open(os.path.join(project, 'audio', 'sfx_placed.txt'), 'w', encoding='utf-8').write('\n'.join(placed) + ('\n' if placed else ''))


def write_stems(audio_dir, sr, music, sfx, shape=None):
    """audio/sound_music.wav (the beds: music, room tone, ambience) + audio/sound_sfx.wav (the effects) next to sfx_bed.wav,
    for Export > separate audio tracks. music, sfx: (n, 2) float arrays BEFORE the last shared stage; shape(x) is what
    sfx_bed.wav got from x = music + sfx (a limiter, a fixed gain; then clipped to +-1 as sfx_bed.wav is). Both halves get
    the same per-sample gain shape(x) / x, so sound_music + sound_sfx = sfx_bed.wav to the 16-bit step, limiter included.
    Call it AFTER writing sfx_bed.wav: mix.py uses them only when they are as long as sfx_bed.wav and not older."""
    import wave
    n, blk, outs = len(music), sr * 10, []
    for name in ('sound_music.wav', 'sound_sfx.wav'):
        w = wave.open(os.path.join(audio_dir, name), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); outs.append(w)
    for i in range(0, n, blk):
        m, s = np.asarray(music[i:i + blk], np.float64), np.asarray(sfx[i:i + blk], np.float64); x = m + s
        y = np.clip(shape(x) if shape else x, -1, 1)
        k = np.ones_like(x); np.divide(y, x, out=k, where=np.abs(x) > 1e-12)
        for w, part in zip(outs, (m, s)): w.writeframes((np.clip(part * k, -1, 1) * 32767).astype(np.int16).tobytes())
    for w in outs: w.close()

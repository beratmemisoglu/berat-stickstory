#!/usr/bin/env python3
"""Final audio mix: voice untouched + ambience/SFX bed ducked under it, normalised for YouTube.

  python mix.py <project> [--lufs -16] [--no-bed] [--min-ratio 16] [--stems]

Writes audio/final_mix.wav (render.mjs muxes it automatically) and audio/mix_report.json.
Pass criteria (printed): voice-to-bed ratio while speaking >= 16 dB (--min-ratio; tasteful, never competes with the
voice), true peak <= -1.0 dB, integrated loudness within 0.5 LU of the target. If the ratio is too low,
lower the gains in beds.json and re-run sound_design.py - do not touch the voice.
--stems also writes the mix as separate tracks in audio/stems/ (voice.wav, music.wav, sfx.wav; bed.wav for a sound
design made before the split files existed), each ducked exactly as in the mix and at the mix's final gain, so
voice + music + sfx (+ bed) = final_mix.wav.
"""
import argparse, json, math, os, re, subprocess, wave
import numpy as np

ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--lufs', type=float, default=-16.0); ap.add_argument('--no-bed', action='store_true')
ap.add_argument('--bed-duck', type=float, default=3.0)   # sidechain ratio on the bed (low poly shorts: 1.5, the effects stay audible)
ap.add_argument('--tp', type=float, default=-1.5)   # true-peak ceiling (low poly shorts: -2)
ap.add_argument('--bed-gain', type=float, default=0.0)   # dB on the whole bed (music + sfx): Project settings' effects level
# dB more on the bed: the app's own fix when the voice was buried (recorded in the report, so a later re-mix keeps it)
ap.add_argument('--trim', type=float, default=0.0)
# the voice-to-bed ratio the check asks for (default 16 dB). Styles whose effects are meant to be heard pass less: Stick stories'
# references sit 10-13 LU under the voice with music + effects (experiments/stickstory-style/analysis/story NOTES.md 3) -> 12
ap.add_argument('--min-ratio', type=float, default=16.0)
# the user's own music (Project settings > Music; first levelled to -16 LUFS so the dB setting means the same for any track): looped / cut to the video, faded in and out, at their level, ducked under the voice
ap.add_argument('--music'); ap.add_argument('--music-gain', type=float, default=-10.0); ap.add_argument('--duck', type=float, default=8.0)
# audio layers the user placed by hand (Music & effects > Layers): a json the app writes with every clip resolved
# {"clips": [{"file", "start", "in", "len", "loop", "fadeIn", "fadeOut", "gain" (dB, loudness-matched), "pan" -1..1, "duck" dB, "kind" (lane)}]}
ap.add_argument('--layers')
ap.add_argument('--stems', action='store_true')   # also the separate tracks (Export > separate audio tracks)
a = ap.parse_args()
A = os.path.join(os.path.abspath(a.project), 'audio')
clean, bed, pre, out = [os.path.join(A, f) for f in ('clean.wav', 'sfx_bed.wav', 'premix.wav', 'final_mix.wav')]
ff = lambda *args: subprocess.run(['ffmpeg', '-hide_banner', '-y', '-loglevel', 'error', *args], check=True)
music = a.music if a.music and os.path.exists(a.music) else None
bed_gain = a.bed_gain + a.trim
def wav_dur(p): w0 = wave.open(p); d = w0.getnframes() / w0.getframerate(); w0.close(); return d
# ---------- the pieces of the mix, as filter text: the full mix and every separate track use the same ones ----------
def duck_ratio(d): return max(1.0, min(20.0, 1 / max(.05, 1 - min(d, 11.4) / 12)))
# a sidechain stops at whichever input ends first and drops what it still held, a different amount every run: both
# inputs padded with silence, so it never ends by itself (amix duration=first, the voice, ends the mix): the same output
# every time, which the separate tracks need to add up to the mix
def duck_f(src, key, o, r, at, rel):
    return f'[{src}]apad[sm{o}];[{key}]apad[sk{o}];[sm{o}][sk{o}]sidechaincompress=threshold=0.03:ratio={r}:attack={at}:release={rel}:makeup=1[{o}]'
def bed_f(i, key, o):            # the sound design's bed (or one half of it), at the bed gain, ducked under the voice
    return f'[{i}:a]volume={bed_gain}dB[bg{o}];' + duck_f(f'bg{o}', key, o, a.bed_duck, 60, 700)
def music_f(i, key, o, dur):     # the user's own music: levelled, cut to the video, faded, at its level, ducked
    # duck: the voice sits ~12 dB over the -30 dB threshold, so ratio r takes 12*(1-1/r) dB off the music while speaking
    r = duck_ratio(a.duck) if a.duck > 0 else 1.0
    fo = min(2.5, dur / 4)
    return (f'[{i}:a]aformat=channel_layouts=stereo,aresample=48000,loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,afade=t=in:st=0:duration=1.2,'
            f'afade=t=out:st={max(0, dur - fo):.3f}:duration={fo:.3f},volume={a.music_gain if a.music_gain > -40 else -120}dB[mu{o}];'
            + duck_f(f'mu{o}', key, o, f'{r:.2f}', 80, 900))
def layer_f(i, c, vdur):         # one placed clip: trimmed, faded, levelled, panned, delayed to its start (no label)
    st, ln = max(0.0, float(c.get('start', 0))), max(.01, float(c.get('len') or 1))
    ln = min(ln, max(.01, vdur - st))
    fi, fo = min(float(c.get('fadeIn') or 0), ln / 2), min(float(c.get('fadeOut') or 0), ln / 2)
    p = max(-1.0, min(1.0, float(c.get('pan') or 0)))
    gl, gr = math.cos((p + 1) * math.pi / 4) * math.sqrt(2), math.sin((p + 1) * math.pi / 4) * math.sqrt(2)
    ms = int(round(st * 1000))
    return (f'[{i}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=48000,atrim=start={max(0.0, float(c.get("in") or 0)):.4f}:duration={ln:.4f},asetpts=PTS-STARTPTS'
            + (f',afade=t=in:st=0:d={fi:.3f}' if fi > 0 else '') + (f',afade=t=out:st={ln - fo:.4f}:d={fo:.3f}' if fo > 0 else '')
            + f',volume={float(c.get("gain", 0)):.2f}dB,pan=stereo|c0={gl:.4f}*c0|c1={gr:.4f}*c1,adelay={ms}|{ms}')
def layer_duck(i, key, o):
    return duck_f(f'c{i}', key, o, f'{duck_ratio(float(clips[i]["duck"])):.2f}', 80, 900)

if music:
    dur = wav_dur(clean)
    has_bed = not a.no_bed and os.path.exists(bed)
    g = (f'[0:a]aformat=channel_layouts=stereo,asplit={3 if has_bed else 2}[v][k1]{"[k2]" if has_bed else ""};'
         + music_f(2 if has_bed else 1, 'k1', 'mud', dur) + ';')
    if has_bed:
        g += bed_f(1, 'k2', 'duck') + ';[v][duck][mud]amix=inputs=3:normalize=0:duration=first[out]'
        ins = ['-i', clean, '-i', bed, '-stream_loop', '-1', '-i', music]
    else:
        g += '[v][mud]amix=inputs=2:normalize=0:duration=first[out]'; ins = ['-i', clean, '-stream_loop', '-1', '-i', music]
    ff(*ins, '-filter_complex', g, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', pre)
    print(f'your music: {os.path.basename(music)} at {a.music_gain} dB, ducked about {a.duck} dB under the voice')
elif a.no_bed or not os.path.exists(bed):
    ff('-i', clean, '-af', 'aformat=channel_layouts=stereo', '-ar', '48000', '-c:a', 'pcm_s16le', pre)
else:
    ff('-i', clean, '-i', bed, '-filter_complex',
       '[0:a]aformat=channel_layouts=stereo,asplit=2[v][key];' + bed_f(1, 'key', 'duck') + ';'
       '[v][duck]amix=inputs=2:normalize=0:duration=first[out]', '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', pre)
# ---------- the user's audio layers: each clip trimmed, faded, levelled, panned, delayed to its start (sample exact) and
# ducked under the voice by its own amount (the same sidechain as the music), summed onto the premix ----------
clips = []
if a.layers and os.path.exists(a.layers):
    try: clips = [c for c in json.load(open(a.layers, encoding='utf-8')).get('clips', []) if os.path.exists(c.get('file', ''))]
    except Exception as ex: print('audio layers: could not read', a.layers, ex)
laid = pre
if clips:
    vdur = wav_dur(clean)
    ins, g, keys = ['-i', pre, '-i', clean], [], [i for i, c in enumerate(clips) if (c.get('duck') or 0) > 0]
    for c in clips: ins += (['-stream_loop', '-1'] if c.get('loop') else []) + ['-i', c['file']]
    if keys: g.append('[1:a]aformat=channel_layouts=stereo,' + (f'asplit={len(keys)}' + ''.join(f'[k{i}]' for i in keys) if len(keys) > 1 else f'anull[k{keys[0]}]'))
    for i, c in enumerate(clips):
        f = layer_f(i + 2, c, vdur)
        if i in keys: g.append(f + f'[c{i}];' + layer_duck(i, f'k{i}', f'l{i}'))
        else: g.append(f + f'[l{i}]')
    g.append('[0:a]' + ''.join(f'[l{i}]' for i in range(len(clips))) + f'amix=inputs={len(clips) + 1}:normalize=0:duration=first[out]')
    laid = os.path.join(A, 'premix_layers.wav')
    ff(*ins, '-filter_complex', ';'.join(g), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', laid)
    for c in clips: print(f"layer {os.path.basename(c['file'])}: {c.get('start', 0):.3f}s for {c.get('len', 0):.2f}s at {c.get('gain', 0):+.1f} dB" + (', looped' if c.get('loop') else '') + (f", ducks {c['duck']} dB" if c.get('duck') else ''))
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', laid, '-af', f'loudnorm=I={a.lufs}:TP={a.tp}:LRA=11:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True)
m = json.loads(re.search(r'\{[^{}]*\}', r.stderr[r.stderr.rfind('{') - 1:], re.S).group(0))
ff('-i', laid, '-af', f"loudnorm=I={a.lufs}:TP={a.tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
   f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", '-ar', '48000', '-c:a', 'pcm_s16le', out)
e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)[-1])

def load(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x.reshape(-1, w.getnchannels()), w.getframerate()
ratio = None
if music or (not a.no_bed and os.path.exists(bed)):
    mx, sr = load(pre); v, _ = load(clean); v = v[:, 0] * .7071
    n = min(len(mx), len(v)); part = mx[:n, 0] - v[:n]
    sp = np.zeros(n, bool)
    for p in json.load(open(os.path.join(A, 'timeline.json'), encoding='utf-8')): sp[int(p['s'] * sr):int(p['e'] * sr)] = True
    rms = lambda z: 20 * np.log10(np.sqrt(np.mean(z ** 2)) + 1e-9)
    ratio = round(float(rms(v[:n][sp]) - rms(part[sp])), 1)
    del mx, v, part, sp

# ---------- the separate tracks (--stems): voice, music (the beds + your music + Music/Ambience layers), sound effects
# (the effects + every other layer), each through the same filters as the mix, then the loudness step's own gain.
# loudnorm is one fixed gain when it can stay linear, but a quiet-to-loud voice with high peaks sends it to its dynamic
# mode (a slowly moving gain + a peak limiter, the same for both channels): so the gain is MEASURED, final_mix over the
# premix every 2 ms (least squares over both channels, quiet stretches pulled to the overall gain), and every track gets
# that same gain curve. voice + music + sfx then = final_mix.wav (about -50 dB of difference or better). ----------
W = 96                                                                    # 2 ms windows at 48 kHz
# loudnorm's dynamic mode runs at 192 kHz (ffmpeg resamples into it and back out): that round trip softens the top of
# the spectrum a little (bright noise -20 dB apart without it), so the tracks make the same trip. Its linear mode
# (the same test loudnorm makes) stays at 48 kHz.
lin_mode = float(m['input_tp']) != 99 and float(m['input_thresh']) != -70 and float(m['input_tp']) + a.lufs - float(m['input_i']) <= a.tp
RS = '' if lin_mode else ',aresample=192000,aresample=48000'
def gain_curve():
    src = laid
    if RS: src = os.path.join(A, 'premix_rs.wav'); ff('-i', laid, '-af', RS[1:], '-ar', '48000', '-c:a', 'pcm_s16le', src)
    wa, wb = wave.open(src), wave.open(out); nums, dens, bbs = [], [], []
    while True:
        xa, xb = wa.readframes(W * 5000), wb.readframes(W * 5000)
        if not xa or not xb: break
        pa, pb = np.frombuffer(xa, np.int16).astype(np.float64), np.frombuffer(xb, np.int16).astype(np.float64)
        k = min(len(pa), len(pb)); k2 = -(-k // (2 * W)) * 2 * W
        pa, pb = np.pad(pa[:k], (0, k2 - k)).reshape(-1, 2 * W), np.pad(pb[:k], (0, k2 - k)).reshape(-1, 2 * W)
        nums.append(np.einsum('ij,ij->i', pa, pb)); dens.append(np.einsum('ij,ij->i', pa, pa)); bbs.append(np.einsum('ij,ij->i', pb, pb))
    wa.close(); wb.close()
    if src != laid: os.remove(src)
    if not nums: return np.ones(1), None, 1.0
    num, den, bb = np.concatenate(nums), np.concatenate(dens), np.concatenate(bbs)
    G0 = float(num.sum() / den.sum()) if den.sum() > 0 else 1.0
    lam = 2 * W * (32768 * 1e-4) ** 2                                     # -80 dBFS: below it a window keeps the overall gain
    g = (num + lam * G0) / (den + lam)
    res = float(np.sum(bb - 2 * g * num + g * g * den))
    return g, (round(10 * math.log10(max(res, 1e-9) / float(bb.sum())), 1) if bb.sum() > 0 else None), G0
def stems():
    D = os.path.join(A, 'stems'); os.makedirs(D, exist_ok=True)
    for f in ('voice.wav', 'music.wav', 'sfx.wav', 'bed.wav'):
        try: os.remove(os.path.join(D, f))
        except FileNotFoundError: pass
    g, match, G0 = gain_curve(); centers = np.arange(len(g)) * W + W / 2
    raw = os.path.join(D, 'track.f32')
    def finish(name):                                                     # the raw track x the gain curve -> 24-bit 48 kHz WAV
        w = wave.open(os.path.join(D, name), 'wb'); w.setnchannels(2); w.setsampwidth(3); w.setframerate(48000)
        with open(raw, 'rb') as fh:
            i = 0
            while True:
                x = np.fromfile(fh, np.float32, count=2 * 480000)
                if not x.size: break
                x = x.reshape(-1, 2).astype(np.float64); env = np.interp(np.arange(i, i + len(x)), centers, g); i += len(x)
                y = np.round(np.clip(x * env[:, None], -1, 1 - 2 ** -23) * 8388608).astype('<i4')
                w.writeframes(y.view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
        w.close(); os.remove(raw)
    vdur = wav_dur(clean); has_bed = not a.no_bed and os.path.exists(bed)
    # the sound design's two halves (sound_design.py writes them right after sfx_bed.wav): only when they belong to this bed
    halves = [os.path.join(A, f) for f in ('sound_music.wav', 'sound_sfx.wav')]
    def belongs(p):
        try:
            if os.path.getmtime(p) < os.path.getmtime(bed) - 1: return False
            w1, w2 = wave.open(p), wave.open(bed); ok = w1.getnframes() == w2.getnframes() and w1.getframerate() == w2.getframerate(); w1.close(); w2.close(); return ok
        except Exception: return False
    split = has_bed and all(belongs(p) for p in halves)
    musical = lambda c: c.get('kind') in ('music', 'ambience')
    tracks = {'music': ([('bed', halves[0])] if split else []) + ([('music', music)] if music else []) + [('layer', i) for i, c in enumerate(clips) if musical(c)],
              'sfx': ([('bed', halves[1])] if split else []) + [('layer', i) for i, c in enumerate(clips) if not musical(c)],
              'bed': [('bed', bed)] if has_bed and not split else []}
    f32 = ['-ar', '48000', '-ac', '2', '-f', 'f32le', raw]
    ff('-i', clean, '-af', 'aformat=channel_layouts=stereo' + RS, *f32); finish('voice.wav')
    made = ['voice.wav']
    for name, parts in tracks.items():
        if not parts and not (split and name in ('music', 'sfx')): continue
        ins, fg, labels = ['-i', clean], [], []
        ducked = [j for j, (kind, x) in enumerate(parts) if kind != 'layer' or (clips[x].get('duck') or 0) > 0]
        fg.append(f'[0:a]aformat=channel_layouts=stereo,asplit={len(ducked) + 1}[z0]' + ''.join(f'[k{j}]' for j in ducked) + ';[z0]volume=0[z]')
        for j, (kind, x) in enumerate(parts):
            ii = ins.count('-i')                                         # this part's input index
            if kind == 'bed': ins += ['-i', x]; fg.append(bed_f(ii, f'k{j}', f'p{j}'))
            elif kind == 'music': ins += ['-stream_loop', '-1', '-i', x]; fg.append(music_f(ii, f'k{j}', f'p{j}', vdur))
            else:
                c = clips[x]; ins += (['-stream_loop', '-1'] if c.get('loop') else []) + ['-i', c['file']]
                fg.append(layer_f(ii, c, vdur) + (f'[c{x}];' + layer_duck(x, f'k{j}', f'p{j}') if j in ducked else f'[p{j}]'))
            labels.append(f'[p{j}]')
        # (the silent voice first: the track lasts exactly as long as the voice, as the mix does)
        fg.append('[z]' + ''.join(labels) + f'amix=inputs={len(labels) + 1}:normalize=0:duration=first{RS}[out]')
        ff(*ins, '-filter_complex', ';'.join(fg), '-map', '[out]', *f32); finish(f'{name}.wav')
        made.append(f'{name}.wav')
    lin = bool(lin_mode)
    print(f"separate tracks: {', '.join(made)} in audio/stems (loudness gain {20 * math.log10(max(G0, 1e-9)):+.2f} dB, {'fixed' if lin else 'moving: the loudness step limited peaks'}"
          + (f'; the gain curve explains the mix to {match} dB)' if match is not None else ')'))
    return {'files': made, 'split': split, 'gain_db': round(20 * math.log10(max(G0, 1e-9)), 3), 'fixed_gain': lin, 'match_db': match}
stem_rep = stems() if a.stems else None

rep = {'bed_gain_db': bed_gain, **({'bed_trim_db': a.trim} if a.trim else {}), **({'music': os.path.basename(music), 'music_gain_db': a.music_gain, 'duck_db': a.duck} if music else {}),'integrated_lufs': float(I), 'true_peak_dbfs': float(TP), 'voice_to_bed_db_while_speaking': ratio,
       **({'layers': [{'file': os.path.basename(c['file']), 'start': round(float(c.get('start', 0)), 3), 'len': round(float(c.get('len') or 0), 3), 'gain_db': c.get('gain', 0)} for c in clips]} if clips else {}),
       **({'stems': stem_rep} if stem_rep else {}),
       'min_ratio_db': a.min_ratio, 'pass': bool((ratio is None or ratio >= a.min_ratio) and TP <= a.tp + .5 and abs(I - a.lufs) <= .5)}
json.dump(rep, open(os.path.join(A, 'mix_report.json'), 'w'), indent=1); os.remove(pre)
if laid != pre: os.remove(laid)
print(json.dumps(rep, indent=1))

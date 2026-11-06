"""The built-in sound-effects library, synthesized (no samples, no licences): whooshes, clicks, blips, pops, risers,
soft impacts. Deterministic (fixed seeds), 48 kHz stereo 16-bit, each normalized to -3 dBFS.
    python make_sfx.py OUTDIR
Writes OUTDIR/<name>.wav and OUTDIR/lib.json = {name: {dur, peak, centroid, kind, desc}}. `peak` is the time (s) of
the loudest moment: sfx_mix.py aligns whooshes by it. sfx_mix.py runs this by itself when the library is missing."""
import json, os, sys, wave
import numpy as np

SR = 48000
LIB = {}


def rng(seed): return np.random.default_rng(seed)


def shaped(n, peak, a=2.0, r=2.4):
    """Amplitude envelope 0..1..0 with its maximum at sample `peak` (rise curve a, fall curve r)."""
    t = np.arange(n, dtype=np.float64); e = np.zeros(n)
    p = max(1, min(n - 2, int(peak)))
    e[:p] = (t[:p] / p) ** a
    e[p:] = ((n - 1 - t[p:]) / (n - 1 - p)) ** r
    return e


def band_noise(n, fc, bw, seed, tilt=0.0, N=4096):
    """Stereo noise whose spectrum is a moving band: fc / bw are per-frame arrays (Hz). Overlap-add of random-phase
    frames, so the band glides smoothly (the doppler sweep of a whoosh). tilt > 0 adds air above the band."""
    hop = N // 4
    frames = n // hop + 5
    f = np.fft.rfftfreq(N, 1 / SR)
    win = np.hanning(N)
    out = np.zeros((frames * hop + N, 2))
    R = rng(seed)
    idx = np.linspace(0, len(fc) - 1, frames)
    fcs, bws = np.interp(idx, np.arange(len(fc)), fc), np.interp(idx, np.arange(len(bw)), bw)
    for k in range(frames):
        mag = np.exp(-0.5 * ((f - fcs[k]) / max(12.0, bws[k])) ** 2)
        if tilt: mag += tilt * np.clip((f - fcs[k]) / 4000, 0, 1) * np.exp(-f / 6000)
        for c in (0, 1):
            ph = R.uniform(0, 2 * np.pi, len(f))
            out[k * hop:k * hop + N, c] += np.fft.irfft(mag * np.exp(1j * ph), N) * win
    out = out[N // 2:N // 2 + n]
    return out / (np.sqrt((out ** 2).mean()) + 1e-9)          # unit RMS: layer gains below are power ratios


def room(x, amount=0.12, decay=0.18, seed=7):
    """A small, soft room: stereo-decorrelated exponential noise tail, FFT-convolved."""
    L = int(decay * SR)
    R = rng(seed)
    t = np.arange(L) / SR
    ir = R.standard_normal((L, 2)) * np.exp(-t / (decay / 5))[:, None]
    ir[:int(0.004 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(0))
    n = len(x) + L
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], n * 2) * np.fft.rfft(ir[:, c], n * 2), n * 2)[:n] for c in (0, 1)], 1)
    dry = np.vstack([x, np.zeros((L, 2))])
    return dry + amount * wet


def tone(freq, dur, decay, partials=((1, 1.0),), attack=0.002, bend=0.0):
    """A struck tone: partials (ratio, gain), exponential decay (s), optional pitch bend (octaves over the note)."""
    n = int(dur * SR); t = np.arange(n) / SR
    f = freq * 2 ** (bend * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(g * np.sin(r * ph) * np.exp(-t / (decay / (1 + 0.6 * (r - 1)))) for r, g in partials)
    a = int(attack * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    return x


def mono2(x, width=0.0, seed=3):
    """Mono to stereo; width > 0 adds a few samples of decorrelation."""
    d = int(width * 0.0006 * SR)
    l = x.copy(); r = np.concatenate([np.zeros(d), x[:len(x) - d]]) if d else x.copy()
    return np.stack([l, r], 1)


def pad(x, before=0.0, after=0.0):
    return np.vstack([np.zeros((int(before * SR), 2)), x, np.zeros((int(after * SR), 2))])


def put(name, x, kind, desc):
    x = np.asarray(x, np.float64)
    try:                                                   # 18 Hz high-pass: no DC, no inaudible sub rumble
        from scipy.signal import butter, sosfilt
        x = sosfilt(butter(2, 18, 'hp', fs=SR, output='sos'), x, axis=0)
    except ImportError:
        pass
    fade = int(0.004 * SR); x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    x *= 10 ** (-3 / 20) / (np.abs(x).max() + 1e-12)
    env = np.convolve(np.abs(x).max(1), np.ones(240) / 240, 'same')
    mono = x.mean(1); spec = np.abs(np.fft.rfft(mono)); fr = np.fft.rfftfreq(len(mono), 1 / SR)
    LIB[name] = {'dur': round(len(x) / SR, 3), 'peak': round(int(env.argmax()) / SR, 3),
                 'centroid': int((spec * fr).sum() / (spec.sum() + 1e-9)), 'kind': kind, 'desc': desc}
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


# ── whooshes: layered noise bands that glide up into the peak and back down (doppler), louder at the peak. Like
# designed library whooshes, most of the energy is a low "air push"; the audible air rides 15-35 dB under it. ──
def whoosh(name, dur, peak, layers, seed, desc, a=2.2, r=2.6, sweep_pan=0.0):
    """layers: (f_start, f_peak, bandwidth, gain_db): each band glides f_start -> f_peak -> f_start."""
    n = int(dur * SR); p = int(peak * SR)
    k = np.linspace(0, 1, 256); pk = peak / dur
    shape = np.where(k < pk, (k / pk) ** 1.4, ((1 - k) / (1 - pk)) ** 1.1)
    x = np.zeros((n, 2))
    for i, (f0, f1, bw, db) in enumerate(layers):
        x += 10 ** (db / 20) * band_noise(n, f0 + (f1 - f0) * shape, bw * (0.6 + 0.4 * shape), seed + 7 * i, 0.08 if f1 > 1000 else 0.0)
    x *= shaped(n, p, a, r)[:, None]
    if sweep_pan:                                       # travels across the stereo field (left to right)
        pos = np.linspace(-sweep_pan, sweep_pan, n)
        x = x * np.stack([np.cos((pos + 1) * np.pi / 4), np.sin((pos + 1) * np.pi / 4)], 1) * np.sqrt(2)
    put(name, room(x, 0.08, 0.25, seed), 'whoosh', desc)


def thump(f, dur, decay, gain):
    """A short low sine thump under a UI sound: the weight the ear reads as "it landed"."""
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(f * 2 ** (-0.8 * t / max(dur, 1e-3))) / SR) * np.exp(-t / decay)
    a = int(0.001 * SR); x[:a] *= np.linspace(0, 1, a)
    return gain * x


def click(name, freq, decay, body, seed, desc, noise=0.25, dur=0.12, body_f=70.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = tone(freq, dur, decay, ((1, 1.0), (1.51, 0.35), (2.23, 0.15)), attack=0.0004)
    x += thump(body_f, dur, 0.018, body)
    nb = rng(seed).standard_normal(n) * np.exp(-t / 0.0012) * noise
    x += np.convolve(nb, np.ones(3) / 3, 'same')
    put(name, room(mono2(x, 1, seed), 0.1, 0.12, seed), 'click', desc)


def two(notes, gap, decay, partials, name, kind, desc, width=1.0, bend=0.0, amp=(1.0, 0.85), body=0.5, body_f=85.0):
    parts = []
    for i, f in enumerate(notes):
        x = tone(f, gap * (len(notes) - i) + decay * 4, decay, partials, attack=0.003, bend=bend) * amp[min(i, len(amp) - 1)]
        parts.append(np.concatenate([np.zeros(int(gap * i * SR)), x]))
    L = max(len(p) for p in parts)
    x = sum(np.pad(p, (0, L - len(p))) for p in parts)
    x[:int(0.25 * SR)] += thump(body_f, 0.25, 0.03, body)[:min(L, int(0.25 * SR))]
    put(name, room(mono2(x, width), 0.14, 0.3), kind, desc)


def build():
    # whooshes (placed by their PEAK)
    whoosh('whoosh_soft', 0.92, 0.21, ((38, 70, 18, 0), (110, 240, 70, -17), (450, 1600, 600, -30)), 11, 'soft, rounded; cards entering or leaving (the default)')
    whoosh('whoosh_soft_2', 0.89, 0.30, ((45, 85, 20, 0), (140, 320, 90, -14), (700, 2600, 900, -27)), 12, 'soft, a little brighter; the second of a pair')
    whoosh('whoosh_air', 0.73, 0.15, ((95, 150, 40, 0), (280, 850, 320, -12), (1100, 3600, 1300, -17)), 13, 'airy and quick; small cards, chips, panels')
    whoosh('whoosh_air_short', 0.54, 0.19, ((100, 160, 45, 0), (320, 950, 360, -11), (1300, 4200, 1500, -15)), 14, 'short airy flick; small moves, exits')
    whoosh('whoosh_fast', 0.62, 0.20, ((40, 75, 20, 0), (140, 300, 90, -9), (650, 2400, 900, -25)), 15, 'fast swipe; quick slides, one element replacing another', a=1.6, r=3.0)
    whoosh('whoosh_low', 0.50, 0.10, ((45, 70, 18, -3), (90, 260, 90, 0), (380, 900, 280, -10), (1400, 3200, 1100, -22)), 16, 'low, weighty; collapses, things closing up or dropping')
    whoosh('whoosh_low_2', 0.54, 0.20, ((40, 64, 16, 0), (80, 220, 80, -2), (330, 800, 260, -12), (1200, 2800, 1000, -24)), 17, 'low and round; bars draining, big shapes moving')
    whoosh('whoosh_designed', 0.41, 0.18, ((45, 80, 22, -4), (120, 300, 110, 0), (600, 1400, 450, -1), (1500, 4000, 1400, -5)), 18, 'full, designed; lines drawing across, scans, waveforms')
    whoosh('whoosh_pass', 1.30, 0.62, ((40, 72, 18, 0), (150, 330, 100, -12), (600, 2600, 1000, -24)), 19, 'passes left to right; one continuous move across the frame', sweep_pan=0.7)
    whoosh('sweep_long', 2.30, 0.76, ((32, 58, 14, 0), (110, 260, 80, -18), (500, 1800, 700, -30)), 20, 'long quiet sweep; slow reveals, a scan over several seconds', a=1.8, r=1.6)
    whoosh('wind', 1.33, 0.20, ((40, 70, 22, 0), (110, 220, 90, -9), (1300, 2500, 1100, -21), (3000, 5000, 1800, -24)), 21, 'breathy; bars growing, soft build', a=1.2, r=1.2)
    # riser: builds to the end (peak near the end: align by peak on the hit)
    n = int(1.6 * SR); k = np.linspace(0, 1, 256)
    x = band_noise(n, 60 + 90 * k, 25 + 20 * k, 22) + 10 ** (-14 / 20) * band_noise(n, 300 + 4200 * k ** 2, 200 + 1500 * k, 23)
    x *= (np.linspace(0, 1, n) ** 2.6)[:, None]
    x[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))[:, None]
    put('riser', room(x, 0.1, 0.3), 'whoosh', 'rising build; lands on a big reveal (align its peak on the hit)')

    # clicks and taps (placed by their ONSET)
    click('click_soft', 1050, 0.007, 1.3, 31, 'soft UI click; a card or chip landing (the default click)')
    click('click_bright', 5200, 0.003, 0.35, 32, 'crisp, brighter click; small elements, list rows')
    click('click_tick', 9000, 0.0016, 0.05, 33, 'tiny tick; counters, cut marks, repeated series', noise=0.35, dur=0.07)
    click('click_wood', 900, 0.012, 1.1, 34, 'rounded, woody tap; buttons, toggles')
    x = np.concatenate([tone(640, 0.07, 0.012, ((1, 1), (2, 0.3)), 0.001), np.zeros(int(0.018 * SR)), tone(470, 0.12, 0.018, ((1, 1), (2, 0.3)), 0.001)])
    x[:int(0.2 * SR)] += thump(62, 0.2, 0.03, 1.2)
    put('click_negative', room(mono2(x, 1), 0.12, 0.2), 'click', 'two falling taps; something turns red, is removed or rejected')
    for i, (gap, f) in enumerate(((0.065, 2600), (0.085, 1900), (0.11, 3200)), 1):
        c1 = tone(f, 0.08, 0.006, ((1, 1), (1.5, 0.3)), 0.0004); c2 = tone(f * 1.12, 0.1, 0.007, ((1, 1), (1.5, 0.3)), 0.0004)
        x = np.concatenate([c1[:int(gap * SR)], np.zeros(max(0, int(gap * SR) - len(c1))), c2])
        x[:int(0.12 * SR)] += thump(90, 0.12, 0.02, 0.8)
        put(f'double_tap_{i}', room(mono2(x, 1), 0.1, 0.15), 'click', 'double tap; selections, a state flipping' + (' (fast)' if i == 1 else ' (slower)' if i == 2 else ' (bright)'))

    # blips and notifications (placed by their ONSET)
    bell = ((1, 1.0), (2.0, 0.28), (3.0, 0.08))
    glass = ((1, 1.0), (2.76, 0.32), (5.40, 0.1))
    two([1318.5, 1975.5], 0.075, 0.09, bell, 'confirm', 'blip', 'two rising notes; a send / confirm / success button')
    two([1760.0], 0.0, 0.12, glass, 'blip_select', 'blip', 'single glassy blip; a chip or tag appears')
    two([1568.0, 2093.0], 0.06, 0.1, glass, 'blip_up', 'blip', 'quick rising blip; something added, unlocked, a number going up')
    two([2093.0, 1568.0], 0.06, 0.1, glass, 'blip_down', 'blip', 'quick falling blip; something removed, a number going down')
    two([1046.5, 1318.5, 1568.0], 0.07, 0.16, bell, 'notify', 'blip', 'three-note notification; a result, a check mark, "done"', amp=(0.8, 0.85, 1.0))
    two([987.8, 1480.0], 0.11, 0.22, glass, 'notify_soft', 'blip', 'soft two-note chime; a gentle highlight, a quote card')
    two([2637.0], 0.0, 0.05, ((1, 1.0), (2.0, 0.2)), 'blip_tiny', 'blip', 'very small blip; tiny badges, a dot lighting up', body=0.15)
    # pop: fast pitch drop
    x = tone(900, 0.09, 0.03, ((1, 1.0), (2, 0.15)), 0.0006, bend=-1.6)
    put('pop', room(mono2(x, 1), 0.08, 0.12), 'blip', 'bubble pop; a bubble, a badge or a number popping in')

    # impacts (placed by ONSET): soft, never a cinematic boom
    n = int(0.9 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(58 * 2 ** (-1.2 * t)) / SR) * np.exp(-t / 0.22)
    x += rng(41).standard_normal(n) * np.exp(-t / 0.012) * 0.25
    put('impact_soft', room(mono2(x, 1), 0.12, 0.5), 'impact', 'soft low thud; a big stat or title landing (use sparingly)')
    n = int(1.2 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(90 * 2 ** (-2.5 * t)) / SR) * np.exp(-t / 0.35)
    put('sub_drop', room(mono2(x, 0), 0.05, 0.4), 'impact', 'sub drop; the one big moment of an intro (at most once)')
    # shimmer: bright cluster fading in and out (align by peak)
    n = int(1.4 * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t + i) * (0.6 + 0.4 * np.sin(2 * np.pi * (5 + i) * t)) for i, f in enumerate((2637, 3136, 3951, 5274)))
    x = mono2(x * shaped(n, int(0.45 * SR), 1.5, 2.0), 2)
    put('shimmer', room(x, 0.25, 0.6), 'whoosh', 'bright shimmer; a reveal, something "magic" appearing (align by peak)')


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    OUT = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    build()
    json.dump(LIB, open(os.path.join(OUT, 'lib.json'), 'w'), indent=1)
    print(f'{len(LIB)} sounds -> {OUT}')

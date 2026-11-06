# sfx_mix.py — builds the SFX-only stem for the cuts intro, keyed to the exact animation times in build.py.
# Whooshes are placed by their PEAK (aligned to the fastest moment of the move they carry);
# clicks / notifications by their ONSET (aligned to the landing frame). Panned toward the card that moves.
import json, wave, numpy as np

NS = {}
exec(open('build.py', encoding='utf-8').read(), NS)          # reuses every timing variable of the edit
T = NS['T']; g = NS
SR = 48000; DUR = 75.4333
LIB = json.load(open('sfx/lib/lib.json'))
out = np.zeros((int(DUR * SR) + SR, 2), np.float32)
CUES = []

def load(name, rate=1.0):
    with wave.open(f'sfx/lib/{name}.wav') as f:
        x = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768
    if rate != 1.0:                                               # varispeed: pitch + length, for variety
        idx = np.arange(0, len(x) - 1, rate)
        x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in (0, 1)], 1)
    return x

def cue(name, t, align='onset', db=-24, pan=0.0, rate=1.0, why=''):
    x = load(name, rate)
    off = LIB[name]['peak'] / rate if align == 'peak' else 0.0
    start = t - off
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)   # equal-power pan
    x = x * (10 ** (db / 20)) * np.array([gl, gr]) * np.sqrt(2)
    i = int(round(start * SR))
    if i < 0: x = x[-i:]; i = 0
    out[i:i + len(x)] += x[:len(out) - i]
    CUES.append((round(start, 3), round(t, 3), name, align, db, pan, why))

L, R, C = -0.35, 0.35, 0.0

# ── A · editor panel (0–15 s) ──
cue('softs_1', g['tRaw'] - 0.14, 'peak', -24, C, why='panel rises in')
cue('air_designed', g['tRaw'] + 0.6, 'peak', -31, C, why='waveform draws across')
cue('click_a', g['t51'] - 0.08, 'onset', -21, 0.3, why='51:00 lands')
cue('dbl_3', T('down', 2.9), 'onset', -25, C, why='cut sections turn red')
cue('mids_1', g['t27'] + 0.475, 'peak', -21, C, why='cuts collapse, strip closes up')
for k, (t, s) in enumerate(((g['tBad'], 'click_a'), (g['tRes'], 'click_b'), (g['tDemo'], 'click_c'))):
    cue(s, t - 0.08, 'onset', -26, [-0.15, 0, 0.15][k], why=f'removed chip {k+1}')
cue('softs_2', g['tKept'] + 0.15, 'peak', -23, C, why='waveform lifts out, two tracks slide in')
t0c, t1c = T('through', 12.4), g['t500'] + 0.35
for k in range(16):                                            # every 4th of the 64 cut marks ticks
    t = t0c + (t1c - t0c) * (4 * k) / 64
    cue(['click_c', 'click_b'][k % 2], t, 'onset', -31 + k * 0.4, -0.5 + k / 15, rate=1 + 0.03 * (k % 3), why='cut marks land on both tracks')
cue('notif_04', g['t500'] + 0.02, 'onset', -22, 0.3, why='"500 cuts"')
cue('airy_2', 14.85, 'peak', -22, 0.2, why='panel drops out, prompt card enters right')

# ── B · prompt card ──
cue('confirm_menu', g['tPr'], 'onset', -20, R, why='send button lights')
cue('notif_18', g['tOp'] - 0.33, 'onset', -24, R, why='chip: Claude Opus 5.5')
cue('notif_24', g['tLow'] - 0.1, 'onset', -22, R, why='chip: Effort · Low')
cue('airy_3', g['tBEnd'] + 0.38, 'peak', -26, R, why='card exits right')

# ── C · existing tools (left) ──
cue('softs_1', T('okay', 24.3) - 0.12, 'peak', -26, L, why='card enters left')
cue('click_back', g['tC'] - 0.15, 'onset', -24, L, why='silences turn red')
cue('mids_2', g['tC'] + 1.0, 'peak', -25, L, why='silences collapse')
cue('click_back', g['tCb'] - 0.15, 'onset', -24, L, rate=1.05, why='bad take turns red')
cue('mids_1', g['tCb'] + 0.95, 'peak', -25, L, rate=0.96, why='bad take collapses')
cue('click_a', g['tGl'] - 0.08, 'onset', -26, L, why='chip: Gling AI')

# ── D · cost card (right) ──
cue('whooshs', 30.75, 'peak', -24, 0.0, why='left card out → right card in (one continuous move)')
cue('wind', T('depending') + 0.05, 'onset', -29, R, why='length + cost bars grow')
cue('click_c', g['tWith'] - 0.3, 'onset', -28, R, why='header swaps to "This skill"')
cue('notif_18', g['tRuns'] - 0.08, 'onset', -24, R, why='chip: Runs in Claude Code')
cue('notif_17', g['tSub'], 'onset', -24, R, why='green check on "subscription"')
cue('mids_2', g['tAdd'] + 0.3, 'peak', -24, R, why='cost bar drains to zero')
cue('notif_04', g['tAdd'] + 0.3, 'onset', -21, R, rate=0.94, why='$0 pops')
cue('softs_2', 42.0, 'peak', -25, 0.0, why='right card out → transcript in left')

# ── E · transcript (left) ──
cue('dbl_1', g['tRd'] - 0.2, 'onset', -27, L, why='lines fan in')
cue('classic_airy', (g['tRd'] + g['tKeep'] - 0.3) / 2, 'peak', -31, L, why='scan line sweeps the transcript')
cue('confirm_menu', g['tKeep'] - 0.1, 'onset', -22, L, why='kept lines light up')
cue('click_back', g['tRid'] - 0.12, 'onset', -23, L, why='the rest turn red')
cue('mids_1', g['tRid'] + 0.35, 'peak', -25, L, why='removed lines fall, kept ones close up')
cue('softs_1', g['tEEnd'] + 0.4, 'peak', -26, L, why='card exits left')

# ── F · self-check loop (right) ──
cue('airy_2', g['tLoop'] - 0.33, 'peak', -24, R, why='loop card enters')
cue('notif_18', g['tChk'], 'onset', -24, R, why='node: Check')
cue('airy_3', g['tMul'] + 0.175, 'peak', -26, R, why='orb laps the ring (pass 2)')
cue('click_c', g['tMul'] + 0.3, 'onset', -28, R, why='Pass 2')
cue('airy_3', g['tMul'] + 0.775, 'peak', -26, R, rate=1.08, why='orb laps again (pass 3)')
cue('click_c', g['tMul'] + 0.9, 'onset', -27, R, rate=1.05, why='Pass 3')
cue('notif_24', g['tFind'], 'onset', -24, R, why='node: Find')
cue('notif_18', g['tFix'], 'onset', -24, R, rate=1.06, why='node: Fix')
cue('airy_4', g['tFinal'] - 0.2, 'peak', -26, R, why='final lap')
cue('notif_17', g['tFinal'] - 0.05, 'onset', -20, R, why='green check: Final')
cue('softs_2', g['tFEnd'] + 0.4, 'peak', -27, R, why='card exits right')

# ── G · raw / edit frames ──
cue('airy_1', g['tRw'] - 0.3, 'onset', -28, -0.15, why='"Raw footage" frame rises')
cue('airy_1', g['tEd'] - 0.3, 'onset', -28, 0.15, rate=1.1, why='"Claude\'s edit" frame rises')
cue('softs_1', g['tGEnd'] + 0.4, 'peak', -28, C, why='frames drop out')

# ── H · one section 0:50 → 0:10 (right) ──
cue('airy_2', g['tSec'] - 0.33, 'peak', -25, R, why='card enters')
cue('air_designed', g['t50'] + 0.3, 'peak', -30, R, why='waveform draws, counter to 0:50')
cue('dbl_3', g['tCutd'] - 0.2, 'onset', -24, R, why='80% turns red')
cue('mids_1', g['t10'] + 0.25, 'peak', -21, R, why='collapses to 0:10')
cue('notif_04', T('seconds', 70) + 0.05, 'onset', -22, R, rate=1.06, why='−80% chip')
cue('softs_2', g['tHEnd'] + 0.4, 'peak', -27, R, why='card exits right')

# ── write the stem: 48 kHz / 24-bit stereo, exactly the video length, starts at 0 ──
out = out[:int(round(DUR * SR))] * 10 ** (8 / 20)        # stem gain: ~16 dB under the voice (median), clicks still clear
pk = np.abs(out).max()
if pk > 0.89: out *= 0.89 / pk                                 # keep true headroom
pcm = (np.clip(out, -1, 1) * 8388607).astype(np.int32)
b24 = pcm.astype('<i4').view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
with wave.open('sfx_stem_48k24.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b24)
with open('sfx_cues.tsv', 'w', encoding='utf-8') as f:
    f.write('file_start\tsync_point\tsound\talign\tgain_db\tpan\twhat it marks\n')
    for c in sorted(CUES): f.write('\t'.join(str(v) for v in c) + '\n')
print('cues:', len(CUES), ' peak:', round(20 * np.log10(np.abs(out).max() + 1e-9), 1), 'dBFS  len:', round(len(out) / SR, 4), 's')

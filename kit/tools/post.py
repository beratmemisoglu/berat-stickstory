# Finish a film: frames -> bloom on bright practicals, light vignette, film grain, word-by-word captions, the voiceover.
#   .venv/Scripts/python.exe tools/post.py <film_dir> --vo vo/japan.mp3 --words vo/japan.json [--frames <dir>] [--out name.mp4]
#     [--no-captions] [--t0 0 --t1 60.5]
# film_dir/frames/####.png (global frame numbers from 1) -> film_dir/<out>. Captions: white heavy sans with a dark outline,
# centred ~70 % down, one word at a time (short words ride with the next one), like the reference.
import argparse, json, os, shutil, subprocess

ap = argparse.ArgumentParser()
ap.add_argument('film'); ap.add_argument('--vo'); ap.add_argument('--words'); ap.add_argument('--frames')
ap.add_argument('--out', default='film.mp4'); ap.add_argument('--no-captions', action='store_true')
ap.add_argument('--t0', type=float, default=0.0); ap.add_argument('--t1', type=float, default=0.0)
ap.add_argument('--bloom', type=float, default=0.5); ap.add_argument('--grain', type=float, default=5)
ap.add_argument('--sat', type=float, default=1.2); ap.add_argument('--sharpen', type=float, default=0.9)
# per-film value: --gain multiplies (brightens AND keeps contrast: a midtone lift alone flattens it), --lift = the
# midtone curve's output at 0.5 (Jar's saturated red hall + violet nights measured lum 99 / sat 157 vs 131 / 113)
ap.add_argument('--gain', type=float, default=1.0); ap.add_argument('--lift', type=float, default=0.575)
# --curve: the whole tone curve instead of the midtone lift, e.g. "0/0 0.25/0.33 0.5/0.6 0.8/0.86 1/1": lifts darks and
# mids and rolls off before white (a gain washed Jar's bronze out to cream while the metrics passed)
ap.add_argument('--curve', default='')
ap.add_argument('--capstyle', default='toon')   # 'mega': the Everest look's small bold phrases with a soft shadow
a = ap.parse_args()
film = os.path.abspath(a.film)
frames = os.path.abspath(a.frames or os.path.join(film, 'frames'))
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def frame_size(png):
    """(width, height) from a PNG's header."""
    import struct
    with open(png, 'rb') as f: b = f.read(24)
    return struct.unpack('>II', b[16:24])


def captions(words, path, t0, size=(1080, 1920)):
    # the same 74 px words on the frame's short side either way; ~70 % down a vertical frame, ~82 % down a wide one
    W, H = size; px, py = W // 2, round(H * (0.703 if H > W else 0.82))
    groups, cur = [], []
    mega = a.capstyle == 'mega'
    k = min(W, H) / 1080   # caption size follows the frame (preview renders at 0.35 got 3x too big words)
    if mega: py = round(H * (0.78 if H > W else 0.86))
    for w in words:
        cur.append(w)
        txt = ''.join(ch for ch in w['word'] if ch.isalnum())
        if mega:   # the megaproject look: 2-3 word phrases, a break on punctuation or ~16 letters
            n = sum(len(x['word']) for x in cur)
            if len(cur) >= 3 or n >= 16 or w['word'][-1:] in ',.?!': groups.append(cur); cur = []
        elif len(txt) > 3 or w['word'][-1:] in ',.?!' : groups.append(cur); cur = []
    if cur: groups.append(cur)
    lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', '',
             '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             (f'Style: Cap,Arial,{round(76 * k)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,0,{max(1, round(4 * k))},5,40,40,40,1' if mega else
              f'Style: Cap,Arial Black,{round(74 * k)},&H00FFFFFF,&H00FFFFFF,&H00141A1E,&H64000000,0,0,0,0,100,100,0,0,1,{max(1, round(6 * k))},{max(1, round(2 * k))},5,40,40,40,1'), '',
             '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for i, g in enumerate(groups):
        s = g[0]['start'] - t0; e = (groups[i + 1][0]['start'] - t0) if i + 1 < len(groups) else g[-1]['end'] - t0 + 0.4
        e = min(e, g[-1]['end'] - t0 + 0.6)
        text = ' '.join(w['word'] for w in g)
        # a 3-frame pop: 80 % -> 104 % -> 100 %
        pop = r'{\pos(%d,%d)\fscx82\fscy82\t(0,60,\fscx104\fscy104)\t(60,110,\fscx100\fscy100)}' % (px, py)
        lines.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{pop}{text}')
    open(path, 'w', encoding='utf8').write('\n'.join(lines) + '\n')


# the caption font for libass: a copy of the system's Arial Black (in a Toon Studio project under .suite/, which its git
# and its shared zips leave out; the lab's films keep their fonts/ folder)
FONTS = '.suite/fonts' if os.path.isdir(os.path.join(film, '.suite')) else 'fonts'
os.makedirs(os.path.join(film, FONTS), exist_ok=True)
fnt = next((p for p in (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'ariblk.ttf'),
                        '/System/Library/Fonts/Supplemental/Arial Black.ttf', '/Library/Fonts/Arial Black.ttf') if os.path.exists(p)), None)
if fnt: shutil.copy(fnt, os.path.join(film, FONTS, 'ariblk.ttf'))
for bd in (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'arialbd.ttf'), '/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
    if os.path.exists(bd): shutil.copy(bd, os.path.join(film, FONTS, 'arialbd.ttf')); break   # the 'mega' captions
gain = f"curves=all='0/0 {1 / a.gain:.4f}/1 1/1'," if a.gain > 1.0 else ''
vf = (f"format=gbrp,split=2[a][b];[b]curves=all='0/0 0.72/0 1/1',gblur=sigma=26[g];[a][g]blend=all_mode=screen:all_opacity={a.bloom}[c];"
      # midtone lift (cut 2 measured luminance 111 vs the reference's 131; the whites stay put)
      # + saturation 1.2 (the final measured 85 vs the reference's 113: the lift and the dressed sets muted it) and a
      # crisper sharpen (the reference's line work is crisp edge to edge)
      f"[c]{gain}curves=all='{a.curve or f'0/0 0.5/{a.lift} 1/1'}',eq=saturation={a.sat},unsharp=5:5:{a.sharpen}:5:5:0.0,vignette=angle=PI/5,"
      f"noise=alls={a.grain}:allf=t,format=yuv420p")
pngs = sorted(int(f[:4]) for f in os.listdir(frames) if f.endswith('.png') and f[:4].isdigit())
first, last = pngs[0], pngs[-1]
t0 = (first - 1) / 30; t1 = last / 30      # global frame numbers are film time: audio + captions follow them
if not a.no_captions and a.words:
    words = json.load(open(a.words, encoding='utf8'))['words']
    captions([w for w in words if t0 - 0.05 <= w['start'] < t1], os.path.join(film, 'captions.ass'), t0,
             frame_size(os.path.join(frames, f'{first:04d}.png')))
    # the caption font (Arial Black): the copy above when there is one, else the system's (every Windows and macOS has
    # it; Toon Studio never ships it)
    vf += ',subtitles=captions.ass' + (f':fontsdir={FONTS}' if os.listdir(os.path.join(film, FONTS)) else '')
cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-start_number', str(first), '-i', os.path.join(frames, '%04d.png')]
if a.vo:
    cmd += ['-ss', f'{t0:.3f}', '-i', os.path.abspath(a.vo)]
cmd += ['-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p']
if a.vo: cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
cmd += [a.out]
print(' '.join(cmd))
subprocess.run(cmd, cwd=film, check=True)
print('POST', os.path.join(film, a.out))

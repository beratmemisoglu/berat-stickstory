"""Stage the intro for editing: work/intro/ with the render copy, the transcript, study frames and the kit.
    "$CZ_PYTHON" "$SK/stage.py"                              # first run: stage + transcribe the raw intro
    "$CZ_PYTHON" "$SK/stage.py" --keep "0.00-4.12,6.80-31.40"   # splice out false starts (RAW intro seconds), re-transcribe
Never modifies the footage. Re-running never overwrites index.html, storyboard.json or anything else you wrote.

Writes (in <project>/work/intro):
  input-video.mp4   render copy (keyframe every second, AAC 320k; spliced with 20 ms equal-power crossfades if --keep)
  words.json        [{w, s, e}] word timings of input-video.mp4        transcript.json  [{start, end, text, words}]
  env.json          the voice loudness per video frame (0..1), for real waveforms in the graphics
  raw_words.json    word timings of the RAW intro (what --keep ranges refer to)
  study/f1..f8.jpg  stills across the clip, study/sheet.jpg the contact sheet (look at it: safe zone, columns)
  motion/ fonts/ vendor/          the house motion kit (window.SMOOTH, Inter, GSAP)
  index.html        the composition skeleton (4K canvas, duration + fps filled in), only if missing
  storyboard.json   the storyboard template, only if missing"""
import argparse, json, os, re, shutil, subprocess, sys
for _s in (sys.stdout, sys.stderr):                     # UTF-8 output whatever the console code page
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__)); SKILL = os.path.dirname(HERE)
XF = 0.02


def graph_opt():
    """ffmpeg 7+ takes a filter graph file as -/filter_complex; ffmpeg 9 removed -filter_complex_script."""
    try:
        out = subprocess.run(['ffmpeg', '-hide_banner', '-version'], capture_output=True, text=True, timeout=15).stdout
        m = re.match(r'ffmpeg version n?(\d+)\.', out or '')
        return '-filter_complex_script' if m and int(m.group(1)) < 7 else '-/filter_complex'
    except Exception:
        return '-/filter_complex'


def sh(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, **kw)
    if r.returncode: sys.exit(f'{os.path.basename(args[0])} failed:\n{(r.stderr or r.stdout)[-1500:]}')
    return r.stdout


def probe(f):
    j = json.loads(sh(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]))
    v = next((s for s in j['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    if not v: sys.exit(f'{f}: no video stream')
    num, den = (v.get('avg_frame_rate') or v.get('r_frame_rate') or '30/1').split('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 30.0
    rot = abs(int(float((v.get('tags') or {}).get('rotate', 0) or 0)))
    for sd in v.get('side_data_list') or []:
        if 'rotation' in sd: rot = abs(int(sd['rotation']))
    w, h = int(v['width']), int(v['height'])
    if rot in (90, 270): w, h = h, w
    return {'w': w, 'h': h, 'fps': fps, 'dur': float(j['format']['duration']), 'audio': a is not None}


def encoder():
    """NVENC when it actually works here, else libx264 (VideoToolbox is skipped: x264 is fast enough for an intro)."""
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x144:d=0.1', '-c:v', 'h264_nvenc', '-f', 'null', '-'], capture_output=True, timeout=20)
        if r.returncode == 0: return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '16', '-b:v', '0']
    except Exception: pass
    return ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16']


def media_intro(project, pick):
    if pick: return os.path.abspath(pick)
    try: media = json.load(open(os.path.join(project, 'media.json'), encoding='utf-8'))['media']
    except Exception: sys.exit('No media.json in the project: add the intro footage in the Suite first.')
    intro = [m for m in media if m.get('role') == 'intro' and not m.get('derived')]
    if not intro: sys.exit('No footage is marked "Intro" in the Suite footage list. Ask the user to mark the intro read.')
    if len(intro) > 1: print(f'{len(intro)} intro files; using the first: {intro[0]["file"]} (pass --intro FILE for another)')
    return intro[0]['file']


def transcribe(src, out_json):
    py, script = os.environ.get('CZ_ASR_PYTHON'), os.environ.get('CZ_ASR_SCRIPT')
    if not (py and script and os.path.exists(script)):
        sys.exit('No speech recognizer configured (CZ_ASR_PYTHON / CZ_ASR_SCRIPT). The Suite sets them when it runs this skill.')
    os.makedirs('asr', exist_ok=True)
    sh(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'asr/vo.wav'])
    sh([py, script, 'asr/vo.wav', '--out', 'asr'])
    j = json.load(open('asr/vo.json', encoding='utf-8'))
    words = [{'w': w.get('word', w.get('w', '')).strip(), 's': round(float(w['start']), 3), 'e': round(float(w['end']), 3)}
             for w in j.get('words', []) if str(w.get('word', w.get('w', ''))).strip()]
    json.dump(words, open(out_json, 'w', encoding='utf-8'), indent=0)
    return words, j.get('segments', [])


def lines(words, gap=0.6, max_words=14):
    """Words grouped into readable lines (a new line at a pause or after max_words)."""
    out, cur = [], []
    for w in words:
        if cur and (w['s'] - cur[-1]['e'] > gap or len(cur) >= max_words):
            out.append(cur); cur = []
        cur.append(w)
    if cur: out.append(cur)
    return [{'start': l[0]['s'], 'end': l[-1]['e'], 'text': ' '.join(w['w'] for w in l), 'words': l} for l in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--intro'); ap.add_argument('--keep', help='RAW-intro ranges to keep: "a-b,c-d" (seconds)')
    a = ap.parse_args()
    project = os.environ.get('CZ_PROJECT') or os.getcwd()
    work = os.path.join(project, 'work', 'intro'); os.makedirs(work, exist_ok=True); os.chdir(work)
    src = media_intro(project, a.intro)
    if not os.path.exists(src): sys.exit(f'The intro file is missing: {src}')
    P = probe(src)
    fps = 60 if P['fps'] > 60.5 else (round(P['fps']) if abs(P['fps'] - round(P['fps'])) < 0.05 else P['fps'])
    fps_i = int(round(fps))
    vf = ['scale=3840:-2:flags=lanczos'] if P['w'] > 3840 else []
    if P['fps'] > 60.5: vf.append('fps=60')
    enc = encoder() + ['-g', str(fps_i), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    aenc = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000']

    if not a.keep:
        args = ['ffmpeg', '-v', 'error', '-y', '-i', src] + (['-vf', ','.join(vf)] if vf else []) + enc + (aenc if P['audio'] else ['-an']) + ['input-video.mp4']
        sh(args)
        words, _ = transcribe('input-video.mp4', 'words.json')
        shutil.copyfile('words.json', 'raw_words.json')
    else:
        rng = []
        for part in a.keep.split(','):
            m = re.match(r'\s*([\d.]+)\s*-\s*([\d.]+)\s*$', part)
            if not m: sys.exit(f'--keep: cannot read {part!r} (use "a-b,c-d" in seconds)')
            s, e = float(m.group(1)), min(float(m.group(2)), P['dur'])
            if e - s < 0.1: sys.exit(f'--keep: range {part} is too short')
            rng.append((s, e))
        rng.sort()
        for (s1, e1), (s2, e2) in zip(rng, rng[1:]):
            if s2 < e1 + XF: sys.exit(f'--keep: ranges {s1}-{e1} and {s2}-{e2} overlap (leave at least {XF}s between them)')
        fc, vl, al = [], [], []
        for i, (s, e) in enumerate(rng):
            last = i == len(rng) - 1
            fc.append(f'[0:v]trim={s:.4f}:{e:.4f},setpts=PTS-STARTPTS{"," + ",".join(vf) if vf else ""}[v{i}]'); vl.append(f'[v{i}]')
            if P['audio']:          # the outgoing piece runs XF past the join and crossfades (equal power) into the next
                fc.append(f'[0:a]atrim={s:.4f}:{(e if last else min(P["dur"], e + XF)):.4f},asetpts=PTS-STARTPTS,aresample=48000[a{i}]'); al.append(f'[a{i}]')
        fc.append(''.join(vl) + f'concat=n={len(vl)}:v=1:a=0[v]')
        if P['audio']:
            cur = al[0]
            for i in range(1, len(al)):
                nxt = f'[x{i}]' if i < len(al) - 1 else '[a]'
                fc.append(f'{cur}{al[i]}acrossfade=d={XF}:c1=qsin:c2=qsin{nxt}'); cur = nxt
            if len(al) == 1: fc[-2] = fc[-2].replace('[a0]', '[a]')
        open('splice.fc', 'w').write(';\n'.join(fc))
        sh(['ffmpeg', '-v', 'error', '-y', '-i', src, graph_opt(), 'splice.fc', '-map', '[v]'] + (['-map', '[a]'] if P['audio'] else []) + enc + (aenc if P['audio'] else ['-an']) + ['input-video.mp4'])
        json.dump({'keep': rng, 'crossfade': XF}, open('splice.json', 'w'), indent=1)
        words, _ = transcribe('input-video.mp4', 'words.json')

    R = probe('input-video.mp4'); dur = R['dur']
    json.dump(lines(words), open('transcript.json', 'w', encoding='utf-8'), indent=1)

    # env.json: the voice's loudness per video frame (0..1, peak-normalized) for drawing real waveforms
    if R['audio']:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'input-video.mp4', '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], capture_output=True).stdout
        import array
        pcm = array.array('h'); pcm.frombytes(raw[:len(raw) // 2 * 2])
        step = max(1, round(48000 / fps_i)); env = [max((abs(v) for v in pcm[i:i + step]), default=0) for i in range(0, len(pcm), step)]
        top = max(env) or 1
        json.dump([round(v / top, 3) for v in env], open('env.json', 'w'))

    # study frames + contact sheet
    os.makedirs('study', exist_ok=True)
    for i in range(8):
        t = dur * (i + 0.5) / 8
        sh(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', 'input-video.mp4', '-frames:v', '1', '-vf', 'scale=960:-2', f'study/f{i + 1}.jpg'])
    sh(['ffmpeg', '-v', 'error', '-y', '-i', 'study/f%d.jpg', '-vf', 'tile=4x2:padding=8:color=black', '-frames:v', '1', 'study/sheet.jpg'])

    # the kit (always refreshed) and the starting files (only if missing)
    for d in ('motion', 'fonts', 'vendor'):
        shutil.copytree(os.path.join(SKILL, 'assets', d), d, dirs_exist_ok=True)
    staged = open('.staged-index', encoding='utf-8').read() if os.path.exists('.staged-index') else None
    current = open('index.html', encoding='utf-8').read() if os.path.exists('index.html') else None
    if current is None or current == staged:          # missing, or still the untouched skeleton: (re)write it
        s = open(os.path.join(SKILL, 'templates', 'composition-skeleton.html'), encoding='utf-8').read()
        s = s.replace('DURATION', f'{dur:.3f}').replace('data-fps="30"', f'data-fps="{fps_i}"')
        open('index.html', 'w', encoding='utf-8').write(s); open('.staged-index', 'w', encoding='utf-8').write(s)
        current = staged = s
    if not os.path.exists('storyboard.json'):
        sb = json.load(open(os.path.join(SKILL, 'templates', 'storyboard-template.json'), encoding='utf-8'))
        sb['composition'].update(fps=fps_i, durationSeconds=round(dur, 3)); sb['source']['original'] = src
        json.dump(sb, open('storyboard.json', 'w', encoding='utf-8'), indent=2)
    if a.keep and current != staged:
        print(f'NOTE: index.html was written for the old timing: set its durations to {dur:.3f} and re-time every card to words.json.')

    npx = shutil.which('hyperframes') or shutil.which('npx')
    print(f'Staged {work}')
    print(f'  source   {src}  {P["w"]}x{P["h"]} {P["fps"]:.3f} fps  {P["dur"]:.2f}s' + ('' if P['audio'] else '  NO AUDIO'))
    print(f'  render copy input-video.mp4  {R["w"]}x{R["h"]}  {fps_i} fps  {dur:.3f}s' + (f'  (spliced: {len(rng)} pieces)' if a.keep else ''))
    print(f'  {len(words)} words  ->  words.json / transcript.json' + ('' if a.keep else ' (raw timings also in raw_words.json)'))
    print('  study/sheet.jpg: 8 stills at ' + ', '.join(f'{dur * (i + 0.5) / 8:.1f}s' for i in range(8)))
    if not npx: print('NEEDS NODE: HyperFrames runs on Node.js, which is not installed. Tell the user to run the Toon Studio installer again (it adds Node.js).')
    print('\nTranscript (seconds in input-video.mp4):')
    for l in lines(words): print(f"  {l['start']:7.2f}-{l['end']:7.2f}  {l['text']}")


if __name__ == '__main__':
    main()

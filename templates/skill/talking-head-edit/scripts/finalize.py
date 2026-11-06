"""FINAL GATE. Does not trust recorded results: it RUNS the script check (check_edit.py) and the lipsync check
(verify_sync.py) itself on the current files, checks the render is newer than the cut and frame-exact, then writes
delivery.json. Any problem: exit 1 with the list, nothing is delivered. There are no overrides and no whitelists.
"""
import os, sys, json, time, subprocess
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fmt, AUDIO, SCREEN_OUT, CAM_OUT, OUT
here = os.path.dirname(os.path.abspath(__file__)); py = sys.executable
p = load(); bad = []
g = lambda: json.load(open('gates.json', encoding='utf-8')) if os.path.exists('gates.json') else {}
need = lambda f: os.path.exists(f) or bad.append(f'missing {f}')
for f in ('script.md', 'spans.json', 'timeline.json', AUDIO, SCREEN_OUT): need(f)
if not bad:
    if os.path.getmtime('script.md') > os.path.getmtime('spans.json'): bad.append('script.md changed after build_cut.py - run build_cut.py and everything after it')
    if os.path.getmtime('spans.json') > os.path.getmtime('timeline.json'): bad.append('the cut changed after render_audio.py - run render_audio.py and everything after it')
    if os.path.getmtime(AUDIO) > os.path.getmtime(SCREEN_OUT): bad.append('the audio is newer than the video - run segrender.py screen/cam and mux.py again')
    mx = g().get('mux', {}).get('files', {})
    for which, f in mx.items():
        if not f.get('ok'): bad.append(f"mux {which}: frames {f.get('frames')} vs expected {f.get('expected')}, decode clean: {f.get('decode_clean')}")
        elif not os.path.exists(f['file']) or abs(os.path.getmtime(f['file']) - f['mtime']) > 1: bad.append(f'mux {which}: file changed or missing after mux.py')
    if not mx: bad.append('mux.py never ran')
    if not os.path.exists('contact.png') or os.path.getmtime('contact.png') < os.path.getmtime(SCREEN_OUT): bad.append('run contact.py after the render and look at contact.png / switches.png')
if not bad:
    print('running the script check (check_edit.py) ...', flush=True)
    r = subprocess.run([py, os.path.join(here, 'check_edit.py')], capture_output=True, text=True)
    # the verdict lines in full (a tail cut once hid the one FAIL behind a page of spelling notes)
    lines = r.stdout.splitlines(); key = [l for l in lines if 'FAIL' in l or 'REVIEW' in l]
    print('\n'.join([l for l in lines if l not in key][-15:] + key[:80]) + (r.stderr[-1500:] if r.returncode and not key else ''))
    if r.returncode: bad.append('check_edit.py FAILED (see above): cut the unaccounted sound / extra words out through script.md')
    if p.get('sync'):
        print('running the lipsync check (verify_sync.py) ...', flush=True)
        r = subprocess.run([py, os.path.join(here, 'verify_sync.py')], capture_output=True, text=True); print(r.stdout[-3000:])
        for k, c in g().get('sync', {}).get('clips', {}).items():
            if c.get('weak_speech'): bad.append(f"sync {k}: weak match on speech at {c['weak_speech']}")
            if c.get('max_dev_ms') is not None and c['max_dev_ms'] > 16.7: bad.append(f"sync {k}: a span {c['max_dev_ms']:.1f} ms off the clip median (limit 16.7)")
            if c.get('spans', 0) and not c.get('strong'): bad.append(f'sync {k}: no strong lipsync match at all')
if bad:
    print('NOT DELIVERED - fix these, re-run the listed steps, then finalize.py again:'); [print('  -', b) for b in bad]; sys.exit(1)
gg = g(); mx = gg['mux']['files']; cut = gg.get('cut', {})
d = {'screen': mx['screen']['file'], 'facecam': mx.get('cam', {}).get('file'), 'audio': os.path.abspath(AUDIO),
     'duration': gg['mux']['duration'], 'raw_duration': p['screen']['duration'], 'pieces': cut.get('spans'), 'playback': cut.get('blocks'),
     'excluded_cams': p.get('excluded_cams', []), 'lipsync_max_ms': gg.get('sync', {}).get('max_abs_ms'), 'created': time.strftime('%Y-%m-%dT%H:%M:%S')}
json.dump(d, open('delivery.json', 'w', encoding='utf-8'), indent=1)
print(f"DELIVERED: {fmt(d['raw_duration'])} -> {fmt(d['duration'])} | {d['pieces']} pieces | files in {OUT}")

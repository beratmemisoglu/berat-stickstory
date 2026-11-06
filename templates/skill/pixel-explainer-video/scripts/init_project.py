#!/usr/bin/env python3
"""Scaffold a pixel-explainer project folder.

  python init_project.py <project_dir> --audio <voiceover file> [--title "My Video"]

Creates:
  <project>/engine.js, models.js, index.html     (the rendering engine, copied from the skill)
  <project>/vendor/three.module.js, fonts/*.woff2  (vendored: renders never depend on a CDN)
  <project>/package.json + node_modules          (puppeteer-core, three, fontsource fonts)
  <project>/project.json                         (scene list, images, end time - edited as you build)
  <project>/audio/source.<ext>                   (copy of the voiceover)
  <project>/scenes/, assets/, out/
Re-running on an existing project only refreshes the engine files if you pass --refresh-engine.
"""
import argparse, json, os, shutil, subprocess, sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--audio'); ap.add_argument('--title', default='Untitled')
ap.add_argument('--refresh-engine', action='store_true')
a = ap.parse_args()
P = os.path.abspath(a.project)
for d in ('scenes', 'assets', 'audio', 'out', 'vendor', 'fonts'):
    os.makedirs(os.path.join(P, d), exist_ok=True)

eng = os.path.join(SKILL, 'assets', 'engine')
for f in ('engine.js', 'models.js', 'index.html'):
    dst = os.path.join(P, f)
    if a.refresh_engine or not os.path.exists(dst):
        shutil.copy(os.path.join(eng, f), dst); print('engine:', f)
for f in ('render.mjs',):
    shutil.copy(os.path.join(SKILL, 'scripts', f), os.path.join(P, f))

pj = os.path.join(P, 'project.json')
if not os.path.exists(pj):
    json.dump({'title': a.title, 'end': 0, 'timeline': 'audio/timeline.json', 'scenes': [], 'images': {},
               'previewAudio': 'audio/clean.wav'}, open(pj, 'w'), indent=1)
if a.audio:
    ext = os.path.splitext(a.audio)[1].lower() or '.wav'
    shutil.copy(a.audio, os.path.join(P, 'audio', 'source' + ext)); print('audio copied')

pkg = os.path.join(P, 'package.json')
if not os.path.exists(pkg):
    json.dump({'name': 'pixel-explainer-project', 'private': True, 'type': 'module',
               'dependencies': {'puppeteer-core': '^24.0.0', 'three': '0.170.0', '@fontsource-variable/orbitron': '^5.0.0',
                                '@fontsource/share-tech-mono': '^5.0.0'}}, open(pkg, 'w'), indent=1)
if not os.path.exists(os.path.join(P, 'node_modules', 'three')):
    npm = shutil.which('npm') or shutil.which('npm.cmd')
    if not npm: sys.exit('npm not found - run scripts/setup.py first')
    r = subprocess.call([npm, 'install', '--no-audit', '--no-fund', '--loglevel=error'], cwd=P, shell=(os.name == 'nt'))
    if r: sys.exit('npm install failed')

nm = os.path.join(P, 'node_modules')
shutil.copy(os.path.join(nm, 'three', 'build', 'three.module.js'), os.path.join(P, 'vendor', 'three.module.js'))
core = os.path.join(nm, 'three', 'build', 'three.core.js')                  # newer three splits the build
if os.path.exists(core): shutil.copy(core, os.path.join(P, 'vendor', 'three.core.js'))
def find_font(pkgdir, must):
    d = os.path.join(nm, pkgdir, 'files')
    c = [f for f in os.listdir(d) if f.endswith('.woff2') and all(m in f for m in must)]
    return os.path.join(d, sorted(c)[0])
shutil.copy(find_font('@fontsource-variable/orbitron', ['latin-wght', 'normal']), os.path.join(P, 'fonts', 'orbitron.woff2'))
shutil.copy(find_font('@fontsource/share-tech-mono', ['latin-400', 'normal']), os.path.join(P, 'fonts', 'share-tech-mono.woff2'))
print('project ready:', P)

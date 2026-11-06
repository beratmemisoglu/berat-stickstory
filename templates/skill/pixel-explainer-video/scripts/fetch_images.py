#!/usr/bin/env python3
"""Find and download real-world images (box art, screenshots, photos of people, logos, hardware)
from Wikipedia / Wikimedia Commons, with license + author captured for credits.

  python fetch_images.py search --pages "Shadow of the Colossus" "Naughty Dog" [--commons "Emotion Engine chip"]
      -> lists candidate files per page/query: title | size | KB | license | author   (downloads nothing)
  python fetch_images.py get <project> "File:Name.jpg=key" ["File:Other.png=key2" ...]
      -> downloads to <project>/assets/<key>.<ext>, shrinks anything over 1600 px, appends
         assets/credits.json and registers the key in project.json "images"
  python fetch_images.py credits <project>
      -> prints the credit lines for the end card and the video description

Why these sources: stable URLs, explicit licenses, and authors for attribution. Game covers/screenshots
on English Wikipedia are small (~300 px) fair-use copies - fine for framed cards, not for full-screen.
Ask the user before downloading (list what, from where, how big) unless they already approved asset
gathering for this project. Never rip video from YouTube; if footage is wanted, ask the user for clips.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
try: sys.stdout.reconfigure(encoding='utf-8')     # credits redirected into DESCRIPTION.txt stay UTF-8 on Windows ("™" was cp1252 0x99)
except Exception: pass

UA = 'PixelExplainerAssetFetcher/1.1 (personal video project; low-volume; +https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) python-urllib'
def fetch(url, timeout=60):
    # Wikimedia rate-limits bursts (HTTP 429): back off and retry instead of crashing
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout).read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 5 or int(e.headers.get('Retry-After') or 0) >= 60: raise   # long bans won't clear: let caller fall back
            wait = min(int(e.headers.get('Retry-After') or 0) or 2 ** attempt * 2, 20)   # upload.wikimedia sends Retry-After: 600 - don't hang 10 min
            print(f'  rate limited ({e.code}), retrying in {wait}s'); time.sleep(wait)
def api(host, **params):
    params.update(format='json', origin='*')
    return json.loads(fetch(f'https://{host}/w/api.php?' + urllib.parse.urlencode(params), 30))
SKIP = ('Commons-logo', 'Question', 'Edit-clear', 'Ambox', 'Padlock', 'Folder', 'Portal', 'Crystal', 'Nuvola', 'Wiktionary', 'Wikiquote',
        'Increase', 'Decrease', 'Steady', 'Office-book', 'Text document', 'Symbol', 'Flag of', 'Wikidata', 'OOjs', 'Disambig')

def info(titles, host='en.wikipedia.org'):
    out = {}
    for i in range(0, len(titles), 40):
        j = api(host, action='query', prop='imageinfo', iiprop='url|size|extmetadata', iiextmetadatafilter='LicenseShortName|Artist',
                iiurlwidth=1280, titles='|'.join(titles[i:i + 40]))
        for p in j['query']['pages'].values():
            ii = (p.get('imageinfo') or [None])[0]
            if not ii: continue
            md = ii.get('extmetadata') or {}
            if not isinstance(md, dict): md = {}                   # the API returns [] when a file has no metadata
            artist = md.get('Artist', {}).get('value', '')
            import re; artist = re.sub(r'<[^>]+>', '', artist).strip()[:60]
            out[p['title']] = {'url': ii['url'].split('?')[0],     # drop ?utm_... tracking suffixes
                               'thumb': (ii.get('thumburl') or '').split('?')[0],
                               'w': ii.get('width'), 'h': ii.get('height'), 'kb': round(ii.get('size', 0) / 1024),
                               'license': md.get('LicenseShortName', {}).get('value', '?'), 'author': artist}
    return out

def cmd_search(args):
    pages, commons, mode = [], [], None
    for a in args:
        if a == '--pages': mode = 'p'; continue
        if a == '--commons': mode = 'c'; continue
        (pages if mode != 'c' else commons).append(a)
    for pg in pages:
        j = api('en.wikipedia.org', action='query', prop='images', imlimit=60, redirects=1, titles=pg)
        pgs = list(j['query']['pages'].values())[0]
        files = [i['title'] for i in pgs.get('images', []) if i['title'].lower().endswith(('.jpg', '.jpeg', '.png', '.svg', '.gif', '.webp'))
                 and not any(s in i['title'] for s in SKIP)]
        print(f'\n== {pg} ({len(files)} files)')
        for t, d in info(files).items():
            print(f"  {t} | {d['w']}x{d['h']} | {d['kb']} KB | {d['license']} | {d['author']}")
    for q in commons:
        j = api('commons.wikimedia.org', action='query', list='search', srnamespace=6, srlimit=8, srsearch=q)
        files = [r['title'] for r in j['query']['search']]
        print(f'\n== commons: {q}')
        for t, d in info(files, 'commons.wikimedia.org').items():
            print(f"  {t} | {d['w']}x{d['h']} | {d['kb']} KB | {d['license']} | {d['author']}")

def cmd_get(project, specs):
    P = os.path.abspath(project); AS = os.path.join(P, 'assets'); os.makedirs(AS, exist_ok=True)
    pairs = [[x.strip() for x in s.strip().rsplit('=', 1)] for s in specs]
    meta = info([t for t, _ in pairs]); meta.update({k: v for k, v in info([t for t, _ in pairs if t not in meta], 'commons.wikimedia.org').items()})
    cred_p = os.path.join(AS, 'credits.json'); pj = os.path.join(P, 'project.json')
    for title, key in pairs:
        d = meta.get(title)
        if not d: print('not found:', title); continue
        ext = os.path.splitext(d['url'])[1].lower()
        # upload.wikimedia.org 429s full-size originals and non-standard thumb widths for scripted clients:
        # prefer a standard-size thumbnail (w.wiki/GHai), fall back to the original only for small files
        std = lambda w: f"{d['url'].replace('/wikipedia/commons/', '/wikipedia/commons/thumb/').replace('/wikipedia/en/', '/wikipedia/en/thumb/')}/{w}px-{os.path.basename(d['url'])}"
        if ext == '.svg': srcs, ext = [std(1280) + '.png'], '.png'   # rasterised PNG render - PIL/three can't read SVG
        elif (d.get('w') or 0) > 1280: srcs = [std(1280)]
        else: srcs = [d['url']] + [std(w) for w in (960, 500, 330, 250) if w < (d.get('w') or 0)][:1]
        dst = os.path.join(AS, key + ext); data = None
        for src in srcs:
            try: data = fetch(src); break
            except Exception as e: err = e
        if data is None: print(f'FAILED {key} <- {title}: {err}'); continue   # skip this one, keep going
        open(dst, 'wb').write(data); time.sleep(1)                   # be polite: 1 request/s
        if ext in ('.jpg', '.jpeg', '.png', '.webp'):
            from PIL import Image
            im = Image.open(dst)
            if max(im.size) > 1600: im.thumbnail((1600, 1600)); (im.convert('RGB') if ext in ('.jpg', '.jpeg') else im).save(dst, quality=90)
        register(P, key, key + ext, {'file': title, 'license': d['license'], 'author': d['author'], 'url': d['url']})
        print(f'{key}{ext}  <- {title}  [{d["license"]}] {d["author"]}')

def jload(p):
    raw = open(p, 'rb').read()
    try: return json.loads(raw.decode('utf-8'))
    except UnicodeDecodeError: return json.loads(raw.decode('cp1252'))   # tolerate files written with the Windows default codepage

def register(P, key, fname, credit):
    # Re-read both files right before writing and touch only our keys: other tools/agents edit project.json
    # (scenes etc.) while slow downloads run, so never write back a copy loaded earlier.
    cred_p = os.path.join(P, 'assets', 'credits.json'); pj = os.path.join(P, 'project.json')
    cred = jload(cred_p) if os.path.exists(cred_p) else {}
    cred[key] = credit; json.dump(cred, open(cred_p, 'w', encoding='utf-8'), indent=1)
    proj = jload(pj); proj.setdefault('images', {})[key] = fname
    json.dump(proj, open(pj, 'w', encoding='utf-8'), indent=1)

def cmd_credits(project):
    cred = jload(os.path.join(os.path.abspath(project), 'assets', 'credits.json'))
    need = [f"{v['file'][5:].rsplit('.', 1)[0]}: {v['author'] or 'Wikimedia Commons'} ({v['license']})"
            for v in cred.values() if v['license'] not in ('Fair use',)]
    print('Images via Wikipedia / Wikimedia Commons.')
    for l in need: print('  ' + l)
    if any(v['license'] == 'Fair use' for v in cred.values()): print('  Game art and logos (c) their respective publishers.')

if __name__ == '__main__':
    c = sys.argv[1] if len(sys.argv) > 1 else ''
    if c == 'search': cmd_search(sys.argv[2:])
    elif c == 'get': cmd_get(sys.argv[2], sys.argv[3:])
    elif c == 'credits': cmd_credits(sys.argv[2])
    else: print(__doc__)

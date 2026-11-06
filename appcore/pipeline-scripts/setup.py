#!/usr/bin/env python3
"""Check and install everything the pixel-explainer pipeline needs. Safe to re-run.

  python setup.py            # check + install Python packages, report anything missing
  python setup.py --check    # only report

System tools it needs (not pip-installable): ffmpeg (+ffprobe), Node.js >= 18, and Chrome/Edge/Chromium.
If one is missing it prints the one-line install command for this OS instead of guessing; installing
system software is left to the user/agent to confirm.
Python packages: numpy, pillow, scipy, stable-ts (pulls openai-whisper + torch). If an NVIDIA GPU is
present and torch has no CUDA, it offers the CUDA wheel command (transcription/alignment are ~10x faster).
"""
import importlib, importlib.util, json, os, platform, shutil, subprocess, sys

CHECK_ONLY = '--check' in sys.argv
OS = platform.system()
report = {'ok': [], 'missing': [], 'actions': []}

def have_cmd(c):
    return shutil.which(c) is not None

def run(cmd):
    print('  $', ' '.join(cmd)); return subprocess.call(cmd)

# ---------- system tools ----------
INSTALL = {
    'ffmpeg': {'Windows': 'winget install --id Gyan.FFmpeg -e', 'Darwin': 'brew install ffmpeg', 'Linux': 'sudo apt-get install -y ffmpeg'},
    'node': {'Windows': 'winget install --id OpenJS.NodeJS.LTS -e', 'Darwin': 'brew install node', 'Linux': 'sudo apt-get install -y nodejs npm'},
    'chrome': {'Windows': 'winget install --id Google.Chrome -e  (Edge is usually already installed and also works)',
               'Darwin': 'brew install --cask google-chrome', 'Linux': 'sudo apt-get install -y chromium-browser'},
}
for tool in ('ffmpeg', 'ffprobe'):
    (report['ok'] if have_cmd(tool) else report['missing']).append(tool)
if have_cmd('node'):
    v = subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()
    major = int(v.lstrip('v').split('.')[0]) if v else 0
    (report['ok'] if major >= 18 else report['missing']).append(f'node {v}' if major >= 18 else f'node>=18 (found {v})')
else:
    report['missing'].append('node')
chrome_paths = [os.environ.get('CHROME_PATH', ''),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
chrome = next((p for p in chrome_paths if p and os.path.exists(p)), None)
(report['ok'] if chrome else report['missing']).append(f'browser: {chrome}' if chrome else 'chrome')
for m in report['missing']:
    key = 'ffmpeg' if m.startswith('ff') else 'node' if m.startswith('node') else 'chrome' if m == 'chrome' else None
    if key: report['actions'].append(f'install {key}: {INSTALL[key].get(OS, "see vendor site")}')

# ---------- GPU ----------
gpu = None
if have_cmd('nvidia-smi'):
    r = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], capture_output=True, text=True)
    gpu = r.stdout.strip().splitlines()[0] if r.returncode == 0 and r.stdout.strip() else None
report['gpu'] = gpu or 'none detected (transcription/alignment will run on CPU - slower but fine)'

# ---------- python packages ----------
PKGS = {'numpy': 'numpy', 'PIL': 'pillow', 'scipy': 'scipy', 'stable_whisper': 'stable-ts'}
missing_py = [pip for mod, pip in PKGS.items() if importlib.util.find_spec(mod) is None]
if missing_py and not CHECK_ONLY:
    print('installing python packages:', missing_py)
    run([sys.executable, '-m', 'pip', 'install', '--upgrade', *missing_py])
    missing_py = [pip for mod, pip in PKGS.items() if importlib.util.find_spec(mod) is None]
for mod, pip in PKGS.items():
    (report['missing'] if pip in missing_py else report['ok']).append(f'py:{pip}')
if importlib.util.find_spec('torch'):
    try:
        import torch
        cuda = torch.cuda.is_available()
        report['ok'].append(f'torch {torch.__version__} (cuda={cuda})')
        if gpu and not cuda:
            report['actions'].append('NVIDIA GPU found but torch is CPU-only. For ~10x faster alignment run: '
                                     f'{sys.executable} -m pip install --force-reinstall torch torchaudio --index-url https://download.pytorch.org/whl/cu128')
    except Exception as e:
        report['missing'].append(f'torch import failed: {e}')

print(json.dumps(report, indent=1))
sys.exit(1 if report['missing'] else 0)

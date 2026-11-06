#!/usr/bin/env python3
"""berat studio: berat studio 0.20.0 without its window. Every command runs the app's own code (appcore/cli.cjs),
so projects, voiceovers, Claude builds, sound and exports come out exactly as in the app.

  python studio.py styles                         the styles (pixel-art, collage, flat, stickman, recon, lowpoly, toon,
                                                  blender, mega, stickstory, vox)
  python studio.py looks <style>                  a style's looks (presets)
  python studio.py list                           the projects in the workspace
  python studio.py new <name> --style <id> [--length 60] [--format vertical|landscape] [--lang en] [--look <preset>]
                         [--topic "..."] [--brief "..."] [--script-file f.txt]
  python studio.py import <folder>                register a project folder (one made in the app, for example)
  python studio.py use <name>                     the project the suite MCP tools work on in an interactive session
  python studio.py levels <name>                  the build quality levels of its style
  python studio.py run <name> script|build|edit|ask|ultra [--level standard|props|polish|scenes|ultra|ultraplus]
                         [--notes "..."] [--model id] [--effort low|medium|high]
                                                  Claude Code, run exactly as the app runs it (prompt, tools, agents, hooks)
  python studio.py voice <name> [--provider elevenlabs|file --file a.wav]   the voiceover (then cleaned and timed)
  python studio.py audio <name>                   Clean and time (the app's clean + timeline steps)
  python studio.py sound <name>                   Music & effects (the app's sound step)
  python studio.py export <name> [--stems] [--silent] [--from s --to s]     out/<name>.mp4 (--silent: no sound track)
  python studio.py stills <name> <t> [t ...] [--scale 0.5]
  python studio.py flow-open                      open Google Flow's Chrome window (sign in once, finish a check)
  python studio.py kit [folder]                   write the app's Style Kit (build custom styles there with cz)
  python studio.py import-style <zip>             add a custom style package (the app's import checks first)
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(ROOT, 'appcore', 'cli.cjs')


def cli(*args):
    r = subprocess.run(['node', CLI, *args], cwd=os.path.join(ROOT, 'appcore'))
    if r.returncode: sys.exit(r.returncode)


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help', 'help'): print(__doc__); return
    if a[0] == 'audio':                                   # the editor's "Clean and time"
        cli('step', a[1], 'clean'); cli('step', a[1], 'timeline'); return
    if a[0] == 'sound': cli('step', a[1], 'sound'); return
    cli(*a)


if __name__ == '__main__':
    main()

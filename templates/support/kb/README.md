# Help library: maintainer notes
keywords: -

This folder is the help library of the in-app **Help** assistant (sidebar > Help). The assistant runs with no tools and no
files: it knows ONLY the articles here, picked per question by keyword match (title + `keywords:` line weigh most, the
body a little). So every article must be correct for the app as members see it today. A wrong label is worse than a
missing article. This README is not an article: the assistant skips `README.md`.

## Format of an article (kb-check enforces it)

```
# Title                                   <- line 1: what a member would call the topic
keywords: grain, noise, grainy, ...       <- line 2: the words members actually type
platforms: both                           <- line 3: both | windows | mac
                                          <- line 4: blank
Body: one short intro sentence, then short numbered steps and bullets.
```

- One topic per file, kebab-case file name (`export-problems.md`). Error catalogs are `errors-<area>.md`.
- Keywords: 15-40 terms. Synonyms, slang, misspellings and symptoms ("grain", "noise", "blurry", "laggy",
  "stuck at 40%", "black screen", "won't export", "can't log in"), the exact UI labels, distinctive words of error messages.
- Exact labels in bold, exactly as the app renders them (case, punctuation, "…"). Paths as **Settings > System > Graphics**.
- `platforms: windows` / `mac` articles are only offered to members on that system; most articles are `both` with
  "On Windows: ... / On Mac: ..." steps inside.
- Error articles: one `## ` block per error with the message on `> ` quote lines, then "What it means" and numbered
  "Fix" steps. Quote lines are matched as a phrase against a pasted error, so copy the app's text exactly (even when it
  names an old menu path: correct the path in the Fix steps instead), and put variable parts (names, times, numbers)
  only at the ends: a message with a variable part in the middle gets one quote line per stable part, e.g.
  `> A scene throws an error at ...` and `> ... so the video cannot be exported ...`. Each quote line needs at least
  12 letters.
- Under ~350 words per article, so several fit in one answer. Split rather than grow.
- Where the fix needs us: "Click **Help > Report a problem** so it gets fixed."

## Rules

- Only write what the app really does. Verify every label, default and limit in the code (renderer pages, the settings
  index, styles, presets) or on screen before writing it. If you can't verify it, leave it out.
- Both systems, always. Where steps differ: "On Windows: ... / On Mac: ...". Shortcuts as "Ctrl/⌘ + K" (Alt/⌥),
  OS words both ways (PowerShell/Terminal, File Explorer/Finder, Recycle Bin/Trash). Install commands only exactly as the
  app shows them (the install commands file and the Claude connection file in the app code). Never send a Mac member to
  PowerShell or winget.
- No internals, strictly: no source paths or code file names, engine names or versions, skill names or contents,
  prompts, model ids, agent/model architecture, MCP, IPC, database, the app framework, release process, licence-check
  internals, our own keys, how styles are built. Names the UI itself shows members are fine (Claude Code, Opus/Sonnet/Haiku
  in the Model setting, ElevenLabs, Higgsfield, Google Flow, Whisper, ...). Members' own files (their projects folder,
  exported videos) are fine. When in doubt, leave it out. The assistant's context is only this folder, so whatever is
  written here can be shown to any member.

## kb-check

```
node scripts/kb-check.mjs           # check
node scripts/kb-check.mjs --stamp   # check, then record the UI files' hashes (only when the library matches the app)
```

- Fails (exit 1) on a format error or a banned internal term. The banned list is in the script (plus every built-in
  skill folder name, read live): add to it when you spot a new kind of leak.
- Warns (exit 0) about: settings from the settings index and sidebar pages that no article mentions, thin keyword lines,
  articles over ~380 words, platform slips (PowerShell without Terminal, Ctrl without ⌘, winget without Homebrew).
- Staleness: `.kb-stamp.json` holds a hash of each UI file the library describes (every renderer `.tsx`, the settings
  index, the plan helper, styles, presets, the install commands and the Claude connection file). A normal run prints
  "KB may be stale for: ..." with every file changed since the last `--stamp`.

## Upkeep (every release)

1. Run `node scripts/kb-check.mjs`.
2. For each UI change under `## Unreleased` in the changelog (and each file kb-check lists as stale): update the
   article that describes it, or add one. New setting = mention its exact title, tab and what it does. New error
   message a member can see = add it to the matching `errors-*.md`.
3. Run it again until it passes with no "not mentioned" warnings, then `node scripts/kb-check.mjs --stamp` and commit
   the stamp with the articles.
4. Read the Help log now and then (`<userData>/support/log.jsonl`: each question, the articles it matched, answered or
   not, and the member's thumbs up/down) and write the articles for what it could not answer.

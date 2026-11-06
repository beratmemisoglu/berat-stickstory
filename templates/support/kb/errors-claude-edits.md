# Claude edit errors and usage limits
keywords: usage limit, limit reached, out of usage, resets at, rate limit, rate-limiting, 429, overloaded, 529, claude is already working, claude is working, press stop, busy, git is not installed, can't revert, cannot be reverted, re-apply, no shots to upgrade, ultraedit, unexpected format
platforms: both

## Usage limit reached
> Your Claude usage limit is reached. It resets at ...
> Your Claude usage limit is reached for now. Try again later, or pick a lighter model in Settings.

What it means: your own Claude plan's limit is used up for now. It is your Claude account's limit, not a berat studio one.

Fix:
1. Wait until the time shown, then try again. Edits made before the limit stay listed and can be reverted.
2. Meanwhile pick a lighter model in **Settings > AI engines > Model**.

## Overloaded or rate-limited
> Claude is overloaded right now. Try again in a minute.
> Claude is rate-limiting requests right now. Try again in a minute.

Fix: wait a minute and try again.

## Claude is already working
> Claude is already working on this project. Wait for it to finish or press Stop.
> Claude is working on this video. Change ...
> ... when it has finished (or press Stop in the Claude panel).

What it means: one Claude job at a time per project.

Fix: wait until it finishes, or press **Stop** in the Claude panel, then try again.

## Git is not installed
> Git is not installed, so edits cannot be reverted.

Fix:
1. On Windows, in PowerShell: `winget install --id Git.Git -e`. On Mac, in Terminal: `xcode-select --install`
2. Restart the app and check **Settings > System > System check** (Git row green).

## An edit can't be re-applied or undone
> Later edits changed the same lines, so this edit cannot be re-applied automatically. Ask Claude to redo it instead.
> This edit is already undone (reverted or restored past). Use Re-apply to bring it back.
> This edit changed no files.

Fix: follow the message: ask Claude to make the change again, or use **Re-apply**. An edit that changed no files has nothing to undo.

## No shots to upgrade
> There are no shots to upgrade yet: build the video first.

Fix: build the video first, then run Ultraedit.
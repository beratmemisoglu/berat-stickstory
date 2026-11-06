# Claude Code connection errors
keywords: claude not found, claude code is not installed, not signed in, login, logged out, could not reach claude, credit balance, api key, where.exe claude, which claude, tool paths, not allowed to run, PATH
platforms: both

## Claude Code is not installed
> Claude Code is not installed. Install it ...
> ... then restart the Suite.

What it means: the app can't find Claude Code on this computer. It uses your own Claude Code and Claude plan.

Fix:
1. On Windows, in PowerShell: `irm https://claude.ai/install.ps1 | iex`. On Mac, in Terminal: `curl -fsSL https://claude.ai/install.sh | bash`
2. Restart berat studio.
3. Already installed? On Windows run `where.exe claude` in PowerShell; on Mac run `which claude` in Terminal. Paste the path it prints into **Settings > System > Tool paths** (the claude field).

## Claude is not signed in
> Claude is not signed in (or its sign-in ran out). Sign in with Claude in Settings > AI engines, then try again.

Fix:
1. Open **Settings > AI engines** and click **Sign in with Claude**.
2. Finish the sign-in in your browser, then try again.

## An API key with no credit
> Claude Code is signed in with an Anthropic API key that has no credit left, not your Claude plan.

Fix: in **Settings > AI engines** click **Sign out**, then **Sign in with Claude**.

## Sign-in could not be refreshed
> Claude Code could not refresh its sign-in because another Claude Code process was doing the same.

Fix:
1. Wait a minute and try again.
2. Keeps happening? Close other Claude Code windows, or sign in again in **Settings > AI engines**.

## Could not reach Claude
> Could not reach Claude. Check your internet connection and try again.

Fix: check the internet connection. A VPN, firewall or antivirus can block it too: allow berat studio there.

## A tool can't be started
> ... was not found on this computer. Install it, or set its path in Settings > System > Tool paths.
> ... is not allowed to run (no permission to execute it).
> ... could not be started: a folder in its path is actually a file.

Fix:
1. Open **Settings > System > System check**: missing tools show their install command. Install, restart the app, press **Run checks**.
2. Not allowed to run: reinstall that tool.
3. Check the paths in **Settings > System > Tool paths** (an empty field means found automatically).

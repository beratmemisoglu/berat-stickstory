# Claude not installed or not signed in
keywords: claude not installed, claude code is not installed, install claude, sign in, sign in with claude, login, log in, can't log in, not signed in, claude not signed in, claude not found, claude missing, binary not found, connect claude, authorize, sign in again, logged out, sign out, api key, billed as api credit, send code, sign-in code, claude connected, connection, claude subscription
platforms: both

Toon Studio uses **your own Claude Code** with your own Claude plan, so it has to be installed on this computer and signed in.

## Install Claude Code

1. Open **Settings > System > System check**. If the Claude Code line says "Claude Code is not installed", click **Copy install command**.
2. Run it:
   - On Windows, in PowerShell: `irm https://claude.ai/install.ps1 | iex`
   - On Mac, in Terminal: `curl -fsSL https://claude.ai/install.sh | bash`
3. Restart Toon Studio.

Already installed but the app can't find it? Find its path (On Windows, in PowerShell: `where.exe claude` / On Mac, in Terminal: `which claude`) and paste it into **Settings > System > Tool paths**, in the **claude** field.

## Sign in

1. Go to **Settings > AI engines > Claude** and click **Sign in with Claude** (or **Sign in** under **Connect Claude** on Home).
2. A Claude sign-in page opens in your browser. Click **Authorize** there, then come back to the app.
3. Browser didn't open? Click **Open the sign-in page**.
4. Seeing a page with a code? Paste the code into the field in Settings and click **Send code**.

When it works, Settings says **Signed in (Claude subscription)** and the button at the bottom of the sidebar says **Claude connected**. That button ("Claude not signed in" when you are not) always opens this setting.

## "Sign in again" in the Claude panel

Your sign-in ran out. Click **Sign in again** and finish the steps above.

## "API key, billed as API credit"

Claude Code is signed in with an API key, so your edits cost API credit. Click **Sign out**, then **Sign in with Claude** to use your Claude plan instead.

## Still stuck?

In **Settings > General > Workspace** click **Copy diagnostics**, then click **Help > Report a problem** so it gets fixed.

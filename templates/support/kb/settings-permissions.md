# Permissions: what Claude may do without asking
keywords: permissions, permission, ask, ask before commands, ask for everything, automatic, approve, approval, allow, deny, prompts, claude keeps asking, claude asks permission, stop asking, unattended builds, commands, web access, safety, safe, trust, someone else's project
platforms: both

**Settings > AI engines > Permissions** sets what Claude may do without asking. Edits always stay inside the project folder, and every edit can be reverted.

## Options

- **Automatic** (default): edits and commands run without prompts. Recommended for builds you leave running.
- **Ask before commands**: file edits are automatic; shell commands and web access ask first. Good for projects someone else made.
- **Ask for everything**: every edit and command asks for approval in the Claude panel.

## When Claude asks

In the project's Claude panel, click **Allow** or **Deny**. With an Ask option, check the Claude panel now and then during long builds.

## Tips

- Claude keeps stopping to ask? Pick **Automatic**.
- Opened a project folder you got from someone else? Pick **Ask before commands** first.

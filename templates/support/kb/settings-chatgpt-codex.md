# ChatGPT (Codex) as the AI engine
keywords: chatgpt, codex, openai, gpt, gpt-6, gpt 6, astra, sol, luna, chatgpt plus, chatgpt pro, use chatgpt, instead of claude, ai engine, other models, install codex, codex not installed, too old, install for me, sign in with chatgpt, use a code instead, codex usage, check again, node.js, npm, chatgpt not working
platforms: both

**Settings > AI engines > ChatGPT (Codex)** runs edits, questions, scripts and builds on ChatGPT's models with your own ChatGPT plan instead of Claude. The app drives OpenAI's Codex app, which you install and sign in to. Ultraedit, the Style Studio and character design stay on Claude.

## 1. Install Codex

Codex needs Node.js (see "System check and missing tools").

- Click **Copy** and run the command (On Windows: in PowerShell / On Mac: in Terminal): `npm install -g @openai/codex`
- Or click **Or let the app install it**, then **Install for me**.

Then click **Check again**. "Installed, but too old": copy and run the command shown (`npm install -g @openai/codex@latest`), then **Check again**.

## 2. Sign in

1. Click **Sign in with ChatGPT** and finish in your browser.
2. The browser doesn't come back? Click **Use a code instead**, open the page and enter the code shown.

It should say **Signed in with ChatGPT**. "Signed in with an API key (billed as API credit)": click **Sign out**, then **Sign in with ChatGPT** to use your plan.

On Windows the app also checks that Codex keeps its changes inside the project before the first run (**Check now**). If that check fails, ChatGPT is off on this computer and the line says why.

## 3. Use it

- Models: **GPT-6 Astra**, **GPT-6.1 Sol**, **GPT-6 Luna**. Pick one in **Settings > AI engines > Model** (group "ChatGPT") or in a project's Claude panel.
- On Plus, GPT-6.1 Sol goes furthest; GPT-6 Astra is for the hardest edits.
- **Effort** sets Codex's reasoning effort.
- **Codex usage** shows your plan's Codex limits on chatgpt.com.

Edits stay inside the project folder and every edit can be reverted. To go back to Claude, pick a Claude model under **Model**.

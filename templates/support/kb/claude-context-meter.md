# Context meter: Claude's conversation and usage
keywords: context meter, context, context bar, tokens, token usage, conversation full, context full, too long, summarised, summarized, summary, compact, compacting, usage, how much did that use, plan limit, usage limit, 5-hour limit, weekly limit, limit reached, resets, new conversation, fresh conversation, start over, cache, claude forgot, measuring, no usage recorded
platforms: both

Each project has one ongoing conversation with Claude, so it remembers your edits. The thin bar under the Claude panel's header shows how big that conversation is.

## Reading the bar

- It reads like "**N** / **M** context": N is the conversation's size now, M is the point where it gets summarised.
- "Measuring…" or "No usage recorded yet": the numbers come after Claude's next request.
- "New conversation on your next request": you pressed **+** (New conversation).

## When it gets full

At the summary point the conversation is summarised automatically, so Claude can keep working. When a conversation has grown that long, your next request starts a fresh conversation with a short summary of your edits. This keeps your Claude usage down. Your video and all edits stay exactly as they are.

## Details (click the bar)

- **Claude's conversation** (or **Ultraedit's conversation**) and the model.
- How far it is to the summary point, in tokens and percent.
- **This run so far** / **Last run**: **New input**, **Read from cache**, **Read fresh**, **Written by Claude**, **Images sent**.
- **This conversation** (every request counted) and **Cache hit**.
- Your plan's limit, for example "**5-hour limit**: 40% used, resets 3:00 PM" (also **Weekly limit**, **Weekly Opus limit**, **Weekly Sonnet limit**). It shows only when Claude Code reports it, with a claude.ai sign-in.
- **Start a fresh conversation**: same as **+** in the header.

## Good to know

- Starting fresh never undoes anything: only the chat starts over. Old conversations stay under **History** > **Conversations**.
- Switching this project's model re-reads the conversation once, so that one request uses a little more of your plan.
- Hit your plan's limit? Wait until the time shown, or pick a lighter model (see "Claude panel").

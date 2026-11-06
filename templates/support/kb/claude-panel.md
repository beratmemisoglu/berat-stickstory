# Claude panel: asking for changes
keywords: claude panel, chat, ask claude, instruction, prompt box, apply, send, question, ask mode, ask a question, scope, selection, shot, whole video, suggestions, queue, queued, run queue, stop claude, cancel, claude stuck, not responding, working forever, new conversation, start over, history tab, allow, deny, permission, paste image, attach screenshot, model picker, effort, chatgpt, sign in again, remember rule, keep rule
platforms: both

The Claude panel is on the right of the editor (Ctrl/⌘ + J hides or shows it). It has two tabs: **Chat** and **History**.

## Asking for a change

1. Select something in the preview or on the timeline, or nothing for the whole video.
2. Under the box, pick the scope: **Selection**, **Shot** or **Whole video**.
3. Type the change and press Enter or **Apply** (Shift + Enter = new line). Ctrl/⌘ + I jumps to the box.
4. You see the step Claude is on (the earlier ones fold into **N earlier steps**, click to open) and the frames it checked (click one to jump there). The result shows **Applied**, Before / After, **View changes** and **Revert**.

Empty box? Click a suggestion above it.

## Questions only

Click the **?** button under the box. The button becomes **Ask** and Claude answers without changing anything. The wrench button switches back to edits.

## Pictures

Paste an image (Ctrl/⌘ + V) or drop image files on the box: up to 4 go with that request. A dropped video, audio file or PDF becomes a reference (see "References").

## Queue and Stop

- While Claude works the button says **Queue**: new requests wait under **Queued** and run in turn. Remove one with its x, or **Clear** them all.
- **Stop** ends the current run. Queued requests are kept: press **Run queue** to go on.

## Model and effort for this video

The two menus under the box set this project's model (Opus 5.5, Sonnet 5.5, Haiku 5.5, and ChatGPT models when set up) and effort. **Global setting** follows **Settings > AI engines**. The chip in the header shows what it runs on.

## Cards in the chat

- **Claude wants to: …** with **Allow** / **Deny**: when **Settings > AI engines > Permissions** asks first.
- **Remember for this video?** (or all videos): **Keep rule** saves it to Memory, **Dismiss** drops it.
- **Sign in again**: your Claude sign-in ran out.

## Claude seems stuck

1. Click **Stop**, then send the request again.
2. Press **+** (New conversation): the chat starts over, your video and edits stay.
3. Usage limit reached? Click the context meter under the header to see when it resets (see "Context meter").

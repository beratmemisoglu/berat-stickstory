# Trim silences
keywords: trim silences, silence, silences, pauses, cut pauses, remove pauses, shorten pauses, dead air, gaps, long pauses, too slow, slow pacing, snappy, tighten, jump cut, trim, reset trim, undo trim, pauses back, video too long, trim silences missing
platforms: both

Cuts part of every pause in the voiceover so the video stays snappy. Your original recording is kept.

1. Once **Audio cleaned** is done, click **Trim silences** below the Pipeline steps.
2. The waveform shows in red what will be cut. The line under it says how many pauses are cut and how many seconds it saves.
3. Adjust:
   - **Silence below**: how quiet counts as a pause (-60 to -20 dB, default -40 dB).
   - **Shortest pause to cut**: shorter pauses stay (100 to 1500 ms, default 350 ms).
   - **Amount removed**: how much of each pause goes (0 to 100%, default 70%).
4. Click **Apply**. The audio is cleaned again with those cuts.

Only pauses between words are cut, never before the first word or after the last. Speech keeps 20 ms on each side of a cut and every joint gets a 20 ms crossfade, so nothing clicks.

**Reset** puts every pause back: the voiceover is untouched again.

## After Apply

- Words already timed? Their times move with the cuts, so the scenes keep following the narration, and so does the captions file (.srt) the export saves. Then mix again: **Sound design mixed > Redo**.
- Words not timed yet? Run **Words timed** next.
- Audio layers you placed move with the narration.

## Already trimmed?

A project's first voiceover from the Voiceover window (with **Then clean the audio and time the words** ticked) is trimmed with the defaults. The panel then says "Applied: 70% of pauses over 350 ms". Open **Trim silences** to change it, or **Reset** for no trimming.

Can't see the button? The Pipeline hides when the window is narrow: make the window wider.

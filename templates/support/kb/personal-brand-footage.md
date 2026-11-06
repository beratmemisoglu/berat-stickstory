# Personal Brand: footage
keywords: footage, add footage, drop footage, import footage, recordings, screen recording, facecam, face cam, camera clips, several facecam clips, multiple recordings, multi-recording, intro, other, role, wrong role, obs, preview copy, preparing preview, proxy, file missing, remove footage, mark screen recording, mp4, mov, mkv, audio file, footage won't play
platforms: both

The **Footage** tab (left side of the Personal editor) lists the files of this video and what each one is.

## Add footage
- Drop the files anywhere on the editor, or click **Add** in the **Footage** tab.
- Video: mp4, mov, mkv, m4v, webm, avi, mts, m2ts, mxf. Audio: wav, mp3, m4a, aac, flac.
- The files stay where they are: the app never moves, changes or deletes them.

## Roles
Under each file, pick what it is:
- **Screen recording**: your screen with your mic. Its sound is the video's sound. Several screen recordings are fine: they are parts of one recording, played in name order.
- **Facecam**: camera clips. You can add many: **Cut the footage** syncs them into one.
- **Intro**: your separate intro read (only one file).
- **Other**: anything else.

The app guesses the roles from the file names (a name with "intro" is the intro; names like "screen", "recording", "OBS" or "capture" are the screen recording; other video files are facecam). Check them before you start a workflow.

"Mark one file as the screen recording: its sound is the video's sound": change one file's role to **Screen recording**.

## Preview copies
Some camera and screen files can't be played directly, so the app makes a preview copy: **Preview copy N%** under the file, **Preparing preview** on the player. The final render always uses your original files at full quality.
- **Waiting…**: it starts after the others.
- A failed copy shows the reason and **Retry**.
- The **GPU** / **CPU** badge at the top says what makes the preview copies and the final render. CPU is slower.

## Other messages
- **file missing**: the file was moved, renamed or its drive is unplugged. Put it back, or remove it and add it again.
- "(made by Claude)": a file a workflow made, like the edited intro. Its role can't be changed.
- The bin button removes a file from this video only; the file itself is untouched.

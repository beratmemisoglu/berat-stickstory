# AI voices: ElevenLabs, Fish Audio and the local voice
keywords: elevenlabs, eleven labs, 11labs, fish audio, fishaudio, local voice, free voice, offline voice, voice id, api key, add key, cloned voice, my clone, voice clone, voice model, stability, similarity, speed, voice too fast, voice too slow, robotic voice, sample, preview voice, characters left, not enough characters, not enough credit, refresh voices, new take, regenerate, redo voice, redo one line, character voices, characters, dialogue, two voices, several voices, multiple voices, another voice for a line, kid voice, villain voice, speaker, [name], beat, beats, pause, silence, silent moment, longer pauses, pause between sentences, pacing, slower pacing, video too short, (beat 3s)
platforms: both

In the Voiceover window pick a tab and a **Voice**, then click **Make the voiceover**. The play button next to the voice plays a sample.

## ElevenLabs

1. Click **Add ElevenLabs key** (**Get a key** opens the page on ElevenLabs). The key is stored encrypted on this computer.
2. Pick a **Voice** (your cloned and designed voices come first) and a **Model**. Just made a voice there? Click **Refresh list**. If your key may not list voices, paste a voice ID instead.
3. **Voice settings**: **Stability**, **Similarity**, **Style exaggeration**, **Speed**, **Speaker boost**. **Reset to the defaults** puts them back.

It uses your account's characters; the window shows about how many.

## Fish Audio

Click **Add Fish Audio key**, then pick a voice (yours first, then popular ones) or click **Paste a voice link** (https://fish.audio/m/…) and **Use it**. Choose a **Model** and a **Speed**. It uses your account's API credit; the window shows the cost. A pause written as a lone "..." no longer stops the voiceover (Fish's Drama 3 voice returns silence for it); those parts are skipped automatically.

## Local voice (free)

Click **Install local voice** once (a download, then it runs offline). Pick a voice (**Best** marks the most natural ones) and a **Speed**. It reads English and a few other languages; the window says when it can't read your video's language.

Set your default voices in **Settings > Media > Voiceover**.

## Character voices (dialogue)

A story can have characters who speak in their own voices. In the script, start a line with the character's name in square brackets: `[Mia] You did WHAT?` (or `[Mia]: You did WHAT?`). That line is spoken in Mia's voice; everything else is the narrator. The name is never read out.

- The Voiceover window then shows **Character voices**: each character, how many lines they have, a voice picker (voices of the same service as the narrator) and a play button for a sample. With Fish Audio, **Paste a voice link** takes any voice from its library.
- A character without a voice of their own is read by the narrator's voice (the window says so).
- Each character's voice is made as its own part, brought to the narrator's loudness and joined in script order. Your picks are kept with the project, so making the voiceover again uses them.
- Notes at the start of a line, like `[Pause]`, `[SFX]` or `[B-roll: a street]`, are not characters. Names start with a capital letter.

## Beats and pauses

- **Beats** (silent moments for action): put a line that is only a pause with a length, like `(beat 3s)`, `(pause 2.5 s)`, `(beat 4 seconds)` or `[beat 3]`, and that much silence is added at that point. `(beat)` alone is 1.5 s, `(long pause)` 2.5 s. A plain `(pause)` is only a note, as before. Beats are never read out or counted as words; **about this long** includes them ("Includes 2 beats: 6 s of silence"). Clean and **Trim silences** never shorten them.
- **Pause between sentences** (under the voice): **Short** keeps the voice's own pace. **Natural** (0.75 s) and **Long** (1 s) give every sentence a pause of its own, longer at a blank line; they're made sentence by sentence. Stick stories start on Natural, other styles on Short; your pick is remembered per style.

## Redoing the voiceover

- There's no button to redo one line: change the line in the script, then make the voiceover again. With ElevenLabs and Fish Audio, parts that didn't change are reused for free.
- Same text, different take? Tick **Make every part new (a new take, charged again)**.

## Messages

- "Not enough characters left" (ElevenLabs) or "Not enough credit left" (Fish Audio): it stops part way; the parts made so far are kept and reused when you continue. Top up on their site.
- "ElevenLabs did not accept this key" or "Fish Audio did not accept this key": copy the whole key again.
- "… is no longer on your ElevenLabs account": pick another voice.

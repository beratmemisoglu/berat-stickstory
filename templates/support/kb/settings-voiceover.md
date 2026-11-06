# Voiceover settings: voice services, keys, default voice
keywords: voiceover settings, voice, voices, default voice, narrator, narration, tts, text to speech, elevenlabs, eleven labs, elevenlabs key, fish audio, fish, fish audio key, local voice, kokoro, free voice, offline voice, install local voice, api key, add key, my recording, voiceover dialog opens on, clean the audio and time the words, default voices for, cloned voice
platforms: both

**Settings > Media > Voiceover** sets up the voice that reads your scripts. The Voiceover step in the editor opens the Voiceover dialog that uses these settings.

## General

- **The Voiceover dialog opens on**: **Automatic** (default: ElevenLabs once it has a key, else Fish Audio once it has one, else the local voice once installed, else your recording), **My recording**, **ElevenLabs**, **Fish Audio** or **Local voice**.
- **Clean the audio and time the words right after** (on by default): needed before Claude builds the scenes. Switch it off to check the voiceover first.
- **Default voices for** (only with Several languages): each language keeps its own default voices.

## ElevenLabs

Your own account, its voices (also ones you cloned or designed).
1. Click **Add key** next to **ElevenLabs API key**, click **Get a key**, paste it and click **Save key**.
2. Then pick your default voice and model. The dialog also remembers the last ones you used.

## Fish Audio

Your own account: natural voices in 80+ languages (your clones too), on its API credit (about $15 per million characters). Add the key the same way next to **Fish Audio API key**; the row then shows the credit left. Pick your default voice and model.

## Local voice

A free voice that runs on this computer, offline: English (US and UK), Spanish, French, Italian, Portuguese and Hindi.
- Click **Install local voice** (a download plus a small Python package). **Stop** cancels; **Try again** if it failed.
- Once installed you pick its default voice and speed. **Remove** deletes it (getting it back is a new download).

Keys are checked, then stored encrypted on this computer. **Change** replaces a key.

Your own voice service: see "Custom APIs: your own picture or voice service".

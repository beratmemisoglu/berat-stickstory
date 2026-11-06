# Voiceover: making or adding the narration
keywords: voice, voiceover, voice over, narration, narrator, tts, text to speech, ai voice, elevenlabs, eleven labs, fish audio, local voice, free voice, my recording, upload audio, my own voice, mp3, replace voiceover, new voiceover, change voice, voiceover stopped, voice failed, voiceover button missing, clean and time, words not heard
platforms: both

Open it from the Pipeline: **Voiceover added > Add** (later **Replace**). Window too narrow to show the Pipeline? Use the **Voiceover** button (sound-wave icon) at the top of the editor.

## Where the voice comes from

- **My recording**: your own audio file(s). See "Voiceover from your own recording".
- **ElevenLabs** and **Fish Audio** (your own account), **Local voice** (free, on this computer). See "AI voices: ElevenLabs, Fish Audio and the local voice".
- **Custom API**: only after you set one up in **Settings > Media > Custom APIs** (at your own risk).

The window opens on this video's choice (**Project settings > Voiceover**), else on **Settings > Media > Voiceover** > **The Voiceover dialog opens on**.

## Good to know

- AI voices read your script. No script yet? The window offers **Write the script**, or switch to **My recording**.
- Keep **Then clean the audio and time the words** ticked: Claude needs it before it builds the scenes.
- It keeps going if you close the window (not if you quit the app). **Stop** keeps the parts already made.
- Replacing a voiceover moves the old one to the Recycle Bin (Windows) or the Trash (Mac). Built scenes follow the new words, but shot lengths change with the new pacing.
- While Claude works on the project, wait: a new voiceover changes the timing it builds to.
- Not ticked to clean and time? A bar under the preview says so: click **Clean and time**.

## Problems

- **Voiceover stopped** on the step: click **View**, then **Try again**.
- "The script changed while it was being read": make the voiceover again for the new text.
- "Timed, but N of M words of the script were not heard": check that the voiceover says the script as written, in the video's language. Those words' times are guessed.
- "Python was not found" (local voice): see "System check and missing tools".

# Routine nodes: script, voice, build, render
keywords: routine nodes, production, write script, script rules, banned words, voiceover node, routine voice, elevenlabs, fish audio, local voice, kokoro, clean audio, time words, build video, build quality, quality check, layout problems, sound design, render node, 4k, captions, vertical version, trailer, crop, fit on blur, reframe, end card, words timed, only % of the script's words
platforms: both

These nodes work on the project a **Create project** node made, in the order they are connected.

## Script
- **Write script**: Claude researches and writes it (skipped when the video has one). **How to write it** (**Balanced**, **Deep research, fact-checked**, **Fast draft**, **Human and conversational**), **Notes for Claude**, **Length within** (%), **Rewrites when off**, **Write it even if there is a script**, **Scripting skill** (yours from Settings > AI engines, this node's own, or none).
- **Script rules**: hard rules. Banned and required words, **Longest sentence**, **At least** / **At most** words, **When a rule fails** (**Ask Claude to fix it**, **Stop this video**, **Continue with a warning**), **Fix attempts**.

## Voice
- **Voiceover**: reads the script aloud, then cleans and times it. **Voiceover service** (**Automatic (ElevenLabs, else Fish Audio, else local)**, **ElevenLabs**, **Fish Audio**, **Local voice (Kokoro)**), the voice and model, **Speed**, **Words timed at least** (%). Keys and the local voice: **Settings > Media > Voiceover**.
- **Clean audio**: noise and levels; **Tighten long pauses**.
- **Time words**: times every word the build syncs to; **Script words timed at least** (%).

"Only N% of the script's words were heard": the narration doesn't match the script well enough. Check the recording, or lower the percentage.

## Build and check
- **Build video**: Claude builds every scene. **Build quality** (the same slider as the editor's Build dialog), the real footage switch, **Your own instructions**.
- **Quality check**: **Layout problems allowed**, **Length within**, **Play every frame for scene errors**, **Check for blank shots**, **When a check fails**, **Fix attempts**.
- **Sound design**: music, ambience and effects under the voice. **Stop if the voice is not clearly above the music**.

## Render
- **Render**: exports the video. **Quality** (**Full HD** / **4K**), **Captions file (.srt)**, **File name**, and Claude fixes a scene that breaks the export.
- **Vertical version**: a 9:16 version. **How** (**Cut (crop or fit)** / **Reframe (Claude lays it out again)**), **Fit** (**Crop to fill** / **Fit on blur**), **Length** (**Full video** / **Trailer (first part)**, 10-60 s), **Captions burned in**, **End card**.

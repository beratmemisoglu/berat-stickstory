# Export and render errors
keywords: export failed, render failed, won't export, wont export, export stuck, scene throws an error, scene stopped responding, loop, renderer stopped responding, no shots to render, old narration, time words
platforms: both

## Graphics card reset or stuck renderer during an export

If the graphics card resets or the renderer gets stuck during an export, the export now keeps what it already rendered and finishes the rest by itself. Every finished video is checked (full length, not black, has sound) before it's saved; a bad file is fixed or refused with the reason.

## A scene throws an error
> A scene throws an error at ...
> ... so the video cannot be exported ...

What it means: one moment of the video breaks while the export draws it.

Fix:
1. Usually nothing to do: Claude fixes it by itself (you see it in the Claude panel) and the export starts again.
2. If it still fails, type in the Claude panel: "fix the error at" plus the time from the message. Then export again.

## A scene stopped responding
> A scene stopped responding at about ...
> ... while the video was exporting, most likely a loop that never ends.

What it means: one scene never finished drawing a frame at that time.

Fix:
1. Ask Claude to check the scene at that time for a loop that never finishes.
2. Export again.

## The preview renderer stopped responding
> The preview renderer stopped responding (the scene took too long to load or draw: a slow graphics card, or a scene stuck in a loop).

What it means: the part of the app that draws the video froze.

Fix:
1. If it stops at the same moment every time, ask Claude to check that scene for a loop, then export again.
2. Still failing? Click **Help > Report a problem** so it gets fixed.

## No shots to render
> This video has no shots to render: its scenes failed to load, or there are none yet.

Fix:
1. If the video was never built, build it first.
2. If the editor shows **Preview warnings**, click **Fix with Claude**, wait, then export again.

## The narration is not ready
> The voiceover changed after the audio was cleaned: press Clean and time ...
> The words of this voiceover are not timed yet: press Time words ...

What it means: the video would still use the old narration or timing.

Fix:
1. Press **Clean and time** (or **Time words**) under the preview in the editor.
2. When it is done, export again.

## An export is already running
> An export is already running.

Fix: wait for that export, or cancel it in its Export dialog, then start again.

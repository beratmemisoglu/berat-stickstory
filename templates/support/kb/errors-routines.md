# Routine errors
keywords: routine failed, routines, node failed, routine stopped, no project yet, no voice is set up, narration not ready, words heard, claude gave no title, rendered video, allow uploads, youtube channel, not a routine, import routine, premium
platforms: both

## Routines are Premium
> Routines is a Premium feature. Upgrade to Premium on Skool to unlock it.

Fix: upgrade to Premium on Skool.

## A node is in the wrong place
> There is no project yet: put a Create project before this node.
> There is no script to read: put Write script (or My script) before it.
> The narration is not ready (cleaned and timed). Put Voiceover (or Clean audio + Time words) before it.
> There is no rendered video: put a Render before it.

Fix: add the node the message names before this one, then run the routine again.

## No voice set up
> No voice is set up: add an ElevenLabs or Fish Audio key, or install the local voice (Settings > Media > Voiceover).
> Pick an ElevenLabs voice in this node...

Fix: add a key or install the local voice in **Settings > Media > Voiceover**, then pick a voice in the node.

## Not enough words heard
> ... % of the script's words were heard when it was timed ...

What it means: the voiceover does not match the script well enough for the check in this node.

Fix: retry this video, or lower the needed percentage in the node.

## Claude's answer was not usable
> Claude gave no title. Retry this video.
> Claude wrote a title the channel already has ...
> ... Retry this video.
> Claude answered in an unexpected format...

Fix: retry this video.

## Upload node
> Pick the YouTube channel in this node.
> This channel has not allowed uploads: select the node and press Allow uploads.

Fix: select the node, pick the channel and press **Allow uploads**.

## Import
> That file is not a routine exported from berat studio.

Fix: import a routine file that was exported from the app.

## Claude's limits stop a routine
> Your Claude usage limit is reached...

What it means: your Claude plan's limit (or sign-in) stopped the routine, not the routine itself.

Fix: wait until the limit resets, then resume the routine. See "Claude edit errors and usage limits".

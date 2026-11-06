# Voiceover errors: ElevenLabs and Fish Audio
keywords: elevenlabs, fish audio, voiceover failed, api key, key not accepted, not enough characters, credits, quota, no credit, busy, too many requests, 429, voice not found, cloned voice, unusual activity, plan, sk_
platforms: both

## The API key is missing or not accepted
> Add your ElevenLabs API key first (Settings > Media > Voiceover...
> ElevenLabs did not accept the API key.
> Fish Audio did not accept the API key.

Fix:
1. Copy the whole key again: ElevenLabs at elevenlabs.io (Developers > API keys, it starts with sk_); Fish Audio at fish.audio (API keys).
2. Paste it in **Settings > Media > Voiceover** and try again.

## Not enough characters or credit
> Your ElevenLabs account doesn't have enough characters left for this...
> Your Fish Audio account has no API credit left for this.

What it means: your account at that service is empty. Sections already made are kept and won't be charged again.

Fix: wait for the monthly reset or upgrade at elevenlabs.io; for Fish Audio add credit at fish.audio (Billing). Then make the voiceover again.

## The key is not allowed
> Your ElevenLabs API key is not allowed to ...

Fix: edit the key at elevenlabs.io (Developers > API keys) and allow it, or make a key without restrictions.

## Busy
> ElevenLabs is busy right now (too many requests at once). Try again in a minute.
> Fish Audio is busy for this account right now...

Fix: wait a minute and try again.

## The voice is gone
> ElevenLabs no longer has this voice...
> Fish Audio no longer has this voice...

Fix: pick another voice in the Voiceover window.

## Plan limits at ElevenLabs
> Your ElevenLabs plan can't use instantly cloned voices (this voice is one).
> ElevenLabs has turned off free-plan use for this account (it reports unusual activity).
> This audio quality needs a higher ElevenLabs plan.

Fix: pick a library voice, or upgrade at elevenlabs.io. The local voice is a free alternative.

## Could not reach the service
> Could not reach ElevenLabs: ...
> Could not reach Fish Audio: ...

Fix: check the internet connection, then try again.

## Problem on their side
> ElevenLabs had a problem on its side (error ...
> Fish Audio had a problem on its side (error ...

Fix: try again in a few minutes.

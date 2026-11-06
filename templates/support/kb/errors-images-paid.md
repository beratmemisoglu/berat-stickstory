# Image errors: Higgsfield, Fal.ai and custom APIs
keywords: higgsfield, fal, fal.ai, image failed, picture failed, api key, key rejected, no credits, credits, billing, busy, 429, unsafe, nsfw, blocked, image budget, custom api, KEY_ID, KEY_SECRET
platforms: both

## No image service set up
> Add a Higgsfield or Fal.ai API key in Settings first (Settings > Media > Image generation).

Fix: set up Google Flow (free with your Flow credits) or add a Higgsfield or Fal.ai key in **Settings > Media > Image generation**.

## The key is wrong or rejected
> That does not look like a Higgsfield API key. It has two parts: KEY_ID:KEY_SECRET...
> Higgsfield rejected the API key (Settings > Media > Image generation).
> Fal.ai rejected the API key (Settings > Media > Image generation).

Fix: copy the whole key again (both parts, with the colon): Higgsfield at cloud.higgsfield.ai (API keys), Fal.ai at fal.ai/dashboard/keys. Paste it in **Settings > Media > Image generation**.

## No credits left
> Your Higgsfield account has no API credits left for this image.
> Your Fal.ai account has no credits left for this image.

Fix: add credits (cloud.higgsfield.ai Billing, or fal.ai/dashboard/billing), then run it again. Nothing was charged for the failed picture.

## Busy
> Higgsfield is busy with your other images (4 at a time). This one will need to be run again.
> Fal.ai is busy with your other images. This one will need to be run again.

Fix: wait for the other pictures, then run it again.

## Blocked as unsafe
> Higgsfield blocked this image as unsafe content (not charged). Change the prompt.
> Fal.ai blocked this image as unsafe content. Change the prompt.

Fix: describe the picture differently and try again.

## Project image budget used
> This project has used its image budget ...

What it means: each project has a limit on paid pictures, so a build can't overspend.

Fix: ask Claude to reuse the pictures it already made, or tell Claude in the Claude panel to raise this project's image budget.

## Custom API failed
> ... API failed (at your own risk) ...
> ... API is set up (Settings > Media > Custom APIs).

What it means: a connector you made yourself in **Settings > Media > Custom APIs** stopped working. Custom APIs are at your own risk and not supported.

Fix: check the service's key and credit, set the connector up again, or pick another service.

# Image generation: Google Flow, Higgsfield, Fal.ai
keywords: images, pictures, image generation, image service, google flow, flow, higgsfield, fal, fal.ai, api key, add key, no key yet, no pictures, vox pictures, custom style pictures, thumbnails, textures, nano banana, flux, image model, default higgsfield model, credits, image failed, set up image generation first, automatic
platforms: both

Vox videos, custom styles, textures, Ultraedit+ targets and thumbnails get their pictures from **your own** account. Set it up in **Settings > Media > Image generation**.

## Pictures in Vox and custom styles

- **Automatic** (default): Google Flow when you set it up (free with your Flow credits), else Higgsfield or Fal.ai (about a cent per picture; Higgsfield first when both have a key). If Flow can't make a picture, Automatic makes it on Higgsfield or Fal.ai instead.
- **Higgsfield**, **Fal.ai**, **Google Flow (at your own risk)**, or **Custom: …** once you set up a Custom API.
- Google Flow picked on its own never switches to a paid service.

The line under it says what is used now, e.g. "Using Higgsfield".

A project can pick its own service: Project settings (the gear next to its name in the editor).

## Add a Higgsfield or Fal.ai key

1. Click **Add key** next to **Higgsfield API key** or **Fal.ai API key**.
2. Click **Get a key** to open the service's key page, copy the key, paste it and click **Save key**. A Higgsfield key has both parts: `KEY_ID:KEY_SECRET`.
3. The key is checked, then stored encrypted on this computer.

**Change** replaces a key; **Remove key** in the same window deletes it.

**Default Higgsfield model**: the model Claude uses unless it picks another; a project can pick its own. Fal.ai uses FLUX.2.

Google Flow: see "Google Flow for pictures".

## Problems

- "No key yet: add a Higgsfield or Fal.ai key below": add a key, or set up Google Flow.
- "Open Flow below and sign in first": Google Flow is picked but not opened yet.
- A **Set up image generation first** window when you start a Vox or custom-style video: add a key there (**Add Higgsfield key** / **Add Fal.ai key**) or click **Open Settings**.
- Pictures fail mid-build: check that you have credits left on that service.

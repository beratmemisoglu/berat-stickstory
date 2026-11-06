# Custom APIs: your own picture or voice service
keywords: custom api, custom apis, own service, other image service, other voice service, other api, connector, kie, kie.ai, quick start, set up with claude, custom picture api, custom voice api, add my own api, service not listed, unsupported, at your own risk, remove custom api, connector broke, experimental
platforms: both

Want a picture or voice service the app doesn't offer? In **Settings > Media > Custom APIs** your Claude writes a small connector for it. It is **at your own risk**: not supported, and support can't fix connectors.

## Set one up

1. Next to **Custom picture API** or **Custom voice API**, click **Set up**.
2. Describe the service: which service, which model, anything Claude should know. A link to its API docs helps. (For pictures there is a **Kie.ai** quick start: write the model you want where the text asks for it.)
3. Paste the service's API key (stored encrypted on this computer).
4. Click **Set up with Claude**. Claude reads the docs, writes the connector in its own folder (nothing else in the app changes) and tests it; then the app makes a sample with it. It uses your Claude and the service's credits. **Stop** cancels.

## Use it

- Pictures: **Settings > Media > Image generation**, pick **Custom: …** under **Pictures in Vox and custom styles**. Automatic never picks it by itself. You can also set the **Default model of your custom API**.
- Voices: pick it in the Voiceover window.

## Change or remove

- **Change**: describe it again and set it up again.
- **Remove**: deletes the connector and its key.

If a connector breaks, remove it and switch back to a built-in service (Higgsfield, Fal.ai, Google Flow, ElevenLabs, Fish Audio or the local voice).

## Experimental

Google models (Gemini) for edits and builds are in **Settings > Experimental**: see "Google models via CLIProxyAPI (experimental)".

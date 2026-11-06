# Graphics panel (quality, shadows, blur, bloom, grain)
keywords: graphics, graphics panel, quality, blurry, sharp, sharpen, shadows, bloom, glow, depth of field, dof, blur, focus, anti-aliasing, jagged edges, jaggies, fps, frame rate, laggy preview, colour grade, color grade, black and white, noir, film grain, grain, noise, vignette, exposure, too dark, too bright, export quality, motion blur, supersampling, bitrate, render scale, graphics preset
platforms: both

Click **Graphics** in the editor's top bar. The panel opens beside the preview; changes show live and are saved to this video ("Saved to this video"). Esc or the X closes it.

The full set of switches is for **3D reconstruction** videos. In other styles only the **Frame rate cap** and the **FPS readout** work. For grain, colours or camera in other styles, see "Look settings".

## Top of the panel

- Search: type "shadows", "bloom", "fps"…
- **FPS readout** shows the frame rate on the preview; **Measure** times one frame at these settings.
- Presets: **Fast preview**, **Balanced**, **Quality**, **Export**, and **Reset to look** (everything back to what the look says).
- **Save these as a preset…** keeps your own mix by name for other videos.

## Sections

- **Performance** (preview only): Render scale, Fast effects, Frame rate cap.
- **Image**: Exposure, Tone mapping, Anti-aliasing, Field of view.
- **Lighting & shadows**: Shadows, Shadow detail, Soft shadows, Ambient occlusion, AO strength, AO radius, Fog density, Environment light.
- **Post processing**: Depth of field, Focus blur, Focus distance, Bloom, Bloom strength, Bloom threshold, Film grain, Vignette, Chromatic aberration, Sharpen.
- **Colour grade**: quick looks **Studio**, **Investigation**, **Noir**, **Warm**, **Cold**, **Washed**, then Contrast, Saturation, Highlight cap, Lift (shadows), Gamma (midtones), Gain (highlights), Temperature, Tint.
- **Export quality** (exports only): Export quality, Supersampling, Encode quality, Motion blur.

A dot on a section means you changed it. **Reset** resets that section; the arrow next to a switch resets only that one.

## Common fixes

- **Grain / noise**: Post processing > **Film grain** to 0.
- **Jagged edges**: Anti-aliasing **MSAA 8x** or **MSAA + FXAA (smoothest)**.
- **Too blurry**: Depth of field **Off**, or lower **Focus blur**; a little **Sharpen**.
- **Export looks soft**: Supersampling **3x (slow, cleanest)**, Encode quality **High (28 Mbps)** or **Maximum (45 Mbps)**. Exports take longer.
- **Preview slow**: **Fast preview**, a lower Render scale, or a Frame rate cap.

"This video's engine is older than the Graphics switches"? Click **Update engine** in that note (see "Update engine on an older video").

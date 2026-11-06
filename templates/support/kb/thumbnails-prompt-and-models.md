# Thumbnails: prompts and models
keywords: thumbnail prompt, prompt view, generate thumbnail, ai thumbnail, reference image, references, @img1, mention, type @, model, image model, gpt image 2.5, sunburst, flare, ideogram, grok imagine, qwen image, marketing studio, z-image, soul 2, recraft, aspect ratio, resolution, quality, prompt again, can't use reference images, generate greyed out, higgsfield
platforms: both

The Thumbnails page makes pictures on Higgsfield, on your own account (the key button at the top of the page).

## Prompt view (the simple way)
1. Switch to **Prompt** at the top.
2. **Reference** adds reference images (or drop or paste them). They are named @img1, @img2… in the order you add them.
3. Describe the thumbnail. Type @ to point at a reference: "the face from @img1 on the left, big bold text…".
4. Pick the model, aspect ratio, resolution and quality.
5. **Generate** (Ctrl/⌘ + Enter). **Cancel** stops one that is still running.

Results appear below, newest first, each with **Use as thumbnail**, **Show on the canvas**, **Prompt again from this one**, **Save a copy** and **Show in folder**.

## On the Canvas
Press P for a prompt. Drag images into it to use them as references (@img1, @img2…). **Generate** puts the result next to it; a failed one has **Try again**.

## The models
- **GPT Image 2.5 Sunburst** (the default): best quality, follows references closely.
- **GPT Image 2.5 Flare**: faster, a little less detail.
- **Ideogram 4.0**: the best at text in the image; one reference.
- **Grok Imagine 2.0**: images and precise edits of references.
- **Qwen Image 3**: edits from an instruction, up to 3 references.
- **Marketing Studio Image**: campaign-style images.
- **Z-Image Turbo**: fast drafts with clean text; no references.
- **Soul 2**: realistic people and fashion; no references.
- **Recraft V4.1**: illustrations and graphic styles; no references.

A new prompt on the canvas starts with GPT Image 2.5 Sunburst, 16:9, 2k, high quality.

## Problems
- **Generate** is greyed out: add your Higgsfield key first, or write a prompt.
- "… can't use reference images": that model takes none. Disconnect them, or pick GPT Image 2.5, Grok, Qwen or Ideogram.
- "… takes at most N reference images": remove some.

The **Thumbnail** node of Routines makes pictures on the service picked in **Settings > Media > Image generation** instead (see "Routine nodes: thumbnail, title, approval, upload").

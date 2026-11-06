# Thumbnails (optional)

Only when the user asks. Uses the Higgsfield connector if available (it costs credits - confirm with the
user before generating, and tell them the model/settings).

Recipe that worked: GPT Image 2.5, `variant: sunburst`, `quality: max`, `resolution: 1k`, 16:9.
1. Upload the user's reference thumbnail (composition) + the box art of the featured subjects as
   `image_references` (media_upload -> PUT -> media_confirm).
2. Prompt: "Recreate the exact composition of the first reference image: [layout]. Replace [...] with
   [subjects from the other references, left to right, with 1-line descriptions]. Across the middle the
   single word '[WORD]' in huge white uppercase heavy geometric sans-serif (Inter Black style), clean flat
   white letters with a soft realistic dark drop shadow, absolutely no glow, no outer glow, no bevel, no
   gradient, no outline."
3. Generate 2 variations with different subject line-ups; download; also save 1280x720 JPG copies
   (YouTube size). Inspect them and mention small AI artifacts (logos/small print) honestly.

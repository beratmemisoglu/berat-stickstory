# Real-world assets

## What gets a real image
Every specific game, product, device, person, company, place or document the narration names. Concepts
(memory, bandwidth, streaming) are visualised in 3D instead.

## Sources and policy
- `fetch_images.py search --pages "<Wikipedia article>"` lists the images used on that article
  (box art, screenshots, logos, photos); `--commons "<query>"` searches Wikimedia Commons (hardware
  photos, people, places - usually high-res and freely licensed).
- Fair-use copies on English Wikipedia (covers, screenshots, logos) are ~250-400 px: use them as cards
  (44-120 px wide in art pixels), never full-screen.
- Before downloading, show the user what you plan to fetch (file, source, size, license) and get their
  OK - unless they already approved asset gathering for this project. Downloading is outward-facing.
- Do not rip YouTube or other video platforms. If gameplay footage would help, say so and ask the user
  to provide clips (they can be placed as `pixelQuad` video textures or cards later).
- No usable photo of a person? Use a clean name card (name + role) instead of guessing a photo.
- Social media images (Reddit/X) usually have unclear rights - only with the user's explicit consent.

## Credits
`fetch_images.py get` records file, author and license in `assets/credits.json`.
`fetch_images.py credits $P` prints lines for the end card and the video description. CC BY / BY-SA
images need the author + license shown; put a short credit in the card `sub` and the full list on the
outro card (small slate text at the bottom) and in the description.

## Placement
See style_guide.md section 7. Time each card to the word that names the thing (`t0: st.tName`) and take
it away when the idea moves on (`t1`). Group a cover + logo + photo when introducing a studio/game.

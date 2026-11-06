# Style Studio font library: licences

Every font in `fonts.json` is a file the app already ships (the path is relative to `templates/`), licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org): free to use, embed and ship with a style; never sold on its own.

- Inter (Rasmus Andersson) and JetBrains Mono (JetBrains): from `templates/starter/fonts/`.
- Orbitron (Matt McInerney) and Share Tech Mono (Carrois Apostrophe): from `templates/engine/fonts/` (see also
  `templates/host/fonts/FONTS-LICENSE.txt`).
- Anton, Abril Fatface, Archivo Black, UnifrakturMaguntia, Courier Prime, League Gothic, Oswald, Playfair Display,
  Pinyon Script, Space Mono (Google Fonts): from `templates/collage/fonts/` (`FONTS-LICENSE.txt` there).

Special Elite (`collage/fonts/typewriter-400.woff2`) is Apache 2.0, not OFL, and is left out of the library.
A font added to a style with `add_font` keeps this licence; the style's fonts/ folder ships it with the style.

# berat studio: Stick Stories pipeline (penceresiz)

Bu klasör berat studio'nun kendi main-process kodunu (`appcore/main/index.js`) kütüphane olarak çalıştırır:
proje kurulumu, voiceover, ses tasarımı, mix, export, Claude araçları — hepsi. Sadece uygulama penceresi
yok: headless Chrome render alıyor (`appcore/load.cjs`). Stil: **stickstory** (siyah siluet çöp adam,
flat-vector setler, 2.5D cut-out tiyatro).

## Video yapmak

Tüm komutlar: `python studio.py ...` (bu klasörden). Uzun olanları (run, export, voice) arka planda çalıştır.

1. `python studio.py new <name> --style stickstory [--length 120] [--format vertical|landscape] [--lang tr]`
2. Script: `python studio.py run <name> script --notes "<konu, açı>"` ya da `script.txt` kendin yaz.
3. `python studio.py voice <name>` — ElevenLabs, `appdata/config.json`'daki ses ayarlarınla.
4. Build: `python studio.py run <name> build --level <standard|props|polish|scenes|ultra|ultraplus>`
5. Değişiklik: `python studio.py run <name> edit --notes "<ne, nerede>"` ya da `run <name> ask`
6. `python studio.py sound <name>` → `python studio.py export <name>` → `out/<name>.mp4`

## Claude ile proje üzerinde çalışmak

`python studio.py use <name>`, sonra `/mcp` ile MCP'yi yeniden bağla. Araçlar:
`render_frames`, `check_preview`, `check_layout`, `list_shots`, `narration`, `make_image`, `make_sprites`,
`web_image`, `library_*` vb.

## Dosya yapısı

- `appcore/` — uygulamanın kodu + headless loader + CLI + MCP
- `appdata/` — config, ses ayarları (blender/, speech/, flow-chrome/ hariç — büyük, ayrı indir)
- `templates/stickstory/` — stickstory engine (Three.js, 2.5D cut-out)
- `templates/skill/stickstory-videos/` — build skill (talimatlar, referanslar)
- `templates/host/` — headless render sayfası
- `templates/library/` — paylaşılan asset kütüphanesi
- `templates/studio/` — build stage şablonları
- `templates/support/` — destek KB
- `studio.py` — CLI giriş noktası

Workspace (projeler, suite.db, library): `C:\Users\berat\berat studio-Projects`

API anahtarları ortam değişkenlerinden: `ELEVENLABS_API_KEY`, `HIGGSFIELD_API_KEY`, `FAL_KEY`, `FISH_AUDIO_API_KEY`

Google Flow: `python studio.py flow-open` ile pencereyi aç, kendin tamamla.

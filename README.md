# berat Stick Stories

Toon Studio 0.20.0'ın **Stick Stories** stili için penceresiz pipeline. Uygulamanın kendi kodu çalışıyor,
sadece pencere yerine headless Chrome kullanılıyor. Video kalitesi uygulamadaki ile birebir aynı.

Kişisel kullanım içindir. Paylaşma ya da dağıtma.

## Video yapmak

```bash
cd C:\Users\berat\toon-studio
python studio.py new filmim --style stickstory --length 120 --lang tr
python studio.py run filmim script --notes "konu ve açı"
python studio.py voice filmim
python studio.py run filmim build --level ultra
python studio.py export filmim
```

- `run filmim script`: araştırma + script.txt yazar. İstersen script.txt'yi kendin yaz.
- `voice`: ElevenLabs, kendi ses ayarlarınla. Ardından otomatik temizler ve zamanlar.
- `run ... build --level`: `standard`, `props`, `polish`, `scenes`, `ultra`, `ultraplus`
- Değişiklik: `python studio.py run filmim edit --notes "1:20'deki sahnede ..."`
- Video: projenin `out/` klasöründe.

Projeler `C:\Users\berat\ToonStudio-Projects\projects` içinde.

## Claude ile çalışmak

Claude Code'u bu klasörde aç. Proje üzerinde araçlarla çalışacaksan önce
`python studio.py use filmim` çalıştır, sonra MCP'yi yeniden bağla (`/mcp`).

## Notlar

- API anahtarları ortam değişkenlerinden: `ELEVENLABS_API_KEY`, `HIGGSFIELD_API_KEY`, `FAL_KEY`
- Ayarlar: `appdata\config.json`
- Google Flow görselleri için: `python studio.py flow-open`

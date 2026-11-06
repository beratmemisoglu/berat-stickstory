# Toon Studio

Toon Studio 0.20.0'ın penceresiz hali. Uygulamanın **kendi kodu** çalışıyor, sadece pencereleri Chrome sağlıyor.
Bu yüzden 11 stilin hepsi (Pixel art, Vox, Flat, MS Paint çöp adam, 3D rekonstrüksiyon, Low poly, 3D cartoon, Blender
3D cartoon, 3D Informational, Stick stories, eski Vox) uygulamadaki gibi çalışır.

Kişisel kullanım içindir. Kod, motorlar ve skill'ler Toon Studio'ten kopyalandı: paylaşma ya da dağıtma.

## Video yapmak

```bash
cd C:\Users\berat\toon-studio
python studio.py styles
python studio.py new filmim --style stickstory --length 120 --lang tr
python studio.py run filmim script --notes "konu ve açı"
python studio.py voice filmim
python studio.py run filmim build --level ultra
python studio.py export filmim
```

- `run filmim script`: uygulamanın "Write the script" adımı (araştırma + script.txt). İstersen script.txt'yi kendin yaz.
- `voice`: ElevenLabs, uygulamadaki ses ayarlarınla (Adrian Vale, eleven_v4_turbo). Ardından otomatik temizler ve zamanlar.
- `run ... build --level`: `standard`, `props`, `polish`, `scenes` (Verified), `ultra` (Ultraedit), `ultraplus`
  (sadece rekonstrüksiyon). Stilin seviyeleri: `python studio.py levels filmim`.
- Değişiklik: `python studio.py run filmim edit --notes "1:20'deki sahnede ..."`
- Video: projenin `out/` klasöründe. Sessiz video (ses izi yok): `python studio.py export filmim --silent`.
- `appcore/fixes.cjs`: uygulamada henüz olmayan düzeltmeler (stickstory/toon export'undaki "Encoding error" için encoder
  yedeği). Her komut projenin `engine.js` dosyasına otomatik uygular.

Projeler `C:\Users\berat\ToonStudio-Projects\projects` içinde. Uygulamada açtığın bir projeyi buraya almak için:
`python studio.py import <klasör>`.

## Claude ile konuşarak çalışmak

Claude Code'u bu klasörde aç. Belli bir proje üzerinde araçlarla çalışacaksan önce `python studio.py use filmim` çalıştır,
sonra MCP'yi yeniden bağla (`/mcp`). Böylece uygulamanın araçları (render_frames, check_layout, make_image …) o projede
çalışır.

## Notlar

- Google Flow uygulamanın Flow profilini kullanır. Giriş ya da robot kontrolü isterse `python studio.py flow-open` ile
  pencereyi açıp kendin tamamla.
- API anahtarları ortam değişkenlerinden okunur: `ELEVENLABS_API_KEY` (tanımlı), `HIGGSFIELD_API_KEY`, `FAL_KEY`.
- Ayarlar (ses, model, efor, müzik/efekt) `appdata\config.json` içinde, uygulamadaki ayarlarından kopyalandı.

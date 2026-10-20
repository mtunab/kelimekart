# KelimeKart

Arkadaş grubu (en fazla 5 kişi) için aralıklı tekrarlı kelime kartı uygulaması.
Ayrıntılı proje kuralları: [CLAUDE.md](CLAUDE.md).

## Kurulum (geliştirme)

1. Node.js 22+ ve pnpm gerekir.
2. `pnpm install`
3. `.env.example` dosyasını `.env.local` adıyla kopyala, **dev** Supabase bilgileriyle doldur. Veritabanı şifresi `SUPABASE_DB_PASSWORD` satırına olduğu gibi yazılır.
4. `pnpm db:push` — veritabanı şemasını dev projesine uygular.
5. `pnpm dev` — http://localhost:3000

## Komutlar

| Komut             | Ne yapar                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm verify`     | Tip kontrolü → lint → biçim kontrolü → birim/güvenlik testleri → derleme. Commit öncesi yeşil olmalı. |
| `pnpm verify:e2e` | Yukarıdakiler + tarayıcı (Playwright) testleri                                                        |
| `pnpm db:status`  | Dev veritabanında hangi migration'lar uygulanmış                                                      |
| `pnpm db:push`    | Bekleyen migration'ları dev veritabanına uygular                                                      |

## Gruba kişi ekleme (davet)

Herkese açık kayıt kapalıdır; en fazla 5 kişi olabilir.

```bash
pnpm invite ali@ornek.com "Ali"            # dev'de kişi ekler
pnpm invite ali@ornek.com "Ali" --prod     # canlı sitede kişi ekler
pnpm invite --reset ali@ornek.com --prod   # şifresini unutan kişiye yeni bağlantı
```

Komut ekrana bir bağlantı yazar. Bağlantıyı kişiye WhatsApp vb. ile gönder; kişi tıklayıp kendi şifresini belirler.
Bağlantı **tek kullanımlıktır** ve yaklaşık **1 saat** geçerlidir.

> Not: "Şifremi unuttum" sayfası e-posta gönderir, ancak Supabase'in ücretsiz e-posta servisi yalnızca proje ekibine
> e-posta ulaştırır. Arkadaşların bu e-postayı alabilmesi için kendi SMTP ayarı gerekir (bkz. Sınırlamalar).
> O zamana kadar `pnpm invite --reset` kullan.

## Performans notu

Çalışma kuyruğu sorgusu `EXPLAIN ANALYZE` ile 5000 kartlık sahte veriyle (işlem sonunda geri alındı) ölçüldü:
`card_progress_user_due_idx` (user_id, due) indeksi kullanılıyor, sorgu ~1 ms'de çalışıyor (2026-10-19).

Lighthouse (mobil, `pnpm build && pnpm lighthouse`, 2026-10-20):

| Sayfa      | Performance | Accessibility | Best practices | İlk yük JS (gzip) |
| ---------- | ----------- | ------------- | -------------- | ----------------- |
| Giriş      | 99          | 100           | 100            | 145 kB            |
| Desteler   | 99          | 100           | 100            | 145 kB            |
| Deste      | 97          | 100           | 100            | 145 kB            |
| Çalış      | 98          | 100           | 100            | 156 kB            |
| İstatistik | 99          | 100           | 100            | 144 kB            |

PWA: Chrome'un kurulabilirlik denetimi hatasız (e2e testinde doğrulanıyor).

## Canlı site

- Adres: **https://kelimekart-five.vercel.app** (Vercel, `main` dalına her gönderimde kendini günceller)
- Veritabanı: Supabase `kelimekart-prod`. Vercel'de yalnızca 3 açık değişken var:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL` (Production). Gizli anahtar Vercel'de **yok**.
- Prod bilgileri bilgisayarda `.env.prod.local` dosyasında (GitHub'a gitmez).
- Yeni bir migration prod'a: `pnpm db:push -- --prod` ("prod" yazarak onaylanır).
  Ağın veritabanı kapısını (5432) engellediği durumda: migration dosyasını Supabase → SQL Editor'de çalıştır.

## Yedekleme (haftada bir)

```bash
pnpm backup --prod
```

`backups/kelimekart-prod-<tarih>.json` dosyası oluşur (sadece okur, hiçbir şeyi değiştirmez).
Bu dosya kişisel veri içerir: GitHub'a gitmez; kendi bulut sürücüne (Google Drive vb.) kopyala.
Öneri: her pazar bir kez çalıştır, son 8 haftanın dosyalarını sakla.

**Geri yükleme** (bir şey ters giderse):

```bash
pnpm restore backups/kelimekart-prod-<tarih>.json --prod
```

"geri yükle" yazarak onaylanır. Yedekteki satırlar geri gelir/güncellenir; yedekte olmayan yeni satırlar silinmez.
Hesaplar (şifreler) yedekte yoktur: silinmiş bir kişinin verisi için önce `pnpm invite ... --prod` ile kişiyi yeniden ekle.
Geri yükleme otomatik testle denendi (`tests/security/backup.test.ts`: yedek al → desteyi sil → geri yükle → her şey geri geldi).

## Güvenlik kontrol listesi (2026-10-20)

- [x] Tüm tablolarda RLS açık, güvenlik testleri yeşil (dev'de 71 güvenlik testi; prod'da girişsiz okuma her tabloda engelli)
- [x] Herkese açık kayıt kapalı (dev ve prod; prod'da sunucu ayarından doğrulandı: `disable_signup: true`)
- [x] Gizli anahtar istemci paketinde yok (`pnpm verify` her derlemede `.next/static` tarar)
- [x] `.env*` dosyaları `.gitignore`'da; tüm git geçmişi tarandı, gizli anahtar/şifre yok
- [x] Tüm server action/route girdileri Zod ile doğrulanıyor
- [x] Giriş denemelerinde Supabase hız sınırı açık (IP başına 5 dakikada 30)
- [x] HTTPS (Vercel + HSTS), CSP, X-Frame-Options, Referrer-Policy, nosniff canlıda doğrulandı
- [x] Hata mesajları iç ayrıntı sızdırmıyor (kullanıcıya genel Türkçe mesaj)

_Kullanım kılavuzu ve sorun giderme Aşama 8'de eklenecek._

# KelimeKart

Arkadaş grubu (en fazla 5 kişi) için aralıklı tekrarlı kelime kartı uygulaması.
Kelimeler ortak destelerde durur; herkesin çalışma ilerlemesi kendine özeldir.

- **Canlı site:** https://kelimekart-five.vercel.app
- **Kullanıcılar için kılavuz:** [KULLANIM.md](KULLANIM.md) (aynı içerik uygulamada **Ayarlar → Yardım** sayfasında)
- **Proje kuralları ve karar günlüğü:** [CLAUDE.md](CLAUDE.md)

---

## 1. Nasıl kullanılır (kısaca)

1. Grup yöneticisi (Tuna) sana bir hesap açar ve **kullanıcı adını + şifreni** verir. Onlarla giriş yaparsın.
2. **Desteler** sayfasında bir deste oluşturursun ya da sana paylaşılan bir desteyi açarsın.
3. Kelime eklersin: **Kelime** ve **Anlamı** yazıp Enter'a basarsın (art arda hızlıca). Çok kelime için **İçe aktar**.
4. **Çalış**'a basarsın: kartı çevir, ne kadar iyi hatırladığını seç. Uygulama kartı ne zaman tekrar göstereceğini kendisi hesaplar.
5. **İstatistik** sayfasında ilerlemeni ve grubun bugünkü durumunu görürsün.

Ayrıntılar: [KULLANIM.md](KULLANIM.md).

---

## 2. Hesap yönetimi — yönetici için

Herkese açık kayıt kapalıdır; grup **en fazla 5 kişi** olabilir. Giriş **kullanıcı adı + şifre** iledir (e-posta yok).
Hesaplar **kendiliğinden silinmez**; yalnızca yönetici siler. Komutlar proje klasöründe çalıştırılır
(Windows PowerShell'de `pnpm` yerine **`pnpm.cmd`** yaz; bkz. Sorun giderme).

```bash
pnpm user add ali "Ali" --prod     # canlıda "ali" hesabını açar; şifreyi gizli (yıldızla) sorar
pnpm user password ali --prod      # şifresini unutan kişiye yeni şifre
pnpm user list --prod              # hesapları listeler
pnpm user remove ali --prod        # hesabı siler (kullanıcı adını yazarak onaylanır)
```

- **Kullanıcı adı:** 3-20 karakter; küçük harf, rakam, nokta, alt çizgi, tire (Türkçe harf yok). Girişte büyük/küçük harf fark etmez.
- **Şifre:** en az 8 karakter. Komut satırına yazılmaz; komut sorunca gizli girilir (ekranda ve komut geçmişinde kalmaz).
- Kişiye kullanıcı adını ve şifresini ilet; girdikten sonra **Ayarlar → Şifre değiştir**'den kendi şifresini koyabilir.
- `--prod` yazılmazsa komut **dev** (deneme) ortamında çalışır.
- ⚠️ Hesap silinince kişinin **sahibi olduğu desteler ve kartları da silinir.** Önce yedek al (bölüm 3).
- Arka planda her kullanıcı adı `ad@users.kelimekart.invalid` iç adresine eşlenir (Supabase e-posta ister;
  `.invalid` gerçek bir alan adı olamaz, bu adreslere hiçbir zaman e-posta gitmez).

---

## 3. Yedekleme (haftada bir) — yönetici için

Supabase'in ücretsiz planında otomatik yedek **yoktur**. Haftada bir:

```bash
pnpm backup --prod
```

- `backups/kelimekart-prod-<tarih>.json` dosyası oluşur. Komut **sadece okur**, hiçbir şeyi değiştirmez.
- Dosya kişisel veri içerir; GitHub'a gitmez. **Kendi bulut sürücüne** (Google Drive vb.) kopyala.
- Öneri: her pazar çalıştır, son 8 haftanın dosyalarını sakla.

**Geri yükleme** (bir şey ters giderse):

```bash
pnpm restore backups/kelimekart-prod-<tarih>.json --prod
```

- "geri yükle" yazarak onaylanır. Yedekteki satırlar geri gelir ya da güncellenir; yedekte olmayan yeni satırlar **silinmez**.
- Hesaplar (şifreler) yedekte yoktur: silinmiş bir kişinin verisini geri getirmek için önce o kişiyi
  `pnpm user add ... --prod` ile **aynı kullanıcı adıyla** yeniden aç.
- Geri yükleme otomatik testle denendi (`tests/security/backup.test.ts`: yedek al → desteyi sil → geri yükle → her şey geri geldi).

---

## 4. Bilinen sınırlamalar

| #   | Sınırlama                                                                                                                                                                                                                                             | Ne yapmalı                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | **"Şifremi unuttum" kendi kendine çalışmaz** (e-posta yok).                                                                                                                                                                                           | Yönetici `pnpm user password ad --prod` ile yeni şifre verir.               |
| 2   | **Supabase ücretsiz projesi 7 gün hiç kullanılmazsa duraklatılır.** Site açılır ama giriş/çalışma hata verir.                                                                                                                                         | Supabase → kelimekart-prod → **Restore project**. Düzenli kullanımda olmaz. |
| 3   | **Otomatik yedek yok** (ücretsiz plan).                                                                                                                                                                                                               | Haftalık `pnpm backup --prod` (bölüm 3).                                    |
| 4   | **Çevrimdışı çalışma yok.** Uygulama telefona eklenebilir ama internet olmadan kart gösteremez; bağlantı yoksa "İnternet bağlantısı yok" sayfası açılır. Yavaş bağlantıda cevaplar arka planda 3 kez denenir; olmazsa kart geri gelir ve uyarı çıkar. | İnternet gelince devam et.                                                  |
| 5   | **Geri al, seriyi (streak) azaltmaz.** Günün tek cevabını geri alsan bile o gün seri sayılmış olur.                                                                                                                                                   | —                                                                           |
| 6   | **Telaffuz cihazın seslerine bağlı.** Bazı cihazlarda bazı diller için ses yoktur; o zaman "Dinle" ses çıkarmaz.                                                                                                                                      | Cihazın dil/ses ayarlarından dil paketi eklenebilir.                        |
| 7   | **Kart ve deste kalıcı olarak silinmez, sadece arşivlenir.** Destenin sahipliği başkasına devredilemez.                                                                                                                                               | Arşivden geri alınabilir.                                                   |
| 8   | **Ortak destede her üye her kartı düzenleyebilir ve arşivleyebilir** (sadece ekleyen değil).                                                                                                                                                          | Grupta anlaşarak kullanın.                                                  |
| 9   | Sınırlar: en fazla **5 kişi**, tek seferde en fazla **2000 kart** içe aktarma, kart başına en fazla **10 etiket**, kelime en fazla 200, anlam en fazla 500 karakter. Kullanıcı adı sonradan değiştirilemez.                                           | —                                                                           |
| 10  | Arama kelimenin bir parçasını arar (ör. "elm" → "elma"); yazım hatasını tolere etmez. Büyük/küçük harf ve i/ı farkı önemsizdir.                                                                                                                       | —                                                                           |
| 11  | "Gün" senin saat dilimine göre **sabah 04:00**'te başlar (gece 02:00'de çalışmak hâlâ "dün" sayılır).                                                                                                                                                 | Saat dilimini **Ayarlar**'dan değiştir.                                     |
| 12  | Yalnızca `main` dalı canlıya çıkar; Vercel'in deneme (preview) yayınlarında veritabanı bilgisi olmadığı için çalışmazlar.                                                                                                                             | Bilerek böyle: deneme yayınları gerçek veriye dokunmasın.                   |
| 13  | Bazı ağlar veritabanı kapısını (5432) engelleyebilir; o zaman `pnpm db:push` / `db:status` bağlanamaz.                                                                                                                                                | Migration dosyasını Supabase → **SQL Editor**'de çalıştır.                  |
| 14  | Vercel Hobby planı ticari olmayan kullanım içindir.                                                                                                                                                                                                   | Ticari kullanıma geçilirse plan değişmeli.                                  |

---

## 5. Sorun giderme

| Belirti                                                                                     | Neden / Çözüm                                                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| PowerShell: `pnpm : File ... pnpm.ps1 cannot be loaded because running scripts is disabled` | Windows güvenlik ayarı. Ayarı değiştirmeden **`pnpm.cmd`** kullan: `pnpm.cmd user list --prod`       |
| `Command "user" not found`                                                                  | Komut yanlış klasörde çalıştırıldı. Önce: `cd "C:\Users\tunab\Desktop\Duo Cards"`                    |
| Girişte "Kullanıcı adı veya şifre hatalı."                                                  | Kullanıcı adını doğru yazdığından emin ol. Şifre unutulduysa: `pnpm user password ad --prod`         |
| Girişte "Çok fazla deneme yapıldı"                                                          | Güvenlik için 5 dakika bekle.                                                                        |
| Hesap açarken "Grup dolu: en fazla 5 kişi"                                                  | 5 kişi sınırı. Biri silinmeden yeni hesap açılamaz (bölüm 2).                                        |
| Hesap açarken "zaten var"                                                                   | O kullanıcı adı alınmış. Başka bir ad seç ya da şifresini yenile.                                    |
| Site açılıyor ama her şey hata veriyor                                                      | Supabase projesi duraklatılmış olabilir (sınırlama 2) → **Restore project**.                         |
| Çalış'ta yeni kart gelmiyor                                                                 | Günlük yeni kart sınırı dolmuş olabilir. **Ayarlar → Günlük yeni kart** sayısını artır.              |
| Gün yanlış sayılıyor / seri bozuldu                                                         | **Ayarlar → Saat dilimi** doğru mu? Gün 04:00'te başlar.                                             |
| "Dinle" ses çıkarmıyor                                                                      | Cihazda o dil için ses yok (sınırlama 6).                                                            |
| `pnpm db:push` bağlanamıyor (`DbConnectError`)                                              | Ağ 5432 kapısını engelliyor olabilir (sınırlama 13) ya da `.env(.prod).local` içindeki şifre yanlış. |

---

## 6. Geliştirici bilgileri

### Kurulum

1. Node.js 22+ ve pnpm gerekir.
2. `pnpm install`
3. `.env.example` dosyasını `.env.local` adıyla kopyala, **dev** Supabase bilgileriyle doldur.
   Veritabanı şifresi `SUPABASE_DB_PASSWORD` satırına olduğu gibi yazılır.
4. `pnpm db:push` — veritabanı şemasını dev projesine uygular. `pnpm db:seed` — örnek deste ekler (sadece dev).
5. `pnpm user add ad "Ad"` — kendine dev hesabı aç. `pnpm dev` — http://localhost:3000

Prod bilgileri `.env.prod.local` dosyasındadır. **Bu dosyanın adı asla `.env.production.local` olmamalı**
(Next.js onu kendiliğinden okur ve yerel derleme prod'a bağlanır; bir test bunu engeller).

### Komutlar

| Komut                                                    | Ne yapar                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                                            | Tip kontrolü → lint → biçim → birim/güvenlik testleri → derleme → istemci paketinde gizli anahtar taraması. Commit öncesi yeşil olmalı. |
| `pnpm verify:e2e`                                        | Yukarıdakiler + tarayıcı (Playwright) testleri (1280px ve 390px)                                                                        |
| `pnpm db:status` / `pnpm db:push`                        | Dev'de migration durumu / uygulama. Sonuna `-- --prod` eklenirse prod ("prod" yazarak onaylanır).                                       |
| `pnpm db:seed`                                           | Dev'e örnek deste (prod'da çalışmaz)                                                                                                    |
| `pnpm user …`                                            | Hesap açma / şifre yenileme / listeleme / silme (bölüm 2)                                                                               |
| `pnpm backup [--prod]` / `pnpm restore <dosya> [--prod]` | Yedek alma / geri yükleme (bölüm 3)                                                                                                     |
| `pnpm check:staged`                                      | Commit'e hazırlanan değişikliklerde gizli bilgi var mı bakar                                                                            |
| `pnpm icons`                                             | PWA ikonlarını `public/icons/icon.svg`'den yeniden üretir                                                                               |
| `pnpm build && pnpm lighthouse`                          | Mobil Lighthouse ölçümü (geçici test kullanıcısıyla, dev)                                                                               |

### Canlı ortam

- Vercel: `main` dalına her gönderimde kendini günceller. Yalnızca Production için 3 açık değişken:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL`. Gizli anahtar Vercel'de **yok**.
- Supabase `kelimekart-prod`: herkese açık kayıt kapalı.

### Performans

- Çalışma kuyruğu `EXPLAIN ANALYZE` ile 5000 kartlık sahte veriyle ölçüldü (işlem sonunda geri alındı):
  `card_progress_user_due_idx` (user_id, due) indeksi kullanılıyor, sorgu ~1 ms (2026-10-19).
- Lighthouse (mobil, 2026-10-20):

| Sayfa      | Performance | Accessibility | Best practices | İlk yük JS (gzip) |
| ---------- | ----------- | ------------- | -------------- | ----------------- |
| Giriş      | 99          | 100           | 100            | 145 kB            |
| Desteler   | 99          | 100           | 100            | 145 kB            |
| Deste      | 97          | 100           | 100            | 145 kB            |
| Çalış      | 98          | 100           | 100            | 156 kB            |
| İstatistik | 99          | 100           | 100            | 144 kB            |

- PWA: Chrome'un kurulabilirlik denetimi hatasız (e2e testinde doğrulanıyor).

### Güvenlik kontrol listesi (2026-10-20)

- [x] Tüm tablolarda RLS açık, güvenlik testleri yeşil (dev'de 72 güvenlik testi; prod'da girişsiz okuma her tabloda engelli)
- [x] Herkese açık kayıt kapalı (dev ve prod; prod'da sunucu ayarından doğrulandı: `disable_signup: true`)
- [x] Gizli anahtar istemci paketinde yok (`pnpm verify` her derlemede `.next/static` tarar)
- [x] `.env*` dosyaları `.gitignore`'da; tüm git geçmişi tarandı, gizli anahtar/şifre yok
- [x] Tüm server action/route girdileri Zod ile doğrulanıyor
- [x] Giriş denemelerinde Supabase hız sınırı açık (IP başına 5 dakikada 30)
- [x] HTTPS (Vercel + HSTS), CSP, X-Frame-Options, Referrer-Policy, nosniff canlıda doğrulandı
- [x] Hata mesajları iç ayrıntı sızdırmıyor (kullanıcıya genel Türkçe mesaj)

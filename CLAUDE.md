# KelimeKart — Proje Anayasası (Claude Code için)

> Bu dosya projenin tek kaynağıdır. Önce baştan sona oku, sonra "9. Başlangıç Komutu"ndaki sırayla ilerle.
> Kullanıcı (Tuna) **kodu okumayacak ve kontrol etmeyecek**. Bu yüzden doğruluğu kanıtlayan şey senin yazdığın otomatik testler, tip kontrolü ve tarayıcı testleridir. Test geçmeden hiçbir aşama "bitti" sayılmaz.

---

## 1. Ürün

**Ne:** DuoCards benzeri, web üzerinden çalışan kelime kartı (flashcard) uygulaması. Aralıklı tekrar (spaced repetition) ile kelime ezberletir.

**Kim kullanacak:** Kapalı bir grup, **en fazla 5 kişi** (Tuna + arkadaşları). Herkese açık kayıt YOK. Hesapları sadece davetle oluşur.

**Temel istek:** Grup kendi kelimelerini uygulamanın içinde saklayabilmeli. Kelimeler ortak desteye eklenir, ama **herkesin öğrenme ilerlemesi (hangi kartı ne zaman tekrar edeceği) kişiye özel** olur.

**Dil:** Arayüz Türkçe. Varsayılan dil çifti İngilizce → Türkçe, ama her destenin kendi dil çifti olabilir (sadece etiket, çeviri motoru yok).

**Ticari değil:** Arkadaş grubu için özel kullanım. (Bu yüzden Vercel Hobby planı yeterli. Ticari yöne gidilirse plan değişmeli — şimdilik kapsam dışı.)

### Kapsam dışı (bunları YAPMA, istenirse sonra)
Herkese açık kayıt, ödeme, mobil uygulama (App Store/Play), otomatik çeviri API'si, yapay zekâ özellikleri, Chrome eklentisi, sosyal akış/yorum. Bunlar için kod, tablo veya yer tutucu ekleme.

---

## 2. Kullanıcıyla çalışma kuralları

1. Kullanıcıyla **Türkçe** ve **sade** konuş. Kod terimlerini açıklamadan kullanma. Kodu gösterip "bak" deme.
2. Kullanıcıya sadece şu durumlarda soru sor: (a) hesap/anahtar gerekiyorsa, (b) geri dönülmez bir karar varsa, (c) ürün davranışı gerçekten belirsizse. Teknik kararları kendin ver ve kısaca not düş.
3. Her aşama sonunda şu formatta rapor ver:
   - Ne yapıldı (2-4 cümle, teknik terim yok)
   - Hangi testler geçti (sayıyla: "42 birim, 8 uçtan uca, 6 güvenlik testi")
   - Kullanıcının tarayıcıda **tıklayarak** doğrulayabileceği 3-5 adım
   - Bir sonraki aşama
4. Kullanıcının elle yapması gerekenleri ("10. Kullanıcının Yapacakları") tam o anda, adım adım ve ekran görüntüsü gerektirmeyecek netlikte söyle. Gerisini kendin yap.
5. Emin olmadığın bir kütüphane API'sini **hafızandan yazma**. Kurulu sürümün tip tanımına veya resmi dokümana bak, sonra yaz.

---

## 3. Teknoloji (değişmez kararlar)

| Alan | Seçim |
|---|---|
| Paket yöneticisi | pnpm |
| Framework | Next.js (güncel kararlı sürüm, App Router, TypeScript **strict**) |
| Stil | Tailwind CSS, mobil öncelikli |
| Veritabanı + Auth | Supabase (Postgres, Auth, RLS) — `@supabase/ssr` ile |
| Tekrar algoritması | `ts-fsrs` (FSRS). Kendi algoritmanı yazma. |
| Doğrulama | Zod (tüm sunucu girdileri) |
| Birim/entegrasyon testi | Vitest |
| Uçtan uca test | Playwright |
| Lint/format | ESLint + Prettier, `tsc --noEmit` |
| Yayın | Vercel (GitHub bağlantısı), veritabanı Supabase bulutu |
| Telaffuz | Tarayıcının `SpeechSynthesis` API'si (ücretsiz, anahtarsız) |

**Ortamlar:** İki ayrı Supabase projesi: `dev` ve `prod`. (Ücretsiz plan 2 projeye izin veriyor, tam yetiyor.) Testler ve geliştirme **sadece dev**'e karşı çalışır. Prod'a asla test verisi yazma.

**Bağımlılık disiplini:** Gerekmedikçe yeni paket ekleme. Her ekleme için tek cümle gerekçe yaz. Sürümleri `pnpm-lock.yaml` ile sabitle.

---

## 4. Klasör yapısı

```
/
├─ CLAUDE.md                 (bu dosya)
├─ README.md                 (kurulum + yayın adımları, Türkçe)
├─ .env.example              (gerçek değer YOK)
├─ supabase/
│  ├─ migrations/            (numaralı .sql dosyaları, tek gerçek şema)
│  └─ seed.sql               (sadece dev için örnek veri)
├─ src/
│  ├─ app/                   (sayfalar, route'lar, server action'lar)
│  ├─ components/
│  ├─ lib/
│  │  ├─ supabase/           (server.ts, client.ts, middleware.ts)
│  │  ├─ srs/                (ts-fsrs sarmalayıcı, SAF fonksiyonlar)
│  │  ├─ dates.ts            (kullanıcı saat dilimine göre "gün" hesabı)
│  │  └─ validation/         (Zod şemaları)
│  └─ types/
├─ tests/
│  ├─ unit/                  (srs, dates, validation)
│  ├─ security/              (RLS testleri, iki kullanıcıyla)
│  └─ e2e/                   (Playwright)
└─ scripts/
   ├─ invite-user.ts         (davet gönderme)
   └─ backup.ts              (JSON dışa aktarım)
```

---

## 5. Veri modeli

Şemayı **sadece** `supabase/migrations/` içindeki SQL dosyalarıyla yönet. Panelden elle tablo oluşturma. Alan adları örnektir; `ts-fsrs` kurulunca `Card` tipindeki **gerçek alan listesini** oku ve `card_progress` tablosunu ona birebir uydur (sürüme göre `learning_steps` gibi alanlar değişebilir).

```
profiles
  id (uuid, auth.users.id), display_name, timezone (default 'Europe/Istanbul'),
  daily_new_limit (default 10), daily_goal_reviews (default 30),
  streak_count, streak_last_day (date), created_at

decks
  id, name, source_lang, target_lang, owner_id, created_at

deck_members
  deck_id, user_id, role ('owner' | 'member'), PRIMARY KEY (deck_id, user_id)

cards
  id, deck_id, front, back, example, note, tags text[],
  created_by, created_at, updated_at, archived (bool)
  UNIQUE (deck_id, lower(front))      -- aynı kelime iki kez eklenmesin

card_progress                          -- KİŞİYE ÖZEL
  user_id, card_id, PRIMARY KEY (user_id, card_id)
  due, stability, difficulty, state, reps, lapses, last_review, ...(ts-fsrs Card alanları)
  INDEX (user_id, due)                 -- bugünün kuyruğu için kritik

review_logs                            -- KİŞİYE ÖZEL, sadece ekleme
  id, user_id, card_id, rating (1-4), reviewed_at, state_before, due_before,
  client_event_id (uuid, UNIQUE)      -- aynı cevap iki kez gönderilirse çift sayılmasın
```

### Zorunlu kurallar
- **Her tabloda RLS açık.** RLS'siz tablo yok.
- `cards`: sadece üyesi olduğun desteninkileri görürsün/eklersin/düzenlersin. Silme yerine `archived = true`.
- `card_progress`, `review_logs`: yalnızca `user_id = auth.uid()`.
- `decks`/`deck_members`: üye olmadığın desteyi göremezsin; üye ekleme/çıkarma sadece `owner`.
- **5 kişi sınırı:** `profiles` sayısı 5'i geçerse yeni profil oluşturma tetikleyicisi hata versin (sabit değer tek yerde tanımlı olsun).
- Bir kullanıcı bir desteye eklendiğinde, o destedeki mevcut kartlar için `card_progress` satırlarını **tembel (lazy)** oluştur: kart ilk kez "yeni" kuyruğuna girdiğinde yarat. Önceden toplu satır üretme.
- `service_role` anahtarı sadece sunucu tarafı betiklerde (`scripts/`) ve asla `NEXT_PUBLIC_` ile başlayan değişkende olmaz.

---

## 6. Çekirdek davranışlar

### 6.1 Giriş ve davet
- Supabase'de **public signup kapalı**. Kullanıcılar `scripts/invite-user.ts` ile (e-posta davetiyle) eklenir.
- E-posta + şifre ile giriş. "Şifremi unuttum" akışı çalışmalı.
- Giriş yapmamış kullanıcı hiçbir sayfayı göremez (middleware ile korunur), sadece giriş sayfası açıktır.
- İlk girişte `profiles` satırı otomatik oluşur (veritabanı tetikleyicisi).

### 6.2 Deste ve kart yönetimi
- Deste oluştur / yeniden adlandır / arşivle; üye ekle-çıkar (sadece kayıtlı 5 kullanıcıdan).
- Kart ekle / düzenle / arşivle. Alanlar: ön, arka, örnek cümle, not, etiket.
- **Hızlı ekleme:** Tek ekranda ön+arka yazıp Enter ile kaydet, alan boşalsın, imleç öne dönsün (art arda çok kelime girmek ana kullanım).
- **Toplu içe aktarma:** Yapıştırılan metin ("kelime ; anlam" satırları) veya CSV. Önizleme göster, tekrar edenleri işaretle, onaydan sonra ekle. Bir içe aktarma tek transaction olsun.
- **Dışa aktarma:** Deste → CSV.
- Arama (ön/arka/etiket), etikete göre filtre, sayfalama (50'şerli).
- Aynı kelime tekrar eklenirse sessizce ezme; kullanıcıya "zaten var" de.

### 6.3 Çalışma (study) ekranı — uygulamanın kalbi
- Bugünün kuyruğu = (vadesi gelmiş kartlar) + (günlük yeni kart limitine kadar yeni kartlar). Tek sorguda, `(user_id, due)` indeksiyle gelsin; N+1 yok.
- Akış: ön yüz gösterilir → çevir → 4 buton: **Tekrar / Zor / İyi / Kolay** (her butonun altında bir sonraki aralık görünsün: "10 dk", "3 gün" vb. — `scheduler.repeat` önizlemesinden).
- Kısayollar: `Boşluk` = çevir, `1-4` = puan. Mobilde: karta **sağa kaydır = İyi, sola kaydır = Tekrar**.
- **Geri al (undo):** Son cevabı geri alabilsin (ilerleme satırı önceki haline döner, log satırı silinmez ama `undone` ile işaretlenir ya da ters kayıt eklenir — sadece-ekleme kuralını bozmayan yolu seç ve nedenini yaz).
- Telaffuz butonu (SpeechSynthesis), dil çiftine göre ses dili seç.
- Kuyruk bitince özet ekranı: kaç kart, doğruluk %, yarının tahmini yükü.
- **Cevap işleme sunucuda yapılır** (server action veya RPC): istemciden sadece `cardId`, `rating`, `clientEventId` gelir. Sunucu mevcut durumu okur, `ts-fsrs` ile yeni durumu hesaplar, `card_progress` güncellemesi + `review_logs` eklemesini **tek transaction**da yapar. Aynı `clientEventId` ikinci kez gelirse hiçbir şey değişmez (idempotent).
- Çevrimdışı/yavaş bağlantıda arayüz bloke olmasın: cevap iyimser (optimistic) gösterilsin, hata olursa kart geri gelsin ve kullanıcıya bilgi verilsin.

### 6.4 SRS sarmalayıcı (`src/lib/srs/`)
- Saf fonksiyonlar: `(card, rating, now) → yeni card`. Yan etki yok, `Date` dışarıdan verilir (test edilebilirlik).
- FSRS ayarları tek dosyada: hedef hatırlama oranı (varsayılan 0.9), `enable_fuzz: true`.
- Dönüşüm yardımcıları: veritabanı satırı ↔ `ts-fsrs` `Card`. Tarih alanları UTC saklanır.

### 6.5 "Gün" kavramı ve streak
- Bir "gün" kullanıcının `timezone` değerine göre hesaplanır (UTC'ye göre değil). Gün sınırı: yerel saat **04:00** (gece geç çalışanlar için).
- Streak: o gün en az 1 tekrar yapıldıysa devam eder; bir gün atlanırsa sıfırlanır. `dates.ts` içinde saf fonksiyon + test (gün geçişi, saat dilimi, yaz saati olmayan Europe/Istanbul dahil birkaç saat dilimi).
- Günlük hedef (varsayılan 30 tekrar) için ilerleme çubuğu.

### 6.6 İstatistik ekranı
- Bugün/hafta tekrar sayısı, doğruluk oranı, streak, destede "yeni / öğreniliyor / olgun" kart sayıları, önümüzdeki 14 gün vade tahmini.
- Grup panosu (5 kişi): herkesin bugünkü tekrar sayısı ve streak'i. **Sadece sayı ve ad** gösterilir; başkasının hangi kartı yanlış yaptığı gibi ayrıntı görünmez (RLS bunu zaten engeller, istatistik için ayrı bir güvenli `view`/RPC kullan).
- Grafik gerekirse hafif, bağımsız bir çözüm kullan (ağır kütüphane ekleme).

### 6.7 Ayarlar
Görünen ad, saat dilimi, günlük yeni kart limiti, günlük hedef, şifre değiştirme, tema (açık/koyu/sistem).

---

## 7. Kalite çıtası (kodu kimse okumayacağı için ZORUNLU)

### 7.1 Her commit öncesi çalışacak tek komut
`pnpm verify` şunları sırayla çalıştırır ve **biri bile başarısızsa commit atılmaz**:
```
tsc --noEmit  →  eslint  →  vitest run  →  next build
```
`pnpm verify:e2e` ek olarak Playwright'ı çalıştırır. Her aşama sonunda ikisi de yeşil olmalı.

### 7.2 Testler
- **Birim (Vitest):** SRS sarmalayıcı (4 puanın hepsi, yeni/öğrenme/tekrar durumları, tarih ilerlemesi), `dates.ts` (gün sınırı, streak), Zod şemaları, CSV içe aktarma ayrıştırıcısı (bozuk satır, tırnak, noktalı virgül, çift kelime).
- **Güvenlik (Vitest, dev Supabase'e karşı, iki gerçek test kullanıcısıyla):**
  - A kullanıcısı B'nin `card_progress` / `review_logs` satırını okuyamaz, yazamaz.
  - Üye olmayan kullanıcı desteyi ve kartlarını göremez, ekleyemez.
  - Üye olmayan biri kendini desteye ekleyemez.
  - Giriş yapmamış istek hiçbir tabloyu okuyamaz.
  - 6. profil oluşturulamaz.
  - Aynı `clientEventId` ikinci kez gönderilince ilerleme değişmez.
- **Uçtan uca (Playwright):** giriş → deste oluştur → 10 kart ekle (hızlı ekleme) → CSV içe aktar → çalışma oturumunu bitir (klavye ile) → istatistik güncellenmiş mi → çıkış. Mobil görünüm (390px genişlik) için aynı akışın kısa hali.
- Test verisi her çalıştırmada kendini temizler. Testler birbirinden bağımsız olsun.

### 7.3 Performans
- Çalışma kuyruğu ve istatistikler tek sorguyla/RPC ile gelir; `EXPLAIN` ile indeks kullanıldığını bir kez doğrula ve sonucu README'ye 2 satırla yaz.
- Kart listeleri sayfalı. Sunucu bileşenlerini (RSC) varsayılan kullan, `use client` yalnızca etkileşim gereken yerlerde.
- Gereksiz yeniden render ve büyük paket yok; `next build` çıktısındaki sayfa boyutlarını raporla, ilk yük 200 kB (gzip JS) altında kalsın hedefi.

### 7.4 Güvenlik kontrol listesi (yayından önce hepsi işaretli olmalı)
- [ ] Tüm tablolarda RLS açık, güvenlik testleri yeşil
- [ ] Herkese açık kayıt kapalı (prod projesinde panelden doğrulandı)
- [ ] `service_role` anahtarı istemci paketinde yok (`next build` çıktısında ve `.next` içinde arandı)
- [ ] `.env*` dosyaları `.gitignore`'da, repoda gizli anahtar yok (`git log` ve çalışma ağacı tarandı)
- [ ] Tüm server action/route girdileri Zod ile doğrulanıyor
- [ ] Giriş denemelerinde Supabase'in hız sınırı açık
- [ ] HTTPS zorunlu, güvenlik başlıkları (CSP temel, `X-Frame-Options`, `Referrer-Policy`) `next.config` içinde tanımlı
- [ ] Hata mesajları kullanıcıya iç ayrıntı sızdırmıyor

### 7.5 Erişilebilirlik ve kullanılabilirlik
Klavye ile tam kullanım, odak halkası görünür, kontrast yeterli, dokunma hedefleri en az 44px, boş durumlar ("henüz kelime yok → ilk kelimeni ekle") ve hata durumları tasarlanmış olmalı.

---

## 8. Aşamalar ve bitiş ölçütleri

Her aşama: planı kısaca yaz → uygula → `pnpm verify` (+ gerektiğinde e2e) → commit → Türkçe rapor.

**Aşama 0 — Zemin**
Repo, pnpm, Next.js iskeleti, TS strict, ESLint/Prettier, Vitest, Playwright, `pnpm verify` betiği, `.env.example`, boş README. Supabase `dev` bağlantısı ve migration akışı çalışır.
*Bitti sayılır:* `pnpm verify` yeşil, `pnpm dev` açılıyor.

**Aşama 1 — Giriş**
Giriş/çıkış, şifre sıfırlama, middleware koruması, `profiles` + tetikleyici, 5 kişi sınırı, `scripts/invite-user.ts`.
*Bitti:* davetle eklenen kullanıcı girebiliyor; giriş yapmadan hiçbir sayfa açılmıyor; ilgili güvenlik testleri yeşil.

**Aşama 2 — Veri modeli + RLS**
Tüm migration'lar (Bölüm 5), RLS politikaları, seed, güvenlik test paketi.
*Bitti:* 7.2'deki tüm güvenlik testleri yeşil.

**Aşama 3 — Deste ve kart yönetimi**
Bölüm 6.2'nin tamamı (hızlı ekleme, CSV içe/dışa aktarma, arama, sayfalama, üye yönetimi).
*Bitti:* ilgili e2e akışı yeşil; 1000 kartlık bir destede liste ve arama akıcı.

**Aşama 4 — Çalışma ekranı**
Bölüm 6.3 + 6.4 + 6.5 (SRS, kuyruk, kısayollar, kaydırma, geri al, idempotent cevap, streak).
*Bitti:* SRS ve tarih birim testleri yeşil; e2e çalışma oturumu yeşil; çift gönderim testi yeşil.

**Aşama 5 — İstatistik ve grup panosu**
Bölüm 6.6 ve 6.7.
*Bitti:* sayılar test verisiyle elle hesaplanmış değerlerle eşleşiyor (testte doğrulanır); başka kullanıcının ayrıntıları sızmıyor.

**Aşama 6 — Mobil ve PWA**
Duyarlı tasarım gözden geçirme, web app manifest + ikonlar (ana ekrana eklenebilir), tek elle kullanım, 390px e2e.
*Bitti:* Lighthouse mobil: Performance ≥ 85, Accessibility ≥ 90, PWA kurulabilir. Sonuçları raporla.

**Aşama 7 — Canlıya alma**
`prod` Supabase projesi + migration'ları uygula, Vercel'e bağla, ortam değişkenleri, güvenlik listesi (7.4), `scripts/backup.ts` (JSON dışa aktarım) ve README'de haftalık yedek talimatı, bir kez geri yükleme denemesi.
*Bitti:* canlı adreste kullanıcı daveti → giriş → kart ekleme → çalışma → çıkış akışı elle (Playwright ile prod'a karşı **sadece okuma-yazma yapmayan** duman testi) doğrulandı; güvenlik listesi tam işaretli.

**Aşama 8 — Teslim**
README (Türkçe: nasıl kullanılır, nasıl kullanıcı davet edilir, nasıl yedek alınır, sınırlar neler, sorun giderme), bilinen sınırlamalar listesi, kullanıcı için 1 sayfalık "kullanım kılavuzu".

### Sonraki fikirler (şimdi YAPMA)
Otomatik çeviri/ses, Chrome eklentisi, yapay zekâ örnek cümle, sınav setleri (İYS vb.), bildirim/e-posta hatırlatma.

---

## 9. Başlangıç Komutu

Çalışmaya başlarken şunu yap:
1. Bu dosyayı baştan sona oku.
2. Kullanıcıya Türkçe, tek mesajda şunları söyle: projeyi anladığını (3 cümle), "10. Kullanıcının Yapacakları" listesindeki Aşama 0 öncesi adımları ve hangi bilgileri senden isteyeceğini.
3. Kullanıcı hazır olduğunda Aşama 0'dan başla. **Aşamaları atlama, birleştirme.** Her aşama sonunda durup rapor ver; kullanıcı "devam" demeden bir sonrakine geçme.

---

## 10. Kullanıcının Yapacakları (Tuna için, kodlama gerektirmez)

Claude Code bunları senin yerine yapamaz; gerektiği anda sana sırayla söyleyecek:

1. **GitHub:** boş bir özel (private) depo aç.
2. **Supabase:** hesap aç, **iki** proje oluştur: `kelimekart-dev` ve `kelimekart-prod`. Her birinden Project URL, `anon` anahtarı ve `service_role` anahtarını al. (`service_role` anahtarını kimseyle paylaşma, sadece Claude Code'a yerel `.env.local` dosyasına yazdır.)
3. **Supabase paneli:** Authentication → Sign In / Providers bölümünde "Allow new users to sign up" seçeneğini **kapat** (her iki projede).
4. **Vercel:** hesap aç, GitHub deposunu bağla (Aşama 7'de).
5. **Arkadaşların:** davet e-posta adreslerini (en fazla 4 kişi daha) hazırla.
6. **Prod'a geçmeden:** Aşama 7 raporundaki güvenlik listesini Claude'un gösterdiği panel adımlarıyla birlikte onayla.

---

## 11. Karar günlüğü

Verdiğin her önemli teknik kararı (ör. undo yöntemi, FSRS ayarları, ek paketler) buraya tarihle ve tek cümle gerekçeyle ekle. Böylece sonraki oturumlarda aynı kararı yeniden tartışmak gerekmez.

| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-10-19 | Next.js 16.4 (App Router, Turbopack, `cacheComponents` açık) | `create-next-app` güncel kararlı sürümü; Next 16'da `middleware.ts` dosyasının adı `proxy.ts` oldu, oturum yardımcısı yine `src/lib/supabase/middleware.ts` içinde. |
| 2026-10-19 | `tsconfig`: `strict` + `noUncheckedIndexedAccess` | Kodu kimse okumayacağı için dizi/nesne erişimindeki `undefined` hatalarını derleyici yakalasın. |
| 2026-10-19 | Yazı tipi olarak sistem fontları (Google Fonts yok) | Derleme sırasında dış ağa bağımlılık ve ek yük olmasın. |
| 2026-10-19 | Ek paketler: `server-only` (gizli kodun istemci paketine girmesini derlemede engeller), `supabase` CLI (migration uygulama), `tsx` + `dotenv` (scripts/ betiklerini çalıştırmak), `prettier-plugin-tailwindcss` + `eslint-config-prettier` (tutarlı biçim) | Her biri tek bir somut ihtiyacı karşılıyor. |
| 2026-10-19 | Migration'lar bulut Supabase'e `pnpm db:push` ile `SUPABASE_DB_URL` üzerinden uygulanır (yerel Docker yok) | Kullanıcının bilgisayarında Docker kurulumu gerektirmesin; dev ve prod ayrı env dosyalarında, prod için ayrıca "prod" yazarak onay istenir. |
| 2026-10-19 | `pnpm verify` = typegen+tsc → eslint (uyarı da hata) → prettier kontrolü → vitest → next build; e2e üretim derlemesine (`next start`) karşı 1280px ve 390px'te koşar | Tip tanımları Next'in ürettiği rota tiplerine bağlı; e2e gerçek yayın davranışını ölçsün. |
| 2026-10-19 | Supabase projeleri: bölge Europe; "Automatically expose new tables" **kapalı**, "Enable automatic RLS" **açık** (dev ve prod aynı) | Tablolar API'ye ancak migration'daki açık `GRANT` ile açılır; RLS unutulsa bile otomatik açılır. Bu yüzden her migration gereken `GRANT`'ları kendisi yazmalı. |
| 2026-10-19 | Veritabanı adresi şifresiz (`[YOUR-PASSWORD]` yer tutuculu) `SUPABASE_DB_URL` + ayrı `SUPABASE_DB_PASSWORD`; betik şifreyi URL-kodlayarak yerleştirir | Özel işaretli şifreler adresi bozmasın, kullanıcı şifreyi elle kodlamak zorunda kalmasın. |
| 2026-10-19 | `pnpm verify` sonunda `check:bundle`: `.next/static` içinde gizli anahtar/şifre taraması | 7.4'teki "service_role istemci paketinde yok" maddesi her derlemede otomatik doğrulansın. |
| 2026-10-19 | Testler yalnızca `.env.local` (dev) yükler; prod URL'si dev ile aynıysa güvenlik testleri durur | Prod'a asla test verisi yazılmasın. |
| 2026-10-19 | Güvenlik testleri Vitest içinde `tests/security/` altında, dosyalar sırayla çalışır | Aynı dev veritabanını paylaştıkları için birbirini bozmasınlar. |

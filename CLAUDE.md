# KelimeKart — Proje Anayasası (Claude Code için)

> Bu dosya projenin tek kaynağıdır. Önce baştan sona oku, sonra "9. Başlangıç Komutu"ndaki sırayla ilerle.
> Kullanıcı (Tuna) **kodu okumayacak ve kontrol etmeyecek**. Bu yüzden doğruluğu kanıtlayan şey senin yazdığın otomatik testler, tip kontrolü ve tarayıcı testleridir. Test geçmeden hiçbir aşama "bitti" sayılmaz.

---

## 1. Ürün

**Ne:** DuoCards benzeri, web üzerinden çalışan kelime kartı (flashcard) uygulaması. Aralıklı tekrar (spaced repetition) ile kelime ezberletir.

**Kim kullanacak:** Kapalı bir grup, **en fazla 20 kişi** (Tuna + arkadaşları; ilk sürümde 5'ti, 2026-10-22'de yükseltildi). Herkese açık kayıt YOK. Hesapları sadece davetle oluşur.

**Temel istek:** Grup kendi kelimelerini uygulamanın içinde saklayabilmeli. Kelimeler ortak desteye eklenir, ama **herkesin öğrenme ilerlemesi (hangi kartı ne zaman tekrar edeceği) kişiye özel** olur.

**Dil:** Arayüz **İngilizce** (2026-10-20, Tuna'nın isteği; ilk sürüm Türkçeydi). Kullanıcıyla konuşma ve README Türkçe kalır. Varsayılan dil çifti İngilizce → Türkçe, ama her destenin kendi dil çifti olabilir (sadece etiket, çeviri motoru yok).

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
| 2026-10-19 | `cacheComponents` ve `partialPrefetching` **kapalı** | Uygulamanın her sayfası kişiye özel; bu önbellek kazanç sağlamıyor, her oturum okumasını `<Suspense>` içine almayı zorunlu kılıp derleme hatası riskini artırıyor. |
| 2026-10-19 | Prod ortam dosyasının adı `.env.prod.local` (asla `.env.production.local` değil) | Next.js `next build/start` sırasında `.env.production.local`'ı kendiliğinden okur; uygulama dev yerine prod'a bağlanır. Bir birim testi ve paket taraması bunu engeller. |
| 2026-10-19 | Davet: `pnpm invite` kullanıcıyı oluşturur ve ekrana tek kullanımlık şifre belirleme bağlantısı yazar (e-posta gönderilmez) | Supabase'in ücretsiz e-posta servisi yalnızca proje ekibine gönderir; 5 kişilik grupta bağlantıyı WhatsApp ile iletmek yeterli. `--reset` aynı yolla şifre yenileme bağlantısı üretir. |
| 2026-10-19 | `/auth/confirm` hem `token_hash` (betik bağlantısı) hem `code` (Supabase'in varsayılan e-postası) kabul eder | Kendi SMTP'si olmadan e-posta şablonu değiştirilemiyor; iki yol da çalışsın. |
| 2026-10-19 | 5 kişi sınırı `public.max_profiles()` fonksiyonunda; `profiles` üzerinde kilitli sayım yapan BEFORE INSERT tetikleyicisi | Sınır tek yerde; aşılırsa kullanıcı oluşturma da geri alınır (aynı işlem). |
| 2026-10-19 | `service_role`'e tablolar için açık izin (`alter default privileges`); `anon`/`authenticated` izinleri her migration'da tek tek | Otomatik açma kapalıyken sunucu betikleri de tabloları göremiyordu. |
| 2026-10-19 | FSRS: hedef hatırlama 0.9, `enable_fuzz: true`, en uzun aralık 3650 gün (`src/lib/srs/config.ts`) | CLAUDE.md varsayılanları; aralık üst sınırı kartların "kaybolmaması" için. |
| 2026-10-19 | Geri al: `review_logs`'a hiç dokunulmaz; geri alma `review_log_undos` tablosuna **eklenir**, istatistik ve günlük sayılar bu kayıtları hariç tutar. Kayıt, cevaptan önceki ilerlemeyi (`progress_before`) ve sonraki sürümü (`version_after`) saklar; geri alma ancak kart o sürümdeyse yapılır | "Sadece ekleme" kuralı tam korunur; araya başka cevap girdiyse yanlış geri yükleme olmaz. Bilinen sınır: geri alma seriyi (streak) azaltmaz. |
| 2026-10-19 | İlerleme satırı (card_progress) kartın **ilk cevabında** oluşur; kuyruğa giren ama cevaplanmayan kart için satır yok | En tembel yol; "bugün açılan yeni kart" sayımı kayıtlardan (`state_before = 0`) yapılır. |
| 2026-10-19 | Cevap: Node (ts-fsrs) yeni durumu hesaplar, `apply_review` (security definer) sürüm kontrolü + idempotent `client_event_id` ile ilerleme + kayıt + seriyi tek işlemde yazar; çakışmada sunucu yeniden okuyup 3 kez dener | Hesaplama tek yerde (TS), yazma atomik ve tekrar edilebilir. İlerleme tablolarına doğrudan yazma izni yok. |
| 2026-10-19 | Çalışma ekranı iyimser: cevap anında sonraki karta geçer, kayıtlar sırayla (zincir) gönderilir, ağ hatasında aynı olay kimliğiyle 3 kez denenir, olmazsa kart geri gelir | Yavaş bağlantıda arayüz bloke olmasın; sıra karışmasın. |
| 2026-10-19 | Öğrenme adımındaki kart (vadesi ≤20 dk) aynı oturumda tekrar gösterilir; kuyruk da 20 dk içinde vadesi gelecek öğrenme kartlarını içerir | Anki'deki "ileriye öğrenme" davranışı; "Tekrar" denen kart dakikalar içinde geri gelir. |
| 2026-10-19 | Hızlı ekleme: Enter'da alanlar hemen boşalır, kayıt arka planda, düğme hiç kilitlenmez; liste yazma durunca bir kez yenilenir | Kilitlenen düğme tarayıcının Enter ile göndermesini engelliyordu (e2e testi yakaladı). |
| 2026-10-19 | Aynı kelime anahtarı `front_key` = küçük harf + U+0307 silinir (İyi=iyi, ılık≠ilik); arama `search_fold` ayrıca ı→i yapar | Postgres `lower('İ')` birleşik nokta ekliyordu; arama ve tekrar kontrolü Türkçede bozuluyordu. |
| 2026-10-19 | Testlerde `scripts/flaky-network.cjs` (DNS hafızası + fetch yeniden deneme), Playwright bekleme 15 sn | Geliştirme sırasında ev ağı %80'e varan paket kaybı yaşadı; yalnızca test/geliştirme sunucusuna yüklenir, üretime girmez. |
| 2026-10-19 | Kart durumları: Yeni (cevapsız), Öğreniliyor (öğrenme/yeniden öğrenme ya da aralık < 21 gün), Olgun (aralık ≥ 21 gün) | Anki'nin "olgun" eşiği; kullanıcıya tanıdık. |
| 2026-10-19 | Grup panosu `group_board()` security definer, yalnızca ad + bugünkü tekrar + seri + "sen misin" döndürür | RLS başkasının kayıtlarını gizliyor; pano için gereken en az bilgi ayrı fonksiyondan. |
| 2026-10-19 | Grafikler bağımlılıksız SVG (`components/bar-chart.tsx`), ekran okuyucu için gizli tablo | "Ağır kütüphane ekleme" kuralı. |
| 2026-10-19 | Tema çerezde (`kk-theme`: system/light/dark); "sistem" için sayfa çizilmeden önce çalışan küçük satır içi betik; Tailwind `dark` sınıf tabanlı | Açık/koyu yanıp sönme olmasın; sunucu tema bilgisini ilk HTML'e koyabilsin. |
| 2026-10-19 | Telefonda alt menü (4 sekme), masaüstünde üst menü; mobilde `scroll-padding-bottom` | Tek elle kullanım; sabit menü düğmeleri örtmesin (e2e yakaladı). |
| 2026-10-20 | PWA: `app/manifest.ts` + PNG ikonlar (`pnpm icons`, Playwright Chromium ile SVG'den, yeni paket yok) + `public/sw.js` yalnızca statik dosyaları önbelleğe alır, sayfalar her zaman ağdan, ağ yoksa `offline.html` | Kişiye özel veri asla önbellekte kalmasın; kurulabilirlik için yeterli. |
| 2026-10-20 | Güvenlik başlıkları `next.config.ts`: temel CSP (`script-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, canlıda HSTS | 7.4 maddesi; Next.js'in sayfa içi başlangıç betikleri için 'unsafe-inline' gerekli. |
| 2026-10-20 | Lighthouse projeye eklenmedi; `pnpm lighthouse` betiği `pnpm dlx lighthouse@12.6.1` ile çalıştırır | Gereksiz bağımlılık olmasın. |
| 2026-10-20 | Prod şeması Supabase SQL Editor ile kuruldu (tüm migration'lar tek işlemde + `supabase_migrations.schema_migrations` kayıtları) | Ev ağı 5432/6543 kapılarını geçirmiyordu; kayıtlar sayesinde CLI sonra kaldığı yerden devam eder. |
| 2026-10-20 | Vercel'de yalnızca Production için 3 açık değişken; Preview'a prod bağlantısı verilmedi; gizli anahtar Vercel'de yok | Uygulama gizli anahtar kullanmıyor; deneme yayınları prod verisine dokunmasın. |
| 2026-10-20 | Yedek: `pnpm backup [--prod]` tüm tabloları + kullanıcı kimliklerini JSON'a yazar; `pnpm restore` birincil anahtara göre upsert eder, silmez; `review_logs.id` "generated by default" + `sync_review_logs_sequence()` | Yedek sadece okur; geri yükleme güvenli (fazla veriyi silmez) ve sonrasında yeni kayıtlar çakışmaz. |
| 2026-10-20 | Kullanım kılavuzu iki yerde: `KULLANIM.md` (GitHub) ve uygulama içi `/help` sayfası (eski adı `/yardim`) (girişsiz açılır, kişisel veri yok; giriş ve Ayarlar sayfasından bağlantılı) | Arkadaşlar GitHub'a bakmaz; giriş yapamayan da yardımı okuyabilsin. İçerik değişirse ikisi birlikte güncellenmeli. |
| 2026-10-20 | **Giriş kullanıcı adı + şifre** (Tuna'nın isteği). Kullanıcı adı `profiles.username` (3-20, a-z0-9._-, tekil, istemci değiştiremez); Supabase için iç adres `ad@users.kelimekart.invalid`. Hesapları yönetici `pnpm user add/password/remove/list` ile yönetir, şifre gizli sorulur. E-postalı davet/sıfırlama bağlantıları, `/auth/confirm` ve `/reset-password` kaldırıldı; "Şifremi unuttum" yöneticiye yönlendirir. Eski e-postalı hesaplar e-postayla girebilir | E-posta olmadan davet/sıfırlama gereksiz; `.invalid` alan adına asla e-posta gitmez; dışarıya açık sayfa sayısı azaldı. Bu karar 6.1'deki "e-posta + şifre" ve "e-posta davetiyle" maddelerinin yerini alır. |
| 2026-10-20 | Arayüz tamamen İngilizce; URL parametreleri de İngilizce (`?deck=`, `?tag=`, `?page=`, `?archived=`, `?status=`); yardım `/help`. Yönetici betikleri (`pnpm user` vb.) ve README Türkçe kaldı | Tuna'nın isteği; yöneticiye yönelik araçlar ve belgeler Tuna için. |
| 2026-10-20 | Ana sayfa = **Study başlangıç ekranı** (bugün kaç kart, günlük hedef, seri, "Start studying", deste bazında çalış); deste listesi `/decks`'e taşındı | Tuna'nın isteği: doğrudan oturuma atlamak yerine başlangıç sayfası. |
| 2026-10-20 | `motion` paketi eklendi (`LazyMotion` + `domMax`, `m.*` bileşenleri, `MotionConfig reducedMotion="user"`): 3B kart çevirme, sürükle-kaydır cevap, kart giriş/çıkış, kademeli liste, kayan menü göstergesi, ilerleme çubuğu | Tuna "Motion ile canlandıralım" dedi; `LazyMotion` paket boyutunu sınırlar, hareket azaltma tercihine saygı duyulur. |
| 2026-10-20 | Hız: oturum kontrolü `auth.getClaims()` (JWT imzası ES256, yerelde doğrulanır, ağ yok); Vercel fonksiyonları `vercel.json` ile `lhr1` (Londra, Supabase prod'a yakın); giriş yapılmış sayfalar `src/app/(app)/` grubunda ortak düzen + `loading.tsx` iskeletleri | Telefonda yavaşlık: fonksiyon ABD'de, veritabanı Avrupa'daydı ve her sayfa birkaç okyanus aşırı istek yapıyordu. Menü artık sayfa geçişinde yeniden çizilmez, iskelet anında görünür. |
| 2026-10-20 | Çalışma ekranında 4 puan düğmesi kaldırıldı (Tuna'nın isteği): cevap kartı kaydırarak (sağ = İyi, sol = Tekrar; fareyle de) ya da klavyede 1-4; aralıklar kaydırma ipucunda ve damgalarda görünür. Telefonda Zor/Kolay yok | Ekran sadeleşsin; FSRS iki cevapla da çalışır. Bu karar 6.3'teki "4 buton" maddesinin yerini alır. |
| 2026-10-20 | Tasarım: **neo-brütal pop** (Tuna 5 seçenek arasından seçti). Renk ve stil `globals.css` içinde değişkenler: kağıt/yüzey/mürekkep (koyu temada yer değiştirir), sabit renk blokları (pembe, sarı, turkuaz, mavi, kırmızı; üstünde hep siyah yazı), `brutal-card`/`brutal-box`/`press` yardımcıları. Yazı tipi Space Grotesk, `@fontsource-variable/space-grotesk` paketiyle uygulamanın içinden sunulur. Emojiler yerine `components/icons.tsx` çizgi simgeleri | Kalın kenar + sert gölge her iki temada okunaklı; yazı tipi dışarıdan (Google) çekilmez, derleme ağa bağımlı olmaz, Türkçe harfler var (OFL lisansı). |
| 2026-10-20 | Telefon alt menüsü: yüzen kapsül; seçim hızına göre esneyerek kayar, basılı tutunca (200 ms) iOS 26 tarzı büyüyen "baloncuk" olur, parmağı takip eder, bırakınca en yakın sekmeye yaylanıp o sayfayı açar (`components/nav-links.tsx`) | Tuna'nın isteği; bağlantılar gerçek `<a>` kaldığı için klavye ve ekran okuyucu etkilenmez, uzun basışta tarayıcı menüsü kapatıldı. |
| 2026-10-20 | Çalışma ekranında `ts-fsrs` ilk yükte inmez; sayfa açılınca arka planda yüklenir, ondan önce verilen cevap sıraya alınır. Alt menüde gösterge `animate()` yerine yay değeri (`useSpring`) | İlk yük JS hedefi (200 kB gzip): çalışma sayfası 207 → 196 kB. |
| 2026-10-22 | Telefonda çalışma ekranı kaydırmasız tek ekrana sığar (`h = 100dvh - üst çubuk`, kart `flex-1`, en fazla 28rem); Home / All decks satırı ve kaydırma ipucu duruyor; Listen · Show answer · Undo tek satırda (Listen/Undo simge düğmesi), bildirim kartın üstünde süzülür. Masaüstünde eski düzen | Tuna ekran kaydını gösterdi: üst kısım ekran dışında kalıyor, kaydırma kart kaydırmayla karışıyordu. 664/740/844 px yükseklikte kaydırma yok, kart 282/358/448 px (geçici e2e ile ölçüldü). |
| 2026-10-22 | Grup sınırı 5 → **20 kişi** (Tuna 15 kişi daha istedi): migration `20261022090000_raise_profile_limit` `max_profiles()` fonksiyonunu 20 yapar; sınır test ve `pnpm user list` içinde sabit değil, fonksiyondan okunur. Prod'a `pnpm db:push --prod` ile uygulanır | Sınırın tek yeri veritabanı fonksiyonu; Supabase ücretsiz plan (50.000 aylık kullanıcı, 500 MB) ve Vercel Hobby (ticari olmayan) 20 kişi için yeterli. Bu karar 5. bölümdeki "5 kişi sınırı" maddesinin sayısını değiştirir. |
| 2026-10-26 | Çalışma akışı (Tuna'nın 3 şikayeti): (1) "hazır kart" kuralı tek yerde `is_study_ready()`; ana sayfa (`deck_summaries`) ve kuyruk aynı sayıyı verir, Start düğmesi kaybolmaz. (2) Oturumdaki kart dönüş zamanını gerçekten bekler ve araya en az 3 kart girmeden tekrar çıkmaz (`lib/study-queue.ts`, saf + birim testli); sadece bekleyen kart kalınca geri sayım ekranı. (3) Günlük hedefe ulaşılmadan liste biterse düğmesiz, kendiliğinden ek kart: önce sınırın ötesinde yeni kelime, sonra erken tekrar (`get_extra_cards`, oturumda görülenler hariç). `sessionSummary` artık sayfayı yenilemez | Anki'nin 20 dk "learn ahead" davranışı iki kart arasında anında gidip gelmeye yol açıyordu; DuoCards'ta en kısa aralık 90 sn. Sayfa yenilenmesi hedefi iki kez sayıyordu (e2e yakaladı). |
| 2026-10-26 | FSRS'te kalınıp ilk adımlar DuoCards'a benzetildi (Tuna onayladı): öğrenme adımları `2m, 30m, 12h`, yeniden öğrenme `2m, 30m` (`src/lib/srs/config.ts`); sonrası FSRS. DuoCards'ın 90 sn'si yerine 2 dk: ts-fsrs yalnızca tam dakika kabul ediyor (`1.5m` → 1 dk'ya yuvarlanıyor). 'Doğru' denen yeni kelime 30 dk sonra döndüğü için oturumdan çıkar (20 dk penceresi dışında) | DuoCards'ın ilk gün sık pekiştirmesi + FSRS'in kişiye göre uzun vadeli aralıkları. Eski varsayılan 1m/10m idi. |
| 2026-10-26 | Çalışma ekranında hiçbir süre gösterilmez (Tuna'nın isteği): kaydırma ipucu ve GOOD/AGAIN damgalarında aralık yok, bekleme ekranında geri sayım yok ("birazdan" + animasyon; kart zamanı gelince kendiliğinden gelir). Kılavuzdan da süreler çıkarıldı | Kullanıcı aralıklara kafa yormasın; aralıklar gerekirse ileride deste sayfasında gösterilebilir. |
| 2026-10-19 | Güvenlik testleri Vitest içinde `tests/security/` altında, dosyalar sırayla çalışır | Aynı dev veritabanını paylaştıkları için birbirini bozmasınlar. |

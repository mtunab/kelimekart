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

_Diğer bölümler (kullanım, yedekleme, yayın) sonraki aşamalarda eklenecek._

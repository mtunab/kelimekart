# KelimeKart

Arkadaş grubu (en fazla 5 kişi) için aralıklı tekrarlı kelime kartı uygulaması.
Ayrıntılı proje kuralları: [CLAUDE.md](CLAUDE.md).

## Kurulum (geliştirme)

1. Node.js 22+ ve pnpm gerekir.
2. `pnpm install`
3. `.env.example` dosyasını `.env.local` adıyla kopyala, **dev** Supabase bilgileriyle doldur.
4. `pnpm db:push` — veritabanı şemasını dev projesine uygular.
5. `pnpm dev` — http://localhost:3000

## Komutlar

| Komut             | Ne yapar                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm verify`     | Tip kontrolü → lint → biçim kontrolü → birim/güvenlik testleri → derleme. Commit öncesi yeşil olmalı. |
| `pnpm verify:e2e` | Yukarıdakiler + tarayıcı (Playwright) testleri                                                        |
| `pnpm db:status`  | Dev veritabanında hangi migration'lar uygulanmış                                                      |
| `pnpm db:push`    | Bekleyen migration'ları dev veritabanına uygular                                                      |

_Diğer bölümler (kullanım, davet, yedekleme, yayın) sonraki aşamalarda eklenecek._

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Yardım · KelimeKart" };

/** Kullanım kılavuzu (KULLANIM.md ile aynı içerik). Girişsiz de açılır; kişisel veri yok. */
export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
      >
        ← KelimeKart
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kullanım kılavuzu</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Kelimeleri unutmadan ezberlemen için: her kartı tam unutmak üzereyken tekrar gösterir.
        </p>
      </div>

      <Section title="1. İlk giriş">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Grup yöneticisi sana bir <strong>kullanıcı adı</strong> ve <strong>şifre</strong> verir.
            Siteye gir ve bunlarla giriş yap.
          </li>
          <li>
            İstersen <em>Ayarlar → Şifre değiştir</em>&apos;den kendi şifreni koy (en az 8
            karakter). Hesabın kalıcıdır; sadece yönetici silebilir.
          </li>
          <li>
            <strong>Telefonuna uygulama gibi ekle:</strong> iPhone (Safari) → Paylaş →{" "}
            <em>Ana Ekrana Ekle</em>. Android (Chrome) → ⋮ menü → <em>Uygulamayı yükle</em>.
          </li>
        </ol>
      </Section>

      <Section title="2. Deste ve kelime ekleme">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Desteler</strong> → &quot;Yeni deste&quot;: ad ve dil çiftini seç.
          </li>
          <li>
            <strong>Hızlı ekleme:</strong> <em>Kelime</em> yaz → Enter → <em>Anlamı</em> yaz →
            Enter. Alanlar boşalır, sıradaki kelimeye geç. Aynı kelime varsa &quot;zaten var&quot;
            der.
          </li>
          <li>
            <strong>Toplu ekleme:</strong> <em>İçe aktar</em> → her satıra{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
              kelime ; anlam ; örnek
            </code>{" "}
            yaz ya da Excel&apos;den yapıştır → <em>Önizle</em> → <em>Ekle</em>.
          </li>
          <li>
            Kartı düzeltmek için listede kelimeye dokun; örnek cümle, not ve etiket ekleyebilirsin.
          </li>
          <li>
            <strong>Arşivle</strong>: kart çalışmada çıkmaz (silinmez, geri alınabilir).
          </li>
          <li>
            <strong>Üyeler:</strong> kelimeler ortaktır, ama herkesin ilerlemesi kendine özeldir.
          </li>
        </ul>
      </Section>

      <Section title="3. Çalışma">
        <p>Kelimeyi gör, anlamını aklından söyle, kartı çevir ve ne kadar iyi hatırladığını seç:</p>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="p-2">Düğme</th>
                <th className="p-2">Ne zaman</th>
                <th className="p-2">Klavye</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Tekrar", "Hatırlamadım", "1"],
                ["Zor", "Zorlandım ama hatırladım", "2"],
                ["İyi", "Hatırladım", "3"],
                ["Kolay", "Hiç düşünmeden bildim", "4"],
              ].map(([button, when, key]) => (
                <tr key={button} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="p-2 font-medium">{button}</td>
                  <td className="p-2">{when}</td>
                  <td className="p-2">{key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Düğmelerin altında kartın ne zaman tekrar geleceği yazar. Dürüst seç; gerisini uygulama
            ayarlar.
          </li>
          <li>
            <strong>Çevir:</strong> karta dokun ya da Boşluk. <strong>Telefonda:</strong>{" "}
            çevirdikten sonra sağa kaydır = İyi, sola = Tekrar.
          </li>
          <li>
            <strong>🔊 Dinle</strong> kelimeyi okur. <strong>↶ Geri al</strong> (klavyede Z) son
            cevabını geri alır.
          </li>
          <li>Her gün varsayılan olarak 10 yeni kart ve vadesi gelen tekrarlar gelir.</li>
          <li>
            Gün sabah 04:00&apos;te başlar. Her gün en az 1 kart çalışırsan seri (🔥) büyür; bir gün
            atlarsan sıfırlanır.
          </li>
        </ul>
      </Section>

      <Section title="4. İstatistik ve ayarlar">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>İstatistik:</strong> bugün ve son 7 gün, doğruluk, seri, 14 günlük tahmin,
            destelere göre yeni / öğreniliyor / olgun kartlar. <strong>Grup panosu</strong>nda
            herkesin sadece adı, bugünkü tekrar sayısı ve serisi görünür.
          </li>
          <li>
            <strong>Ayarlar:</strong> görünen ad, saat dilimi, günlük yeni kart, günlük hedef,
            şifre, tema.
          </li>
        </ul>
      </Section>

      <Section title="5. Sorun olursa">
        <ul className="list-disc space-y-1 pl-5">
          <li>Şifremi unuttum: grup yöneticisine söyle, sana yeni şifre verir.</li>
          <li>&quot;Çok fazla deneme yapıldı&quot;: 5 dakika bekle.</li>
          <li>
            Yeni kart gelmiyor: günün yeni kart sayısı dolmuş; Ayarlar&apos;dan artırabilirsin.
          </li>
          <li>&quot;Dinle&quot; ses çıkarmıyor: cihazında o dilin sesi yok.</li>
          <li>İnternet yokken uygulama çalışmaz; bağlantı gelince kaldığın yerden devam.</li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 text-zinc-800 dark:text-zinc-200">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

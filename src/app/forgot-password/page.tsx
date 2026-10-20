import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Şifremi unuttum · KelimeKart" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Şifremi unuttum">
      <div className="flex flex-col gap-3 text-center text-zinc-700 dark:text-zinc-300">
        <p>
          KelimeKart&apos;ta hesapları grup yöneticisi açar ve şifreleri o yeniler. Grup
          yöneticisine (Tuna) haber ver; sana yeni bir şifre verir.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Yeni şifreyle girdikten sonra istersen <strong>Ayarlar → Şifre değiştir</strong>{" "}
          bölümünden kendi şifreni belirleyebilirsin.
        </p>
      </div>
      <Link href="/login" className={buttonClass("primary", "w-full")}>
        Girişe dön
      </Link>
    </AuthCard>
  );
}

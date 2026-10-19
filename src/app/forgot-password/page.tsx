import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Şifremi unuttum · KelimeKart" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Şifremi unuttum">
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        E-posta adresini yaz, şifreni yenilemen için bir bağlantı gönderelim.
      </p>
      <ForgotForm />
    </AuthCard>
  );
}

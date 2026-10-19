import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Şifre belirle · KelimeKart" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Şifreni belirle">
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Bundan sonra bu şifreyle giriş yapacaksın.
      </p>
      <ResetForm />
    </AuthCard>
  );
}

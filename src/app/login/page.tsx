import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş · KelimeKart" };

const notices: Record<string, { tone: "error" | "success"; text: string }> = {
  link: { tone: "error", text: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste." },
  profil: { tone: "error", text: "Hesabın bulunamadı. Grup yöneticisiyle konuş." },
  cikis: { tone: "success", text: "Çıkış yaptın." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const key = typeof params.error === "string" ? params.error : params.durum;
  const notice = typeof key === "string" ? notices[key] : undefined;

  return (
    <AuthCard title="Giriş yap">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <LoginForm next={next} />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        KelimeKart davetle kullanılır. Hesabın yoksa grup yöneticisinden davet iste.
      </p>
    </AuthCard>
  );
}

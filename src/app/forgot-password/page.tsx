import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Forgot password · KelimeKart" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password">
      <div className="flex flex-col gap-3 text-center text-zinc-700 dark:text-zinc-300">
        <p>
          In KelimeKart, the group admin creates accounts and resets passwords. Let the admin (Tuna)
          know and they&apos;ll give you a new password.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          After logging in with the new password, you can pick your own under{" "}
          <strong>Settings → Change password</strong>.
        </p>
      </div>
      <Link href="/login" className={buttonClass("primary", "w-full")}>
        Back to log in
      </Link>
    </AuthCard>
  );
}

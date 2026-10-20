import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · KelimeKart" };

const notices: Record<string, { tone: "error" | "success"; text: string }> = {
  profile: { tone: "error", text: "Your account wasn't found. Talk to the group admin." },
  "signed-out": { tone: "success", text: "You've logged out." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const key = typeof params.error === "string" ? params.error : params.status;
  const notice = typeof key === "string" ? notices[key] : undefined;

  return (
    <AuthCard title="Log in">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <LoginForm next={next} />
      <p className="text-ink-soft text-center text-sm">
        KelimeKart is invite-only. If you don&apos;t have an account, ask the group admin.
      </p>
      <Link
        href="/help"
        className="self-center rounded-md px-2 py-2 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        How does it work?
      </Link>
    </AuthCard>
  );
}

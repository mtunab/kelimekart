import type { ReactNode } from "react";

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = { error: "bg-red", success: "bg-teal", info: "bg-blue" }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`border-ink text-on-accent shadow-hard-sm rounded-xl border-[2.5px] px-3 py-2 text-sm font-bold ${styles}`}
    >
      {children}
    </div>
  );
}

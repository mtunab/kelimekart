import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-[2.5px] border-ink bg-yellow text-on-accent press-sm",
  secondary: "border-[2.5px] border-ink bg-surface text-ink press-sm",
  ghost: "text-ink underline-offset-4 hover:bg-ink/10 hover:underline",
  danger: "border-[2.5px] border-ink bg-red text-on-accent press-sm",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

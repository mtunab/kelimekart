import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "KelimeKart",
  description: "Arkadaş grubu için aralıklı tekrarlı kelime kartları",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="tr"
      className={`h-full antialiased ${theme === "dark" ? "dark" : ""}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <head>
        {theme === "system" ? (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

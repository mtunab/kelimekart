import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "KelimeKart",
  description: "Spaced-repetition flashcards for a small group of friends",
  applicationName: "KelimeKart",
  appleWebApp: { capable: true, title: "KelimeKart", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
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
      lang="en"
      className={`h-full antialiased ${theme === "dark" ? "dark" : ""}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <head>
        {theme === "system" ? (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>{children}</MotionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

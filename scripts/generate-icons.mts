/**
 * public/icons/icon.svg'den PWA ikonlarını (PNG) üretir. Yeni paket gerektirmez:
 * zaten kurulu olan Playwright Chromium ile SVG'yi çizip ekran görüntüsü alır.
 *   pnpm icons
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const targets = [
  { file: "public/icons/icon-192.png", size: 192, padding: 0 },
  { file: "public/icons/icon-512.png", size: 512, padding: 0 },
  // "maskable": telefonlar kenarları kırpabilir; içerik güvenli alanda kalsın diye %10 boşluk.
  { file: "public/icons/maskable-512.png", size: 512, padding: 0.1, background: "#4f46e5" },
  { file: "public/icons/apple-touch-icon.png", size: 180, padding: 0 },
  { file: "public/icons/favicon-32.png", size: 32, padding: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.padding * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;display:grid;place-items:center;width:${t.size}px;height:${t.size}px;background:${t.background ?? "transparent"}">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: t.file, omitBackground: !t.background });
  console.log("✓", t.file);
}
await browser.close();

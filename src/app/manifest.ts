import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KelimeKart",
    short_name: "KelimeKart",
    description: "Spaced-repetition vocabulary cards for a group of friends",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Study", short_name: "Study", url: "/study" }],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soko Baringo",
    short_name: "Soko Baringo",
    description: "Fresh produce direct from Baringo farmers.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#33631f",
    lang: "en-KE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Buy produce", url: "/listings" },
      { name: "Agent orders", url: "/admin/orders" },
    ],
  };
}

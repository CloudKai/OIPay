import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OIPay",
    short_name: "OIPay",
    description: "Clear shared expenses, fair splits, and simple settlements.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f7f6",
    theme_color: "#12354b",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}

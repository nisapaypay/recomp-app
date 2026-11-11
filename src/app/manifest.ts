import type { MetadataRoute } from "next";

/** Web app manifest → served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recomp Nisa",
    short_name: "Recomp Nisa",
    description: "Personal 12-week body recomposition program and workout tracker.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any", // phone in portrait, laptop/monitor in landscape for workouts
    background_color: "#f7f6f3", // canvas (off-white)
    theme_color: "#f7f6f3",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

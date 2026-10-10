import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Box",
    short_name: "Recipes",
    description: "Save recipe photos and videos, tag them, find them, and plan one shopping trip for the week.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f4",
    theme_color: "#2f7a4f",
    // Android: Recipe Box shows up in the share menu, and a shared post opens a new recipe.
    // (iPhone doesn't offer this to home screen apps; see "Send to Recipe Box" in docs/SETUP.md.)
    share_target: {
      action: "/",
      method: "get",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

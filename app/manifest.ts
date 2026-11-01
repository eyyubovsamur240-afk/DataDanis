import type { MetadataRoute } from "next";

// Lets phones "add to home screen" and open DataDanış like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DataDanış — açıq statistika sadə dildə",
    short_name: "DataDanış",
    description: "Azərbaycanın rəsmi statistikası haqqında sual verin: cavab, qrafik və mənbə.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f2",
    theme_color: "#0e7c66",
    lang: "az",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

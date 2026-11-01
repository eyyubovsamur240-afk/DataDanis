import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataDanış — açıq statistika sadə dildə",
  description:
    "Azərbaycanın açıq dövlət statistikası haqqında sual verin: qısa cavab, qrafik və opendata.az mənbəsi. Ask about Azerbaijan's open statistics in plain language.",
  authors: [{ name: "Samur Eyyubov" }],
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "DataDanış — açıq statistika sadə dildə",
    description: "Azərbaycanın rəsmi statistikası haqqında sual verin: qısa cavab, qrafik və opendata.az mənbəsi.",
    type: "website",
    locale: "az_AZ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1420" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}

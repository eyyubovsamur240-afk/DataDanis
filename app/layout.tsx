import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataDanış — açıq statistika sadə dildə",
  description:
    "Azərbaycanın açıq dövlət statistikası haqqında sual verin: qısa cavab, qrafik və opendata.az mənbəsi. Ask about Azerbaijan's open statistics in plain language.",
  authors: [{ name: "Samur Eyyubov" }],
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}

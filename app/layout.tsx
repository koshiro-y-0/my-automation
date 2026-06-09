import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { SpaceBackground } from "./components/SpaceBackground";

export const metadata: Metadata = {
  title: "US Stock Watch",
  description:
    "米国株（IONQ・X-energy・Anthropic）情報収集・自動化ワークフロー",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockWatch",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="dark">
      <body>
        <SpaceBackground />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

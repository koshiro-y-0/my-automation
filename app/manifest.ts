import type { MetadataRoute } from "next";

/**
 * PWA manifest（設計書 §3 / 5-6）。
 * iPhone のホーム画面に追加してアプリとして利用するための定義。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "US Stock Watch",
    short_name: "StockWatch",
    description:
      "米国株（IONQ・X-energy・Anthropic）の情報を毎朝自動収集するパーソナル・ワークフロー",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

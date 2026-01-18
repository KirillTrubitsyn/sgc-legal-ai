import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "SGC Legal AI",
  description: "AI-ассистент юридической службы Сибирской генерирующей компании",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon-96.png?v=3", sizes: "96x96", type: "image/png" },
      { url: "/favicon-32.ico?v=3", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SGC Legal AI",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-sgc-blue-900 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}

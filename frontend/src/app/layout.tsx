import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "SGC Legal AI",
  description: "AI-ассистент юридической службы Сибирской генерирующей компании",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon-96.png?v=2", sizes: "96x96", type: "image/png" },
      { url: "/favicon-32.ico?v=2", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
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

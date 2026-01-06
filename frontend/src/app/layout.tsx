import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata = {
  title: "SGC Legal AI",
  description: "AI-ассистент юридической службы Сибирской генерирующей компании",
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

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "立場 BATTLE",
  description: "社会的テーマでAIと本気の議論対決をするスマホゲーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}

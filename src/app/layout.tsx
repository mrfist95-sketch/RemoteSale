import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "OnSale — B2B продажи",
  description: "Платформа оптовых продаж товаров",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OnSale", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b2545",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

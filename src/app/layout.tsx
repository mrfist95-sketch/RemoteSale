import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Toaster from "@/components/Toaster";

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
      <body className="min-h-full text-zinc-900 antialiased">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

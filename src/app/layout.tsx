import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIAgent from "@/components/AIAgent";
import SiteBackground from "@/components/SiteBackground";
import QRWidget from "@/components/QRWidget";

export const metadata: Metadata = {
  title: "Offshore Fleet Platform",
  description: "Vessel, offshore area & weather-downtime data platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-ink font-sans antialiased">
        <SiteBackground />
        <Providers>
          <div className="relative flex min-h-screen flex-col bg-grid">
            <Header />
            <main className="mx-auto flex-1 w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
            <Footer />
            <AIAgent />
            <QRWidget />
          </div>
        </Providers>
      </body>
    </html>
  );
}

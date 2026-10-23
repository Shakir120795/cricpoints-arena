import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "CricPoints Arena — Fantasy Cricket Predictions (Virtual Points)",
  description:
    "Predict cricket matches and play fair casino mini-games with virtual points. No real money — points have no cash value. Entertainment only, 18+.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#07090c] text-zinc-100">
        <AppProvider>
          {/* Header uses usePathname() — Suspense lets route shells prerender. */}
          <Suspense fallback={<div className="h-14 bg-[#0b0e13]" />}>
            <Header />
          </Suspense>
          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 pb-16">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}

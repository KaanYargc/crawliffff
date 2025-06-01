import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AuthProvider from "@/components/auth/auth-provider";
import Navbar from "@/components/auth/navbar";
import DB from "@/lib/db";

// Initialize database on server side
if (typeof window === 'undefined') {
  DB.init();
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crawlify - Lead Generation",
  description: "Simple lead generation form for collecting contact information",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 pt-16">{children}</main>
            <Toaster />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

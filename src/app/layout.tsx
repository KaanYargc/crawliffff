import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AuthProvider from "@/components/auth/auth-provider";
import DB from "@/lib/db";
import { initSupabase } from "@/lib/supabase";

// Initialize database on server side
if (typeof window === 'undefined') {
  DB.init();
}

// Initialize Supabase when the app starts
initSupabase().catch(console.error);

// Use CSS variables for fonts instead of next/font
// We'll use system fonts or web fonts loaded via CSS

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
      <head>
        {/* Load the Geist fonts using traditional <link> tags */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600;700&display=swap" />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col">
            <main className="flex-1 pt-16">{children}</main>
            <Toaster />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

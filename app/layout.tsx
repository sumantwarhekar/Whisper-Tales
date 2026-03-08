import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Whisper Tales — AI Interactive Fiction",
  description:
    "Enter the Destiny Terminal. Answer four questions. Then live — or die — by your choices. A cinematic AI-powered interactive story experience.",
  openGraph: {
    title: "Whisper Tales",
    description: "Your fate is yours to write.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${playfair.variable} ${geistMono.variable} antialiased bg-white text-zinc-900`}
      >
        {children}
        <Toaster
          theme="light"
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.1)",
              color: "rgba(0,0,0,0.75)",
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}

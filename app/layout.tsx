import type { Metadata } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Self-hosted instead of next/font/google: Next 16.2.4's bundled Google
// Fonts metadata points at a gstatic.com URL that 404s (Google rotated the
// file), which breaks builds on any machine without a stale local cache.
// IBM Plex Sans latin ships as one variable file covering weights 300-700.
const ibmPlexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  variable: "--font-ibm-plex-sans",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Report Builder — Sendible",
  description: "Social media analytics report builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden font-[family-name:var(--font-ibm-plex-sans)]">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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

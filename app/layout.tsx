import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://panal.local"),
  title: "Panal — Personal analytics, local-first",
  description:
    "Private, local-first personal analytics. Track your daily tasks, quantitative targets, and supported services such as GitHub and LeetCode — 100% on your device, no account required.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Panal" },
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
  openGraph: {
    title: "Panal — Personal analytics, local-first",
    description:
      "Private, local-first personal analytics. Track your daily tasks, quantitative targets, and supported services on your device.",
    siteName: "Panal",
    images: [{ url: "/panal-logo.png", width: 664, height: 196, alt: "Panal Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panal — Personal analytics, local-first",
    description: "Private, local-first personal analytics on your device.",
    images: ["/panal-logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
import { TooltipProvider } from "@/components/ui/tooltip";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./globals.css";
import Providers from "@/components/providers";
import PwaController from "@/components/pwa/pwa-controller";
import VisitTracker from "@/components/visit-tracker";
import SplashScreen from "@/components/splash-screen";
import ReviewPromptModal from "@/components/review-prompt-modal";
import { getSiteUrl, siteConfig } from "@/lib/site";
import { getCurrentUser } from "@/lib/session";
import { getReviewPromptPlayers } from "@/lib/review-prompt";
import { getTournamentConcluded } from "@/lib/app-settings";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  variable: "--font-inter",
  display: "swap",
});

const metadataBase = new URL(getSiteUrl());

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  applicationName: siteConfig.name,
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  keywords: ["fantacalcio", "torneo", "pwa", "mvp", "classifica"],
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: metadataBase,
    images: [{ url: "/icons/icon-1024.png", width: 1024, height: 1024, alt: "Fantadc" }],
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/icons/icon-1024.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: siteConfig.themeColor,
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, concluded] = await Promise.all([getCurrentUser(), getTournamentConcluded()]);
  const reviewPromptPlayers = user && !concluded ? await getReviewPromptPlayers(Number(user.id)) : [];

  return (
    <html lang="it" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col font-[var(--font-inter)]">
        <Providers>
          {!concluded && <SplashScreen />}
          {children}
          <ReviewPromptModal players={reviewPromptPlayers} />
          <VisitTracker />
          <PwaController />
        </Providers>
      </body>
    </html>
  );
}

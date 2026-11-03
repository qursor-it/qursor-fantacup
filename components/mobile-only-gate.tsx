"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { appStoreConfig, siteConfig } from "@/lib/site";
import StoreBadge from "./store-badge";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

function isMobileUserAgent(navigatorRef: NavigatorWithUserAgentData) {
  if (navigatorRef.userAgentData?.mobile) return true;

  const ua = navigatorRef.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Mobi/i.test(ua)) return true;

  return /Macintosh/i.test(ua) && navigatorRef.maxTouchPoints > 1;
}

function isTouchPrimaryDevice() {
  // Telefoni e tablet restano touch-primary anche con "sito desktop" attivo
  // (puntatore grossolano / nessun hover); un PC ha pointer:fine e hover:hover.
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export function shouldShowDesktopService() {
  if (typeof window === "undefined") return false;

  const navigatorRef = window.navigator as NavigatorWithUserAgentData;

  // 1) User-agent riconosciuto come mobile → consenti l'app
  if (isMobileUserAgent(navigatorRef)) return false;

  // 2) Dispositivo touch-primary (telefono/tablet, anche in modalita "sito desktop") → consenti
  if (isTouchPrimaryDevice()) return false;

  // 3) Altrimenti e desktop solo se il viewport e ampio
  return window.matchMedia("(min-width: 768px)").matches;
}

export function DesktopServicePage() {
  return (
    <main
      className="flex min-h-screen w-full flex-col"
      style={{ background: "var(--bg-base, #F5F6FF)" }}
    >
      {/* ── Hero ── */}
      <section
        className="relative flex flex-col items-center justify-center px-6 py-20 text-center"
        style={{
          minHeight: "58vh",
          background: "linear-gradient(160deg, #000228 0%, #0107A3 100%)",
        }}
      >
        {/* Radial gold glow behind logo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 65%, rgba(232,160,0,0.13) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 mb-7">
          <div
            aria-hidden="true"
            className="absolute -inset-5 rounded-full blur-2xl"
            style={{ background: "rgba(232,160,0,0.20)" }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-[28px]"
            style={{
              background: "rgba(255,255,255,0.09)",
              border: "1.5px solid rgba(255,255,255,0.18)",
              boxShadow: "0 8px 32px rgba(1,7,163,0.50)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteConfig.icon}
              alt={`${siteConfig.name} logo`}
              width={56}
              height={58}
            />
          </div>
        </div>

        {/* App name */}
        <h1
          className="relative z-10 font-display text-6xl font-black uppercase leading-none text-white"
          style={{ letterSpacing: "0.03em" }}
        >
          {siteConfig.name}
        </h1>

        {/* Subtitle */}
        <p
          className="relative z-10 mt-4 max-w-sm text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.68)" }}
        >
          {siteConfig.description}
        </p>

        {/* "Solo su mobile" badge */}
        <div
          className="relative z-10 mt-7 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{
            background: "rgba(232,160,0,0.15)",
            color: "#E8A000",
            border: "1px solid rgba(232,160,0,0.32)",
          }}
        >
          <svg
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
          </svg>
          Solo su mobile
        </div>
      </section>

      {/* ── Download section ── */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-md rounded-3xl bg-white p-8"
          style={{
            border: "1px solid var(--border-medium, #DDE1F7)",
            boxShadow:
              "0 20px 60px rgba(1,7,163,0.10), 0 4px 16px rgba(1,7,163,0.06)",
          }}
        >
          <div className="over-label mb-1">Disponibile su</div>

          <p
            className="mt-2 font-display text-2xl font-black uppercase leading-tight"
            style={{ color: "var(--text-primary, #09144C)" }}
          >
            Scarica {appStoreConfig.appName}
          </p>

          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--text-muted, #6466A3)" }}
          >
            Da desktop l&apos;app non è disponibile. Aprila dal tuo smartphone
            o scaricala dagli store.
          </p>

          {/* Store badges */}
          <div className="mt-6 flex flex-row flex-wrap items-center gap-4">
            <StoreBadge
              src="/images/app_store.png"
              alt="Scarica su App Store"
              url={appStoreConfig.appleAppStoreUrl}
            />
            <StoreBadge
              src="/images/play_store.png"
              alt="Disponibile su Google Play"
              url={appStoreConfig.googlePlayStoreUrl}
            />
          </div>
        </div>

        <p
          className="mt-5 text-center text-xs leading-5"
          style={{ color: "var(--text-muted, #6466A3)" }}
        >
          Se hai già installato l&apos;app, aprila dal tuo smartphone.
        </p>
      </section>
    </main>
  );
}

export default function MobileOnlyGate({ children }: { children: ReactNode }) {
  const [showDesktopService, setShowDesktopService] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateGate = () => setShowDesktopService(shouldShowDesktopService());

    updateGate();
    mediaQuery.addEventListener("change", updateGate);
    return () => mediaQuery.removeEventListener("change", updateGate);
  }, []);

  if (showDesktopService) return <DesktopServicePage />;

  return <>{children}</>;
}

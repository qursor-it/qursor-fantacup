import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Torneo concluso",
};

// Stessa grafica dello splash screen (components/splash-screen.tsx), ma come pagina statica.
export default function TorneoConclusoPage() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <img
        src="/images/splash-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: "rgba(9,20,76,0.55)" }} />

      <div className="relative h-full flex flex-col items-center justify-center gap-10 px-8 text-white text-center">
        <img
          src="/images/splash-logo.svg"
          alt={siteConfig.name}
          width={101}
          height={106}
          style={{ objectFit: "contain" }}
        />
        <div
          className="flex flex-col text-4xl items-center uppercase leading-tight gap-4"
          style={{ fontFamily: "var(--font-tallica)" }}
        >
          {siteConfig.titleLines.map((line) => <span key={line}>{line}</span>)}
        </div>
        <span
          className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ background: "#E8A000", color: "#09144C" }}
        >
          Torneo concluso
        </span>
        <p className="max-w-xs text-base leading-6" style={{ color: "rgba(255,255,255,0.85)" }}>
          Il torneo è terminato. Grazie a tutti per aver partecipato: ci vediamo alla prossima edizione!
        </p>
      </div>
    </main>
  );
}

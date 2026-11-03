import GVThemeWrapper from "@/components/gv-theme-wrapper";
import BackButton from "@/components/back-button";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contatti",
  description: "Contatti ufficiali organizzatori e sviluppatori di Fantadc.",
};

export default async function ContattiPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <GVThemeWrapper active={from === "greenvolley"}>
    <div className="flex flex-col gap-10 max-w-2xl">
      <div className="md:hidden flex items-center justify-between h-12">
        <div className="flex-1 flex items-center">
          <BackButton />
        </div>
        <span className="flex-1 text-center uppercase" style={{ fontFamily: "var(--font-tallica)", fontSize: 20, color: "var(--text-primary)" }}>
          Contatti
        </span>
        <div className="flex-1" />
      </div>

      <div className="flex flex-col gap-10">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Ultimo aggiornamento: <strong>13 maggio 2026</strong>
        </p>

        {/* Organizzatori */}
        <div>
          <h2
            className="text-base uppercase font-medium mb-3"
            style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", wordSpacing: "0.3em" }}
          >
            Organizzatori
          </h2>
          <ul className="text-base leading-relaxed space-y-2" style={{ color: "#000" }}>
            <li>
              {siteConfig.name}:{" "}
              <a href="https://www.instagram.com/danimarcas_cup/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                instagram.com/danimarcas_cup
              </a>
            </li>
            <li>
              Nuova Polisportiva Chianti:{" "}
              <a href="https://www.instagram.com/nuovapolisportivachianti/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                instagram.com/nuovapolisportivachianti
              </a>
            </li>
            <li>
              GreenVolley Cup:{" "}
              <a href="https://www.instagram.com/greenvolley_cup/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                instagram.com/greenvolley_cup
              </a>
            </li>
          </ul>
        </div>

        {/* Sviluppatori */}
        <div>
          <h2
            className="text-base uppercase font-medium mb-3"
            style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", wordSpacing: "0.3em" }}
          >
            Sviluppatori
          </h2>
          <div className="flex flex-col gap-5 mb-5">
            <div className="flex flex-col gap-1 text-base" style={{ color: "#000" }}>
              <span className="font-medium">Gianmarco Ferruzzi</span>
              <a href="https://www.instagram.com/gianmarcoferruzzi/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                instagram.com/gianmarcoferruzzi
              </a>
            </div>
            <div className="flex flex-col gap-1 text-base" style={{ color: "#000" }}>
              <span className="font-medium">Bryan Brucculeri</span>
              <a href="https://www.instagram.com/bryanbrucculeri_" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                instagram.com/bryanbrucculeri_
              </a>
            </div>
            <div className="flex flex-col gap-1 text-base" style={{ color: "#000" }}>
              <a href="https://qursor.it/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                qursor.it
              </a>
              <a href="mailto:info@qursor.it"
                className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                info@qursor.it
              </a>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0107A3 0%, #000669 100%)",
              boxShadow: "0 4px 24px rgba(1,7,163,0.25)",
            }}
          >
            <div className="px-5 py-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Image src="/logo_qursor.png" alt="Qursor" width={40} height={40} className="rounded-xl shrink-0" />
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Qursor
                  </div>
                  <div className="font-display font-black text-xl uppercase leading-tight text-white">
                    Hai un&apos;idea?<br />Costruiamola insieme.
                  </div>
                </div>
              </div>
              <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                Siamo aperti a sviluppare nuovi progetti web e app. Se hai un&apos;idea o hai bisogno di un&apos;applicazione su misura, scrivici.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="mailto:info@qursor.it"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: "#fff", color: "var(--primary)" }}>
                  <i className="pi pi-envelope text-xs" />
                  info@qursor.it
                </a>
                <a href="https://qursor.it/" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                  <i className="pi pi-external-link text-xs" />
                  qursor.it
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </GVThemeWrapper>
  );
}

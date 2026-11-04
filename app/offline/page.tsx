import Link from "next/link";
import MobileOnlyGate from "@/components/mobile-only-gate";

export const metadata = {
  title: "Offline",
};

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/classifica", label: "Classifica" },
  { href: "/partite", label: "Partite" },
  { href: "/regolamento", label: "Regolamento" },
];

export default function OfflinePage() {
  return (
    <MobileOnlyGate>
      <main
        className="min-h-screen px-4 py-10"
        style={{ background: "linear-gradient(180deg, #F5F6FF 0%, #FFFFFF 100%)" }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-6">
          <div
            className="overflow-hidden rounded-[32px] border px-6 py-8 shadow-xl"
            style={{
              background: "linear-gradient(160deg, #000228 0%, #0107A3 100%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 16px 48px rgba(1,7,163,0.2)",
            }}
          >
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-[20px]"
              style={{ background: "rgba(232,160,0,0.14)", color: "#E8A000" }}
            >
              <i className="pi pi-wifi text-xl" />
            </div>
            <h1 className="mt-5 font-display text-4xl font-black uppercase text-white">
              Sei offline
            </h1>
            <p className="mt-3 text-sm leading-6" style={{ color: "rgba(255,255,255,0.72)" }}>
              Sei offline. Collegati a internet per continuare: quando torni online,
              Fantadc aggiornerà automaticamente partite, classifica e dashboard.
            </p>
          </div>

          <section
            className="rounded-3xl border bg-white p-6"
            style={{ borderColor: "var(--border-medium)", boxShadow: "0 12px 32px rgba(1,7,163,0.08)" }}
          >
            <div className="over-label">Contenuti sempre utili</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border px-4 py-4 text-center font-display text-sm font-black uppercase tracking-wide transition-colors hover:opacity-90"
                  style={{
                    borderColor: "var(--border-medium)",
                    background: "var(--surface-1)",
                    color: "var(--text-primary)",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-6"
            style={{ borderColor: "var(--border-medium)", boxShadow: "0 12px 32px rgba(1,7,163,0.08)" }}
          >
            <div className="over-label">Suggerimento</div>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Se installi l&apos;app dalla schermata Home, Fantadc si apre in modalità full screen e mantiene una pagina offline pronta all&apos;uso.
            </p>
          </section>
        </div>
      </main>
    </MobileOnlyGate>
  );
}

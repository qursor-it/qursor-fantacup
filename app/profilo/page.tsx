import Link from "next/link";
import MobileOnlyGate from "@/components/mobile-only-gate";
import { getCurrentUser } from "@/lib/session";
import ProfiloLoggedIn from "./_logged-in";
import pkg from "@/package.json";
import { siteConfig } from "@/lib/site";

export default async function ProfiloPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  const { from } = await searchParams;
  const isGV = from === "greenvolley";

  if (user) {
    return (
      <MobileOnlyGate>
        <ProfiloLoggedIn name={user.name ?? user.email ?? ""} isAdmin={user.role === "ADMIN"} isGV={isGV} />
      </MobileOnlyGate>
    );
  }

  return (
    <MobileOnlyGate>
      <div className={`min-h-screen flex flex-col items-center justify-between py-6${isGV ? " gv-theme" : ""}`} style={{ background: "#F5F6FF" }}>
        <div className="w-full max-w-lg px-4 flex flex-col gap-10">

          <Link href={isGV ? "/greenvolley" : "/"} className="inline-flex items-center justify-center w-6 h-6">
            <i className="pi pi-chevron-left" style={{ fontSize: 12, color: "var(--text-primary)" }} />
          </Link>

          <div
            className="w-full rounded-3xl p-6 flex flex-col gap-4"
            style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
          >
            <h1
              className="uppercase text-base leading-snug"
              style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", fontWeight: 500 }}
            >
              {isGV ? "Ottieni altro da GreenVolley" : `Ottieni altro da ${siteConfig.name}`}
            </h1>
            <p className="text-sm text-black">
              {isGV ? "Crea il tuo account e accedi a tutti i contenuti." : "Crea il tuo account e partecipa al fanta."}
            </p>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-semibold"
                style={{ border: "1px solid var(--text-primary)", color: "var(--text-primary)" }}
              >
                Accedi
              </Link>
              <Link
                href="/register"
                className="flex-1 flex items-center justify-center py-2 rounded-lg text-xs text-white font-semibold"
                style={{ background: "var(--text-primary)" }}
              >
                Crea account
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Link href="/privacy" className="text-base text-black">Norme sulla privacy</Link>
            <Link href="/supporto" className="text-base text-black">Supporto app</Link>
          </div>

        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] text-black text-center">
            {isGV ? "GreenVolley — il campionato" : "Dove il calcio incontra la fantasia"}
          </p>
          <p className="text-[10px] text-center" style={{ color: "rgba(0,0,0,0.65)" }}>
            {`Copyright © ${new Date().getFullYear()} — Versione app ${pkg.version}`}
          </p>
        </div>
      </div>
    </MobileOnlyGate>
  );
}

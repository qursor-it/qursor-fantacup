"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { openReviewPrompt } from "@/lib/review-prompt-trigger";
import { siteConfig } from "@/lib/site";

export default function ProfiloLoggedIn({ name, isAdmin, isGV }: { name: string; isAdmin: boolean; isGV?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`min-h-screen flex flex-col items-center justify-between py-6${isGV ? " gv-theme" : ""}`} style={{ background: '#F5F6FF' }}>
      <div className="w-full max-w-lg px-4 flex flex-col gap-10">

        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link href={isGV ? "/greenvolley" : "/"} className="inline-flex items-center justify-center w-6 h-6">
            <i className="pi pi-chevron-left" style={{ fontSize: 12, color: "var(--text-primary)" }} />
          </Link>
          <h1
            className="uppercase"
            style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", fontSize: 20, fontWeight: 500 }}
          >
            Ciao, {name}
          </h1>
        </div>

        {/* Impostazioni account */}
        <div className="flex flex-col gap-4">
          <Link
            href="/account"
            className="flex items-center justify-between hover:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <i className="pi pi-shield" style={{ fontSize: 18, color: "var(--text-primary)" }} />
              <span className="text-base text-black">Impostazioni account</span>
            </div>
            <i className="pi pi-chevron-right" style={{ fontSize: 10, color: "var(--text-primary)" }} />
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center justify-between hover:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <i className="pi pi-cog" style={{ fontSize: 18, color: "var(--text-primary)" }} />
                <span className="text-base text-black">Admin</span>
              </div>
              <i className="pi pi-chevron-right" style={{ fontSize: 10, color: "var(--text-primary)" }} />
            </Link>
          )}
        </div>

        {/* Link list */}
        <div className="flex flex-col gap-4">
          <Link href="/privacy" className="text-base text-black">Norme sulla privacy</Link>
          <Link href="/supporto" className="text-base text-black">Supporto app</Link>
          <button type="button" onClick={openReviewPrompt} className="text-left text-base text-black">
            Lascia una recensione
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => logout())}
            className="text-left text-base disabled:opacity-40"
            style={{ color: "#DC2626" }}
          >
            {pending ? "Uscita in corso..." : "Esci"}
          </button>
        </div>

      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] text-black text-center">
          {isGV ? "GreenVolley — il campionato" : "Dove il calcio incontra la fantasia"}
        </p>
        <p className="text-[10px] text-center" style={{ color: "rgba(0,0,0,0.65)" }}>
          {`Copyright © ${new Date().getFullYear()} — ${siteConfig.name}`}
        </p>
      </div>
    </div>
  );
}

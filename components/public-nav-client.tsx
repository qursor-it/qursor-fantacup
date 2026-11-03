"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";
import { logout } from "@/app/actions/auth";

type PublicNavUser = {
  email: string;
  name?: string | null;
  role?: string;
};

const GV = "#0E3D2B";                          // accento brand lime (switcher + logo)
const GV_PRIMARY = "#0E3D2B";                  // verde profondo: stati attivi nav volley
const GV_PRIMARY_LIGHT = "rgba(14,61,43,0.08)";

const DCUP_GROUPS = [
  {
    label: "Torneo",
    items: [
      { href: "/partite",              label: "Partite"      },
      { href: "/gironi",               label: "Gironi"       },
      { href: "/eliminazione",         label: "Eliminazione" },
      { href: "/squadre",              label: "Squadre"      },
      { href: "/giocatori",            label: "Giocatori"    },
      { href: "/classifica-torneo",    label: "Classifica"   },
      { href: "/classifica-marcatori", label: "Marcatori"    },
    ],
  },
  {
    label: "Lega",
    items: [
      { href: "/squadre-fanta", label: "Classifica Lega" },
    ],
  },
];

const GV_LINKS = [
  { href: "/greenvolley",              label: "Home",        exact: true  },
  { href: "/greenvolley/partite",      label: "Partite",     exact: false },
  { href: "/greenvolley/classifica",   label: "Classifica",  exact: false },
  { href: "/greenvolley/gironi",       label: "Gironi",      exact: false },
  { href: "/greenvolley/eliminazione", label: "Eliminazione",exact: false },
  { href: "/greenvolley/squadre",      label: "Squadre",     exact: false },
];

function DcupDesktopNav({
  isActive,
}: {
  isActive: (href: string, exact?: boolean) => boolean;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const isGroupActive = (group: (typeof DCUP_GROUPS)[number]) =>
    group.items.some((item) => isActive(item.href));

  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node))
        setOpenGroup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroup]);

  return (
    <nav ref={navRef} className="hidden md:flex items-center gap-1 flex-1">
      {DCUP_GROUPS.map((group) => {
        const groupActive = isGroupActive(group);
        const isOpen = openGroup === group.label;
        return (
          <div key={group.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.label)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
              style={
                groupActive || isOpen
                  ? { background: "var(--primary-light)", color: "var(--primary)" }
                  : { color: "var(--text-muted)" }
              }
            >
              {group.label}
              <i
                className={`pi pi-chevron-down text-[10px] inline-block transition-transform duration-150 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div
                className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[160px] rounded-xl overflow-hidden"
                style={{
                  background: "#fff",
                  border: "1px solid var(--border-soft)",
                  boxShadow: "0 8px 24px rgba(1,7,163,0.13)",
                }}
              >
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenGroup(null)}
                      className="flex items-center px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
                      style={active ? { color: "var(--primary)" } : { color: "var(--text-primary)" }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <Link
        href="/regolamento"
        className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
        style={
          isActive("/regolamento")
            ? { background: "var(--primary-light)", color: "var(--primary)" }
            : { color: "var(--text-muted)" }
        }
      >
        Regolamento
      </Link>
      <Link
        href="/supporto"
        className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
        style={
          isActive("/supporto")
            ? { background: "var(--primary-light)", color: "var(--primary)" }
            : { color: "var(--text-muted)" }
        }
      >
        Supporto
      </Link>
    </nav>
  );
}

export default function PublicNavClient({ user }: { user: PublicNavUser | null }) {
  const pathname = usePathname();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [logoutPending, startTransition] = useTransition();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 0);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isVota = pathname.startsWith("/vota");
  const isPartiteDetail = /^\/partite\/\d+/.test(pathname) || /^\/greenvolley\/partite\/\d+/.test(pathname);
  const isSquadre = pathname.startsWith("/squadre") && !pathname.startsWith("/squadre-fanta");
  const isSquadreFantaDetail = pathname.startsWith("/squadre-fanta/");
  const isGironi = pathname.startsWith("/gironi");
  const isEliminazione = pathname.startsWith("/eliminazione");
  const isMarcatori = pathname.startsWith("/classifica-marcatori");
  const isGiocatori = pathname.startsWith("/giocatori");
  const isAltroPage = pathname.startsWith("/regolamento") || pathname.startsWith("/supporto") || pathname.startsWith("/contatti") || pathname.startsWith("/privacy") || pathname.startsWith("/account");
  const isGV = pathname.startsWith("/greenvolley");
  const isGVGironi = pathname.startsWith("/greenvolley/gironi");
  const isGVEliminazione = pathname.startsWith("/greenvolley/eliminazione");
  const isGVSquadreDetail = /^\/greenvolley\/squadre\/\d+/.test(pathname);
  const isSquadraPage = pathname.startsWith("/squadra");
  const isMvpPage = pathname === "/mvp" || /^\/mvp\/\d+/.test(pathname);
  const hideOnMobile = isVota || isPartiteDetail || isSquadre || isSquadreFantaDetail || isGironi || isEliminazione || isMarcatori || isGiocatori || isAltroPage || isGVGironi || isGVEliminazione || isGVSquadreDetail || isSquadraPage || isMvpPage;

  const getMobileTitle = (): string | null => {
    if (pathname.startsWith("/greenvolley/altro")) return null;
    if (isGV) {
      if (pathname.startsWith("/greenvolley/classifica")) return "Classifica";
      if (pathname.startsWith("/greenvolley/gironi")) return null;
      if (pathname.startsWith("/greenvolley/partite")) return "Partite";
      if (pathname.startsWith("/greenvolley/squadre")) return "Squadre";
      if (pathname.startsWith("/greenvolley/eliminazione")) return null;
      return null; // home e altro: pills switcher
    }
    if (pathname.startsWith("/partite")) return "Partite";
    if (pathname.startsWith("/squadre-fanta")) return "Lega";
    if (pathname.startsWith("/dashboard")) return "La mia rosa";
    if (pathname.startsWith("/squadra")) return null;
    if (pathname.startsWith("/altro")) return null;
    return null;
  };
  const mobileTitle = getMobileTitle();
  const primary = isGV ? GV_PRIMARY : "var(--primary)";

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node))
        setAvatarOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarOpen]);

  return (
    <header
      className={`sticky top-0 z-30${hideOnMobile ? " hidden md:block" : ""}`}
      style={{
        background: scrolled ? "#fff" : "transparent",
        borderBottom: scrolled ? "1px solid var(--border-soft)" : "none",
        boxShadow: scrolled ? (isGV ? "0 1px 8px rgba(14,61,43,0.08)" : "0 1px 8px rgba(1,7,163,0.06)") : "none",
        transition: "background 0.2s, box-shadow 0.2s",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-2 sm:gap-3">

        {/* ── Mobile header ──────────────────────────────────────── */}
        {mobileTitle ? (
          /* Main nav pages: page title */
          <h1
            className="md:hidden flex-1 uppercase font-medium text-xl"
            style={{ fontFamily: "var(--font-tallica)", color: isGV ? GV_PRIMARY : "var(--text-primary)" }}
          >
            {mobileTitle}
          </h1>
        ) : (
          /* Other pages: DCup / GV switcher pills */
          <div className="flex md:hidden items-center gap-3 flex-1 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-full text-white shrink-0 transition-colors"
              style={{ fontSize: 12, fontWeight: !isGV ? 600 : 500, background: !isGV ? "#09144C" : "rgba(0,0,0,0.25)" }}
            >
              <img src="/icons/dcup.svg" width={23} height={24} alt="DCup" />
              <span>DCup</span>
            </Link>
            <Link
              href="/greenvolley"
              className="flex items-center gap-2 px-3 py-2 rounded-full font-semibold text-white shrink-0 transition-colors"
              style={{ fontSize: 12, background: isGV ? GV : "rgba(0,0,0,0.25)" }}
            >
              <img src="/icons/green_volley.svg" width={27} height={24} alt="GreenVolley" />
              <span>Green Volley</span>
            </Link>
          </div>
        )}

        {/* ── Desktop logo + switcher ────────────────────────────── */}
        <Link href={isGV ? "/greenvolley" : "/"} className="hidden md:flex items-center gap-2 flex-shrink-0">
          <Image
            src={isGV ? "/logo_greenvolley.png" : "/logo_dc.png"}
            width={28}
            height={28}
            alt={isGV ? "GreenVolley logo" : "DCup logo"}
            className="rounded-lg"
          />
          <span
            className="font-display font-black text-[15px] uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isGV ? (
              <>GREEN<span style={{ color: GV }}>VOLLEY</span></>
            ) : (
              <><span style={{ color: "var(--primary)" }}>DCUP</span>{" "}<span style={{ color: "#E8A000" }}>26</span></>
            )}
          </span>
        </Link>
        <div
          className="hidden md:flex ml-0.5 items-center gap-0.5 rounded-full p-1"
          style={{ background: "var(--surface-1)" }}
        >
          <Link
            href="/"
            className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors"
            style={!isGV ? { background: "#fff", color: "var(--primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "var(--text-disabled)" }}
          >
            DCup
          </Link>
          <Link
            href="/greenvolley"
            className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors"
            style={isGV ? { background: "#fff", color: GV, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "var(--text-disabled)" }}
          >
            GreenVolley
          </Link>
        </div>

        {/* Desktop nav */}
        {isGV ? (
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {GV_LINKS.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
                  style={active ? { background: GV_PRIMARY_LIGHT, color: GV_PRIMARY } : { color: "var(--text-muted)" }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <DcupDesktopNav isActive={isActive} />
        )}

        {/* Auth */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {user ? (
            <div ref={avatarRef} className="relative">
              {/* Mobile: link to /profilo */}
              <Link href={isGV ? "/profilo?from=greenvolley" : "/profilo"} className="md:hidden w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70" aria-label="Profilo">
                <img src="/icons/profile_circle.svg" width={36} height={36} alt="Profilo" />
              </Link>
              {/* Desktop: dropdown */}
              <button
                type="button"
                onClick={() => setAvatarOpen((v) => !v)}
                className="hidden md:flex w-10 h-10 items-center justify-center transition-opacity hover:opacity-70"
                aria-label="Menu utente"
                aria-expanded={avatarOpen}
              >
                <img src="/icons/profile_circle.svg" width={40} height={40} alt="Profilo" />
              </button>
              {avatarOpen && (
                <div
                  className="absolute right-0 top-10 w-52 overflow-hidden rounded-2xl z-50"
                  style={{
                    background: "#fff",
                    border: "1px solid var(--border-soft)",
                    boxShadow: "0 8px 24px rgba(1,7,163,0.13)",
                  }}
                >
                  <div className="border-b border-[var(--border-soft)] px-4 py-3">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {user.name ?? user.email}
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <i className="pi pi-home text-sm" />
                      Dashboard
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <i className="pi pi-user-edit text-sm" />
                      Account
                    </Link>
                    {user.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        <i className="pi pi-cog text-sm" />
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={logoutPending}
                      onClick={() => { setAvatarOpen(false); startTransition(() => logout()); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-1)] disabled:opacity-50"
                      style={{ color: "#991B1B" }}
                    >
                      <i className="pi pi-sign-out text-sm" />
                      {logoutPending ? "Uscita in corso..." : "Esci"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/profilo"
                className="md:hidden w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70"
                aria-label="Profilo"
              >
                <img src="/icons/profile_circle.svg" width={36} height={36} alt="Profilo" />
              </Link>
              <Link
                href={isGV ? "/login?from=greenvolley" : "/login"}
                className="hidden md:inline text-sm font-semibold transition-colors px-2 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                Accedi
              </Link>
              <Link
                href={isGV ? "/register?from=greenvolley" : "/register"}
                className="hidden md:inline-flex text-xs px-4 py-2 rounded-full font-black uppercase tracking-wide transition-colors hover:opacity-90"
                style={{ background: primary, color: "#fff" }}
              >
                REGISTRATI
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { siteConfig } from "@/lib/site";

const GV = "#0E3D2B";

const DCUP_GROUPS = [
  { label: null, items: [{ href: "/admin", label: "Dashboard" }] },
  {
    label: "Torneo",
    items: [
      { href: "/admin/squadre",      label: "Squadre"      },
      { href: "/admin/giocatori",    label: "Giocatori"    },
      { href: "/admin/partite",      label: "Partite"      },
      { href: "/admin/gironi",       label: "Gironi"       },
      { href: "/admin/eliminazione", label: "Eliminazione" },
      { href: "/admin/bonus-types",  label: "Tipi bonus"   },
      { href: "/admin/classifica-bonus", label: "Classifica bonus" },
    ],
  },
  {
    label: "Fanta",
    items: [{ href: "/admin/squadre-fantasy", label: "Squadre Fanta" }],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/utenti", label: "Utenti" },
      { href: "/admin/audit",  label: "Audit"  },
    ],
  },
];

const GV_GROUPS = [
  { label: null, items: [{ href: "/admin/greenvolley", label: "Dashboard" }] },
  {
    label: "GreenVolley",
    items: [
      { href: "/admin/greenvolley/squadre",      label: "Squadre"      },
      { href: "/admin/greenvolley/giocatori",    label: "Giocatori"    },
      { href: "/admin/greenvolley/partite",      label: "Partite"      },
      { href: "/admin/greenvolley/gironi",       label: "Gironi"       },
      { href: "/admin/greenvolley/eliminazione", label: "Eliminazione" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/utenti", label: "Utenti" },
      { href: "/admin/audit",  label: "Audit"  },
    ],
  },
];

function AdminDesktopNav({ isGV }: { isGV: boolean }) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const GROUPS = isGV ? GV_GROUPS : DCUP_GROUPS;
  const primary = isGV ? GV : "var(--primary)";
  const primaryLight = isGV ? "#f0fde7" : "var(--primary-light)";

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/admin/greenvolley") return pathname === href;
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: (typeof GROUPS)[number]) =>
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
      {GROUPS.map((group) => {
        if (group.label === null) {
          const item = group.items[0];
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
              style={
                active
                  ? { background: primaryLight, color: primary }
                  : { color: "var(--text-muted)" }
              }
            >
              {item.label}
            </Link>
          );
        }

        const groupActive = isGroupActive(group);
        const isOpen = openGroup === group.label;

        return (
          <div key={group.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.label!)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
              style={
                groupActive || isOpen
                  ? { background: primaryLight, color: primary }
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
                      style={
                        active
                          ? { color: primary }
                          : { color: "var(--text-primary)" }
                      }
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
    </nav>
  );
}

export default function TopBar({
  initials,
  userName,
}: {
  initials: string;
  userName: string;
}) {
  const pathname = usePathname();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [logoutPending, startTransition] = useTransition();

  const isGV = pathname.startsWith("/admin/greenvolley");
  const primary = isGV ? GV : "var(--primary)";

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
      className="sticky top-0 z-30 h-14 flex items-center px-4 md:px-6"
      style={{
        background: "#fff",
        borderBottom: "1px solid var(--border-soft)",
        boxShadow: "0 1px 8px rgba(1,7,163,0.06)",
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3 w-full max-w-screen-xl mx-auto">
        {/* Logo */}
        <Link
          href={isGV ? "/admin/greenvolley" : "/admin"}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <Image
            src={isGV ? "/logo_greenvolley.png" : siteConfig.logo}
            width={28}
            height={28}
            alt={isGV ? "GreenVolley logo" : `${siteConfig.shortName} logo`}
            className="rounded-lg"
          />
          <span
            className="hidden sm:inline font-display font-black text-[14px] uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {isGV ? (
              <>GREEN<span style={{ color: GV }}>VOLLEY</span></>
            ) : (
              <>FANTA<span style={{ color: "var(--primary)" }}>DC</span></>
            )}
            <span
              className="ml-1.5 text-[10px] font-semibold normal-case tracking-normal"
              style={{ color: "var(--text-muted)" }}
            >
              admin
            </span>
          </span>
        </Link>

        {/* Sport switcher */}
        <div
          className="ml-0.5 flex flex-1 min-w-0 max-w-[220px] items-center gap-0.5 rounded-full p-1 sm:ml-0 sm:flex-initial sm:max-w-none"
          style={{ background: "var(--surface-1)" }}
        >
          <Link
            href="/admin"
            className="flex-1 min-w-0 px-2 py-1 sm:px-2.5 rounded-full text-center text-[9px] sm:text-[11px] font-black uppercase tracking-normal sm:tracking-wide transition-colors"
            style={
              !isGV
                ? { background: "#fff", color: "var(--primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "var(--text-disabled)", background: "transparent" }
            }
          >
            <span className="block truncate">{siteConfig.shortName}</span>
          </Link>
          <Link
            href="/admin/greenvolley"
            className="flex-1 min-w-0 px-2 py-1 sm:px-2.5 rounded-full text-center text-[9px] sm:text-[11px] font-black uppercase tracking-normal sm:tracking-wide transition-colors"
            style={
              isGV
                ? { background: "#fff", color: GV, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "var(--text-disabled)", background: "transparent" }
            }
          >
            <span className="block truncate">GreenVolley</span>
          </Link>
        </div>

        {/* Desktop nav con dropdown */}
        <AdminDesktopNav key={isGV ? "gv" : "dcup"} isGV={isGV} />

        {/* Avatar + dropdown */}
        <div ref={avatarRef} className="ml-auto relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setAvatarOpen((v) => !v)}
            className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-opacity hover:opacity-80"
            style={{ background: primary }}
            aria-label="Apri menu utente"
            aria-expanded={avatarOpen}
          >
            <i className="pi pi-user text-sm" aria-hidden />
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
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{ background: primary }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {userName}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Amministratore
                    </div>
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard"
                onClick={() => setAvatarOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
                style={{ color: "var(--text-primary)" }}
              >
                <i className="pi pi-user text-sm" />
                Vista utente
              </Link>
              <button
                type="button"
                disabled={logoutPending}
                onClick={() => {
                  setAvatarOpen(false);
                  startTransition(() => logout());
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-1)] disabled:opacity-50"
                style={{ color: "#991B1B" }}
              >
                <i className="pi pi-sign-out text-sm" />
                {logoutPending ? "Uscita in corso..." : "Logout"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

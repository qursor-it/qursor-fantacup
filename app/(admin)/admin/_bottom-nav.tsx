"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "primereact/button";
import { siteConfig } from "@/lib/site";

const GV = "#0E3D2B";

const DCUP_MAIN = [
  { href: "/admin",           label: "DASHBOARD", icon: "pi-home"     },
  { href: "/admin/partite",   label: "PARTITE",   icon: "pi-calendar" },
  { href: "/admin/giocatori", label: "GIOCATORI", icon: "pi-users"    },
  { href: "/admin/squadre",   label: "SQUADRE",   icon: "pi-shield"   },
];

const GV_MAIN = [
  { href: "/admin/greenvolley",           label: "DASHBOARD", icon: "pi-home"     },
  { href: "/admin/greenvolley/partite",   label: "PARTITE",   icon: "pi-calendar" },
  { href: "/admin/greenvolley/giocatori", label: "GIOCATORI", icon: "pi-users"    },
  { href: "/admin/greenvolley/squadre",   label: "SQUADRE",   icon: "pi-shield"   },
];

const DCUP_MORE = [
  { href: "/admin/gironi",          label: "Gironi",        icon: "pi-th-large" },
  { href: "/admin/eliminazione",    label: "Eliminazione",  icon: "pi-sitemap"  },
  { href: "/admin/utenti",          label: "Utenti",        icon: "pi-id-card"  },
  { href: "/admin/bonus-types",     label: "Tipi bonus",    icon: "pi-star"     },
  { href: "/admin/classifica-bonus",label: "Classifica bonus",icon: "pi-chart-bar"},
  { href: "/admin/squadre-fantasy", label: "Squadre Fanta", icon: "pi-trophy"   },
  { href: "/admin/modifiche-rosa",  label: "Modifiche rosa",icon: "pi-pencil"   },
  { href: "/admin/fasi-punteggio",  label: "Fasi punteggio",icon: "pi-flag"     },
  { href: "/admin/audit",           label: "Audit log",     icon: "pi-history"  },
  { href: "/admin/impostazioni",    label: "Impostazioni",  icon: "pi-sliders-h"},
];

const GV_MORE = [
  { href: "/admin/greenvolley/gironi",       label: "Gironi",       icon: "pi-th-large" },
  { href: "/admin/greenvolley/eliminazione", label: "Eliminazione", icon: "pi-sitemap"  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isGV = pathname.startsWith("/admin/greenvolley");
  const MAIN = isGV ? GV_MAIN : DCUP_MAIN;
  const MORE = isGV ? GV_MORE : DCUP_MORE;
  const primary = isGV ? GV : "var(--primary)";

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/admin/greenvolley") return pathname === href;
    return pathname.startsWith(href);
  };

  const moreIsActive = MORE.some((item) => isActive(item.href));

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(6,7,61,0.3)" }}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div
          className="fixed bottom-[64px] left-0 right-0 z-50 rounded-t-2xl md:hidden pb-safe"
          style={{
            background: "#fff",
            borderTop: "2px solid var(--border-medium)",
            boxShadow: "0 -4px 24px rgba(1,7,163,0.12)",
          }}
        >
          {/* Sport switcher nel drawer */}
          <div
            className="flex gap-1.5 px-4 pt-3 pb-2 border-b"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <Link
              href="/admin"
              onClick={() => setMoreOpen(false)}
              className="flex-1 py-1.5 text-center text-[10px] font-black uppercase rounded-full"
              style={
                !isGV
                  ? { background: "var(--primary-light)", color: "var(--primary)" }
                  : { background: "transparent", color: "var(--text-disabled)" }
              }
            >
              {siteConfig.shortName}
            </Link>
            <Link
              href="/admin/greenvolley"
              onClick={() => setMoreOpen(false)}
              className="flex-1 py-1.5 text-center text-[10px] font-black uppercase rounded-full"
              style={
                isGV
                  ? { background: "#f0fde7", color: GV }
                  : { background: "transparent", color: "var(--text-disabled)" }
              }
            >
              GreenVolley
            </Link>
          </div>

          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              ALTRO
            </span>
            <Button
              icon="pi pi-times"
              text
              onClick={() => setMoreOpen(false)}
              className="!p-1"
              style={{ color: "var(--text-muted)" }}
              aria-label="Chiudi"
            />
          </div>
          <div className="grid grid-cols-2 gap-1 px-3 pb-4">
            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors"
                style={
                  isActive(item.href)
                    ? { background: "var(--surface-1)", color: primary }
                    : { color: "var(--text-secondary)" }
                }
              >
                <i className={`pi ${item.icon} text-base`} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: "#fff",
          borderTop: "1px solid var(--border-soft)",
          boxShadow: "0 -2px 12px rgba(1,7,163,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex h-16">
          {MAIN.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
              >
                <div className="relative flex flex-col items-center">
                  {active && (
                    <span
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-b-full"
                      style={{ background: primary }}
                    />
                  )}
                  <i
                    className={`pi ${item.icon} text-xl`}
                    style={{ color: active ? primary : "var(--text-disabled)" }}
                  />
                </div>
                <span
                  className="text-[8px] font-black uppercase tracking-wide"
                  style={{ color: active ? primary : "var(--text-disabled)" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <Button
            unstyled
            onClick={() => setMoreOpen((v) => !v)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5"
          >
            <i
              className="pi pi-ellipsis-h text-xl"
              style={{
                color: moreIsActive || moreOpen ? primary : "var(--text-disabled)",
              }}
            />
            <span
              className="text-[8px] font-black uppercase tracking-wide"
              style={{
                color: moreIsActive || moreOpen ? primary : "var(--text-disabled)",
              }}
            >
              ALTRO
            </span>
          </Button>
        </div>
      </nav>
    </>
  );
}

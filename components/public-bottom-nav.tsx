"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GV = "#0E3D2B"; // verde profondo: stati attivi nav volley
const PRIMARY = "var(--text-primary)";

const DCUP_MORE = [
  { href: "/partite",               label: "Partite",      icon: "pi-calendar"       },
  { href: "/classifica-torneo",     label: "Class. squadre", icon: "pi-list"         },
  { href: "/classifica-marcatori",  label: "Marcatori",    icon: "pi-users"           },
  { href: "/gironi",                label: "Gironi",       icon: "pi-th-large"        },
  { href: "/eliminazione",          label: "Eliminazione", icon: "pi-sitemap"         },
  { href: "/giocatori",             label: "Giocatori",    icon: "pi-users"           },
  { href: "/squadre",               label: "Squadre",      icon: "pi-shield"          },
  { href: "/regolamento",           label: "Regolamento",  icon: "pi-book"            },
  { href: "/supporto",              label: "Supporto",     icon: "pi-question-circle" },
] as const;

// CSS filter che converte black → var(--text-primary) #09144C
const FILTER_PRIMARY = "invert(9%) sepia(50%) saturate(1800%) hue-rotate(210deg) brightness(55%) contrast(110%)";

function NavIcon({ src, active, tint }: { src: string; active: boolean; tint?: string }) {
  // Volley (tint): ricolora via mask → colore esatto su qualsiasi SVG (base black o navy)
  if (tint) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 24,
          height: 24,
          backgroundColor: active ? tint : "rgba(0,0,0,0.45)",
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    );
  }
  // Calcio: ricolora black → navy via filtro
  return (
    <img
      src={src}
      width={24}
      height={24}
      alt=""
      style={{
        filter: active ? FILTER_PRIMARY : "none",
        opacity: active ? 1 : 0.45,
      }}
    />
  );
}

const NAV_STYLE = {
  background: "rgba(255,255,255,0.80)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderTop: "1px solid rgba(9,20,76,0.05)",
  boxShadow: "0 -4px 20px rgba(9,20,76,0.10)",
  paddingBottom: "env(safe-area-inset-bottom)",
} as React.CSSProperties;

export default function PublicBottomNav() {
  const pathname = usePathname();

  const isGV = pathname.startsWith("/greenvolley");

  if (pathname.startsWith("/vota") || /^\/partite\/\d+/.test(pathname) || (pathname.startsWith("/squadre") && !pathname.startsWith("/squadre-fanta")) || /^\/squadre-fanta\/.+/.test(pathname) || pathname.startsWith("/gironi") || pathname.startsWith("/eliminazione") || pathname.startsWith("/classifica-marcatori") || pathname.startsWith("/regolamento") || pathname.startsWith("/supporto") || pathname.startsWith("/contatti") || pathname.startsWith("/privacy") || pathname.startsWith("/account") || pathname.startsWith("/giocatori") || pathname.startsWith("/squadra") || pathname === "/mvp" || /^\/mvp\/\d+/.test(pathname)) return null;

  const isActive = (href: string, matchers?: readonly string[]) => {
    if (matchers) return matchers.some((m) => pathname === m || pathname.startsWith(m + "/"));
    if (href === "/" || href === "/greenvolley") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const navItemStyle = (active: boolean, color = PRIMARY) => ({
    color: active ? color : "rgba(0,0,0,0.55)",
    fontWeight: active ? 500 : 400,
  });

  // ─── GreenVolley ────────────────────────────────────────────────────────────
  if (isGV) {
    const GV_MAIN = [
      { href: "/greenvolley",            label: "Home",      icon: "home"        },
      { href: "/greenvolley/partite",    label: "Partite",   icon: "volley_court" },
      { href: "/greenvolley/classifica", label: "Classifica",icon: "table"       },
      { href: "/greenvolley/squadre",    label: "Squadre",   icon: "shield-star" },
    ] as const;
    const moreIsActive = pathname.startsWith("/greenvolley/altro");

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={NAV_STYLE}>
        <div className="flex px-1 py-2.5">
          {GV_MAIN.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 py-1">
                <NavIcon src={`/icons/${item.icon}.svg`} active={active} tint={GV} />
                <span className="text-[10px] text-center" style={navItemStyle(active, GV)}>{item.label}</span>
              </Link>
            );
          })}
          <Link href="/greenvolley/altro" className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 py-1">
            <NavIcon src="/icons/more.svg" active={moreIsActive} tint={GV} />
            <span className="text-[10px]" style={navItemStyle(moreIsActive, GV)}>Altro</span>
          </Link>
        </div>
      </nav>
    );
  }

  // ─── Torneo ───────────────────────────────────────────────────────────────────
  const moreIsActive = pathname.startsWith("/altro");

  const DCUP_MAIN = [
    { href: "/",             label: "Home",   icon: "home",     matchers: undefined          },
    { href: "/partite",      label: "Partite",icon: "football_field", matchers: undefined    },
    { href: "/dashboard",    label: "La mia rosa", icon: "shirt",   matchers: ["/dashboard", "/squadra"] },
    { href: "/squadre-fanta",label: "Lega",       icon: "account", matchers: undefined          },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={NAV_STYLE}>
      <div className="flex px-1 py-2.5">
        {DCUP_MAIN.map((item) => {
          const active = isActive(item.href, item.matchers);
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 py-1">
              <NavIcon src={`/icons/${item.icon}.svg`} active={active} />
              <span className="text-[10px] text-center" style={navItemStyle(active)}>{item.label}</span>
            </Link>
          );
        })}
        <Link href="/altro" className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 py-1">
          <NavIcon src="/icons/more.svg" active={moreIsActive} />
          <span className="text-[10px]" style={navItemStyle(moreIsActive)}>Altro</span>
        </Link>
      </div>
    </nav>
  );
}

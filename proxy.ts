import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { getTournamentConcluded } from "@/lib/app-settings";

const CONCLUDED_PATH = "/torneo-concluso";

export const proxy = auth(
  async (
    req: NextRequest & {
      auth: { user?: { role?: string; id?: string } } | null;
    }
  ) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;
    const isAuthenticated = !!session?.user?.id;
    const isAdmin = session?.user?.role === UserRole.ADMIN;

    // Torneo concluso: i non-admin vedono solo la pagina dedicata (/login e /admin restano raggiungibili per far entrare gli admin).
    // Se il DB non risponde, il sito resta accessibile invece di andare giù.
    const concluded = await getTournamentConcluded().catch(() => false);
    if (pathname === CONCLUDED_PATH) {
      return concluded ? NextResponse.next() : NextResponse.redirect(new URL("/", req.url));
    }
    if (concluded && !isAdmin && pathname !== "/login" && !pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL(CONCLUDED_PATH, req.url));
    }

    // Protezione area admin
    if (pathname.startsWith("/admin")) {
      if (!isAuthenticated) {
        return NextResponse.redirect(
          new URL("/login?next=" + encodeURIComponent(pathname), req.url)
        );
      }
      if (!isAdmin) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Protezione area utente autenticato
    const userPaths = ["/dashboard", "/squadra", "/vota"];
    if (userPaths.some((p) => pathname.startsWith(p))) {
      if (!isAuthenticated) {
        return NextResponse.redirect(
          new URL("/login?next=" + encodeURIComponent(pathname), req.url)
        );
      }
    }

    // Redirect autenticati via da login/register
    if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  }
);

export const config = {
  // Tutte le pagine (serve al flag "torneo concluso"), esclusi API, asset Next e file statici.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};

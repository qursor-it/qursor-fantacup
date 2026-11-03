import { tournament } from "@/tournaments";

export const siteConfig = {
  ...tournament.site,
  scope: "/",
  startUrl: "/",
  offlineUrl: "/offline",
};

export const appStoreConfig = tournament.appStore;

function resolveAppUrl(value: string | undefined) {
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Fantadc PWA] NEXTAUTH_URL/NEXT_PUBLIC_APP_URL not set, falling back to localhost metadata URLs.");
    }

    return "http://localhost:3000";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

export function getSiteUrl() {
  return resolveAppUrl(process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL);
}

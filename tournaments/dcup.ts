import type { TournamentConfig } from "./index";

export const dcup = {
  site: {
    name: "Danimarca's Cup",
    shortName: "DCup",
    description: "L'app ufficiale della Danimarca's Cup, il torneo di calcio più grevigiano di sempre.",
    themeColor: "#0107A3",
    backgroundColor: "#F5F6FF",
    logo: "/logo_dc.png",
    icon: "/icons/dcup.svg",
    edition: "26",
    titleLines: ["Danimarca's", "Cup 26"],
    categories: ["sports", "games", "entertainment"],
    shortcuts: [
      {
        name: "Classifica",
        shortName: "Classifica",
        description: "Apri la classifica fantasy aggiornata.",
        url: "/classifica",
        icon: "/icons/icon-192.png",
      },
      {
        name: "Partite",
        shortName: "Partite",
        description: "Controlla calendario e risultati del torneo.",
        url: "/partite",
        icon: "/icons/icon-192.png",
      },
      {
        name: "Dashboard",
        shortName: "Dashboard",
        description: "Vai alla tua area personale.",
        url: "/dashboard",
        icon: "/icons/icon-192.png",
      },
    ],
  },
  appStore: {
    appName: "Danimarca's Cup",
    appleAppStoreUrl: "https://apps.apple.com/it/app/danimarcas-cup/id6768604629",
    googlePlayStoreUrl: "https://play.google.com/store/apps/details?id=it.nuovapolisportivachianti.dcup",
  },
  rules: { goalkeepers: 1, outfieldPlayers: 4, captainMultiplier: 2, mvpWindowMinutes: 120, defaultMvpPoints: 3 },
} satisfies TournamentConfig;

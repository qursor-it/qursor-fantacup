import { dcup } from "./dcup";

export type TournamentConfig = {
  site: {
    name: string;
    shortName: string;
    description: string;
    themeColor: string;
    backgroundColor: string;
    logo: string;
    icon: string;
    edition: string;
    titleLines: string[];
    categories: string[];
    shortcuts: { name: string; shortName: string; description: string; url: string; icon: string }[];
  };
  appStore: {
    appName: string;
    appleAppStoreUrl: string | null;
    googlePlayStoreUrl: string | null;
  };
  rules: {
    goalkeepers: number;
    outfieldPlayers: number;
    captainMultiplier: number;
    mvpWindowMinutes: number;
    defaultMvpPoints: number;
  };
};

const tournaments: Record<string, TournamentConfig> = { dcup };

const id = process.env.NEXT_PUBLIC_TOURNAMENT ?? "dcup";
const selected = tournaments[id];
if (!selected) {
  throw new Error(`Unknown NEXT_PUBLIC_TOURNAMENT "${id}". Available: ${Object.keys(tournaments).join(", ")}`);
}

export const tournament: TournamentConfig = selected;

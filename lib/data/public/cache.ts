import "server-only";

import { unstable_cache } from "next/cache";
import { measureServerTiming } from "@/lib/perf";

type AsyncDataLoader = Parameters<typeof unstable_cache>[0];

type PublicCacheOptions<T extends AsyncDataLoader> = {
  tags: string[];
  revalidate: number;
  hydrate?: (value: Awaited<ReturnType<T>>) => Awaited<ReturnType<T>>;
};

export const PUBLIC_CACHE_TTL_SECONDS = {
  live: 60,
  stable: 300,
} as const;

export const PUBLIC_CACHE_TAGS = {
  bonuses: "public:bonuses",
  dcup: "public:dcup",
  dcupMatches: "public:dcup:matches",
  dcupPlayers: "public:dcup:players",
  dcupScorers: "public:dcup:scorers",
  dcupStandings: "public:dcup:standings",
  dcupTeams: "public:dcup:teams",
  fantasy: "public:fantasy",
  fantasyPicks: "public:fantasy:picks",
  fantasyRankings: "public:fantasy:rankings",
  mvp: "public:mvp",
  volley: "public:volley",
  volleyMatches: "public:volley:matches",
  volleyStandings: "public:volley:standings",
  volleyTeams: "public:volley:teams",
} as const;

export function cachePublicData<T extends AsyncDataLoader>(
  timingLabel: string,
  loader: T,
  keyParts: string[],
  options: PublicCacheOptions<T>
): T {
  const cachedLoader = unstable_cache(loader, keyParts, {
    tags: options.tags,
    revalidate: options.revalidate,
  });

  return (async (...args: Parameters<T>) =>
    measureServerTiming(timingLabel, async () => {
      const value = await cachedLoader(...args);
      return options.hydrate ? options.hydrate(value) : value;
    })) as T;
}

export function revivePublicDates<T>(value: T): T {
  return reviveDateFields(value, new Set(["startsAt", "concludedAt", "date", "lastClosedAt"]));
}

function reviveDateFields<T>(value: T, dateKeys: Set<string>): T {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((item) => reviveDateFields(item, dateKeys)) as T;
  }

  const revived: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && dateKeys.has(key)) {
      revived[key] = new Date(child);
    } else {
      revived[key] = reviveDateFields(child, dateKeys);
    }
  }

  return revived as T;
}

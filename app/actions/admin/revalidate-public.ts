import { revalidatePath, updateTag } from "next/cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/data/public/cache";
import { invalidateFantasyRankingSnapshot } from "@/lib/fantasy-ranking-snapshot";

const DCUP_PUBLIC_PATHS = [
  "/",
  "/partite",
  "/gironi",
  "/eliminazione",
  "/squadre",
  "/giocatori",
  "/classifica-torneo",
  "/classifica-marcatori",
  "/classifica-fanta",
  "/giocatori-fanta",
  "/squadre-fanta",
  "/mvp",
];

const VOLLEY_PUBLIC_PATHS = [
  "/greenvolley",
  "/greenvolley/partite",
  "/greenvolley/classifica",
  "/greenvolley/gironi",
  "/greenvolley/eliminazione",
  "/greenvolley/squadre",
];

const FANTASY_PUBLIC_PATHS = [
  "/classifica-fanta",
  "/giocatori-fanta",
  "/squadre-fanta",
];

function updatePublicCacheTags(tags: string[]) {
  for (const tag of tags) updateTag(tag);
}

export async function revalidateDcupPublicPaths(matchId?: number) {
  for (const path of DCUP_PUBLIC_PATHS) revalidatePath(path);
  if (matchId) {
    revalidatePath(`/partite/${matchId}`);
    revalidatePath(`/mvp/${matchId}`);
  }
  updatePublicCacheTags([
    PUBLIC_CACHE_TAGS.dcup,
    PUBLIC_CACHE_TAGS.dcupMatches,
    PUBLIC_CACHE_TAGS.dcupPlayers,
    PUBLIC_CACHE_TAGS.dcupScorers,
    PUBLIC_CACHE_TAGS.dcupStandings,
    PUBLIC_CACHE_TAGS.dcupTeams,
    PUBLIC_CACHE_TAGS.fantasy,
    PUBLIC_CACHE_TAGS.fantasyRankings,
    PUBLIC_CACHE_TAGS.mvp,
  ]);
  await invalidateFantasyRankingSnapshot();
}

export function revalidateBonusPublicPaths() {
  revalidatePath("/bonus-pubblici");
  revalidatePath("/bonus-segreti");
  updatePublicCacheTags([PUBLIC_CACHE_TAGS.bonuses]);
}

export async function revalidateFantasyPublicPaths(teamId?: number) {
  for (const path of FANTASY_PUBLIC_PATHS) revalidatePath(path);
  if (teamId) revalidatePath(`/squadre-fanta/${teamId}`);
  updatePublicCacheTags([
    PUBLIC_CACHE_TAGS.fantasy,
    PUBLIC_CACHE_TAGS.fantasyPicks,
    PUBLIC_CACHE_TAGS.fantasyRankings,
  ]);
  await invalidateFantasyRankingSnapshot();
}

export function revalidateVolleyPublicPaths(matchId?: number) {
  for (const path of VOLLEY_PUBLIC_PATHS) revalidatePath(path);
  if (matchId) revalidatePath(`/greenvolley/partite/${matchId}`);
  updatePublicCacheTags([
    PUBLIC_CACHE_TAGS.volley,
    PUBLIC_CACHE_TAGS.volleyMatches,
    PUBLIC_CACHE_TAGS.volleyStandings,
    PUBLIC_CACHE_TAGS.volleyTeams,
  ]);
}

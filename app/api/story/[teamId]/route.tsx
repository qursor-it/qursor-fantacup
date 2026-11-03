import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appStoreConfig, siteConfig } from "@/lib/site";
import { computeTeamHistory, getTeamPhaseBreakdown, roundPoints } from "@/lib/scoring";
import { resolveTeamFlag } from "@/lib/flags";
import { checkRateLimit, getClientIp, storyImageLimiter } from "@/lib/rate-limit";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const W = 1080;
const H = 1920;

function assetSrc(buffer: Buffer, type: "png" | "jpeg" | "svg+xml" = "png") {
  return `data:image/${type};base64,${buffer.toString("base64")}`;
}

function fitStoryText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatPoints(value: number, options?: { signed?: boolean }) {
  const normalized = Object.is(value, -0) ? 0 : value;
  const formatted = normalized.toFixed(1);
  if (options?.signed && normalized > 0) return `+${formatted}`;
  return formatted;
}

// La bandiera è self-hosted (/flags/{cc}.png): Satori non carica path relativi,
// quindi leggo il PNG da disco e lo inlino come data-URI. Un eventuale logo
// custom esterno (URL assoluto) viene invece passato così com'è.
async function resolveFlagAsset(team: {
  countryCode: string | null;
  logoUrl: string | null;
}): Promise<string | null> {
  const src = resolveTeamFlag(team);
  if (!src) return null;
  if (src.startsWith("/")) {
    try {
      const buffer = await readFile(path.join(process.cwd(), "public", src));
      const type = src.toLowerCase().endsWith(".svg") ? "svg+xml" : "png";
      return assetSrc(buffer, type);
    } catch {
      return null;
    }
  }
  return src;
}

function displayTeamCode(team: {
  countryCode: string | null;
  shortName: string | null;
  name: string;
}) {
  return fitStoryText((team.countryCode ?? team.shortName ?? team.name).toUpperCase(), 8);
}

const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId: teamIdStr } = await params;
    if (!/^[1-9]\d{0,9}$/.test(teamIdStr)) return new Response("Team not found", { status: 404 });
    const teamId = Number(teamIdStr);
    if (!Number.isSafeInteger(teamId) || teamId > 2_147_483_647) {
      return new Response("Team not found", { status: 404 });
    }

    // Rate limit per IP (in memoria, per istanza: vedi lib/rate-limit.ts)
    const limit = await checkRateLimit(storyImageLimiter, `story:ip:${getClientIp(req.headers)}`);
    if (limit.limited) {
      return new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter ?? 60) },
      });
    }

    const [team, logoBuffer, appStoreBuffer, playStoreBuffer] = await Promise.all([
      db.fantasyTeam.findUnique({
        where: { id: teamId },
        include: {
          user: { select: { name: true } },
          players: {
            include: {
              player: {
                include: {
                  footballTeam: {
                    select: {
                      name: true,
                      shortName: true,
                      countryCode: true,
                      logoUrl: true,
                    },
                  },
                },
              },
            },
          },
          captain: { select: { id: true } },
        },
      }),
      readFile(path.join(process.cwd(), "public", "images", "splash-logo.svg")),
      readFile(path.join(process.cwd(), "public", "images", "app_store.png")),
      readFile(path.join(process.cwd(), "public", "images", "play_store.png")),
    ]);

    if (!team) return new Response("Team not found", { status: 404 });

    const history = await computeTeamHistory(teamId);
    // Totale cumulativo coerente con la classifica (fasi congelate + fase in corso).
    const phaseBreakdown = await getTeamPhaseBreakdown(teamId);
    const totalPoints = phaseBreakdown.reduce((s, p) => s + p.points, 0);
    const playerTotals = new Map<number, number>();

    for (const match of history) {
      for (const score of match.playerScores) {
        playerTotals.set(
          score.playerId,
          (playerTotals.get(score.playerId) ?? 0) + score.finalPoints
        );
      }
    }

    const logoSrc = assetSrc(logoBuffer, "svg+xml");
    const appStoreSrc = assetSrc(appStoreBuffer);
    const playStoreSrc = assetSrc(playStoreBuffer);

    const captain = team.players.find((p) => p.player.id === team.captainPlayerId);
    const others = team.players.filter((p) => p.player.id !== team.captainPlayerId);
    const sortedPlayers = captain
      ? [
          captain,
          ...others.filter((p) => p.player.role === "P"),
          ...others.filter((p) => p.player.role === "A"),
        ]
      : [
          ...team.players.filter((p) => p.player.role === "P"),
          ...team.players.filter((p) => p.player.role === "A"),
        ];

    const flagByPlayer = new Map<number, string | null>(
      await Promise.all(
        sortedPlayers.map(
          async ({ player }) =>
            [player.id, await resolveFlagAsset(player.footballTeam)] as const
        )
      )
    );

    // Le righe mostrano solo la rosa attuale: il residuo (giocatori pre-mercato)
    // allinea la loro somma al TOTALE cumulativo.
    const displayedTotal = roundPoints(
      sortedPlayers.reduce(
        (sum, { player }) => sum + (playerTotals.get(player.id) ?? 0),
        0
      )
    );
    const residualPoints = roundPoints(totalPoints - displayedTotal);

    // Mai esporre l'email (nemmeno la parte locale) in un'immagine pubblica.
    const ownerName = fitStoryText(team.user.name?.trim() || "Utente", 28);
    const displayTeamName = fitStoryText(team.name.toUpperCase(), 20);
    const teamNameFontSize =
      displayTeamName.length > 18 ? 52 : displayTeamName.length > 14 ? 58 : 64;

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #000c9a 0%, #00033a 100%)",
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 330,
              top: 925,
              width: 420,
              height: 420,
              borderRadius: 210,
              border: "3px solid rgba(255,255,255,0.06)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 72,
              top: 455,
              width: 3,
              height: 1133,
              backgroundColor: "rgba(255,255,255,0.08)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 72,
              top: 455,
              width: 3,
              height: 1133,
              backgroundColor: "rgba(255,255,255,0.08)",
              display: "flex",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              position: "absolute",
              left: 56,
              top: 58,
              gap: 20,
            }}
          >
            <img
              src={logoSrc}
              width={80}
              height={80}
              style={{ objectFit: "contain" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                {`FANTA ${siteConfig.shortName.toUpperCase()}`}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1,
                }}
              >
                LA MIA SQUADRA
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              top: 252,
              right: 470,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: teamNameFontSize,
                fontWeight: 800,
                lineHeight: 1.08,
                whiteSpace: "nowrap",
              }}
            >
              {displayTeamName}
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 28,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1,
              }}
            >
              {`di ${ownerName}`}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 72,
              top: 226,
              width: 290,
              height: 148,
              borderRadius: 30,
              backgroundColor: "rgba(255,255,255,0.11)",
              border: "2px solid rgba(255,255,255,0.14)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              TOTALE
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: "#FBBF24",
                lineHeight: 0.95,
              }}
            >
              {formatPoints(totalPoints)}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              top: 480,
              display: "flex",
              flexDirection: "column",
              gap: residualPoints !== 0 ? 32 : 51,
            }}
          >
            {sortedPlayers.map(({ player }) => {
              const isCaptain = player.id === team.captainPlayerId;
              const flagSrc = flagByPlayer.get(player.id) ?? null;
              const teamCode = displayTeamCode(player.footballTeam);
              const displayName = fitStoryText(player.name, 24);
              const playerPoints = playerTotals.get(player.id) ?? 0;
              const playerNameFontSize = displayName.length > 20 ? 34 : 40;

              return (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    height: 154,
                    width: "100%",
                    borderRadius: 30,
                    padding: "0 52px 0 32px",
                    backgroundColor: isCaptain
                      ? "rgba(251,191,36,0.16)"
                      : "rgba(255,255,255,0.11)",
                    border: isCaptain
                      ? "2px solid rgba(251,191,36,0.46)"
                      : "2px solid rgba(255,255,255,0.12)",
                    gap: 26,
                  }}
                >
                  <div
                    style={{
                      width: 98,
                      height: 66,
                      borderRadius: 14,
                      border: "2px solid rgba(255,255,255,0.30)",
                      backgroundColor: "rgba(255,255,255,0.10)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {flagSrc ? (
                      <img
                        src={flagSrc}
                        width={98}
                        height={66}
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 24,
                          color: "rgba(255,255,255,0.70)",
                          fontWeight: 800,
                        }}
                      >
                        {teamCode.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: playerNameFontSize,
                        fontWeight: 800,
                        color: "#ffffff",
                        lineHeight: 1.1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 24,
                        fontWeight: 800,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1,
                        letterSpacing: 0.4,
                      }}
                    >
                      {teamCode}
                    </div>
                  </div>

                  <div
                    style={{
                      width: 166,
                      height: 82,
                      borderRadius: 26,
                      backgroundColor: isCaptain ? "#FBBF24" : "#F4F6FF",
                      color: "#000546",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 54,
                      fontWeight: 800,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {formatPoints(playerPoints, { signed: true })}
                  </div>
                </div>
              );
            })}

            {residualPoints !== 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  height: 154,
                  width: "100%",
                  borderRadius: 30,
                  padding: "0 52px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "2px solid rgba(255,255,255,0.12)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1.1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Altri (pre-mercato)
                  </div>
                </div>

                <div
                  style={{
                    width: 166,
                    height: 82,
                    borderRadius: 26,
                    backgroundColor: "#F4F6FF",
                    color: "#000546",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 54,
                    fontWeight: 800,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {formatPoints(residualPoints, { signed: true })}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              bottom: 110,
              height: 202,
              borderRadius: 34,
              backgroundColor: "rgba(255,255,255,0.09)",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 34,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1,
              }}
            >
              {`Scarica l'app "${appStoreConfig.appName}"`}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 20,
                fontWeight: 800,
                color: "rgba(255,255,255,0.74)",
                lineHeight: 1,
              }}
            >
              dagli store
            </div>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "row",
                gap: 80,
                alignItems: "center",
              }}
            >
              <img src={appStoreSrc} width={268} height={80} style={{ objectFit: "contain" }} />
              <img src={playStoreSrc} width={268} height={80} style={{ objectFit: "contain" }} />
            </div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        headers: { "Cache-Control": CACHE_CONTROL },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[story route]", msg, err);
    return new Response("Story generation failed", { status: 500 });
  }
}

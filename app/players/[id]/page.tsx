import { env } from "cloudflare:workers";
import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  Crosshair,
  Fire,
  GlobeHemisphereWest,
  Medal,
  ShieldCheck,
  Sparkle,
  Target,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicPlayerProfile } from "@/lib/season-data";
import type { BadgeKey, SeasonHistoryItem } from "@/lib/season";
import { soccerverseProfileUrl } from "@/lib/soccerverse-profile";

const badgeIcons = {
  bullseye: Target,
  "perfect-timing": Crosshair,
  "on-fire": Fire,
  "globe-trotter": GlobeHemisphereWest,
  "the-wall": ShieldCheck,
  "against-the-odds": Sparkle,
} satisfies Record<BadgeKey, typeof Target>;

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function scoreBreakdown(score: NonNullable<SeasonHistoryItem["score"]>) {
  return [
    ["Result", score.outcomePoints],
    ["Exact", score.exactScorePoints],
    ["Scorer", score.firstScorerPoints],
    ["Window", score.goalWindowPoints],
    ["First team", score.firstTeamPoints],
  ] as const;
}

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128) notFound();

  const player = await loadPublicPlayerProfile((env as Cloudflare.Env).DB, id);
  if (!player) notFound();
  const unlockedBadges = player.badges.filter((badge) => badge.unlocked);

  return (
    <main className="public-player-page">
      <header className="public-player-header">
        <Link href="/" className="public-player-brand" aria-label="Back to Under the Lights">
          <Image src="/logo.png" alt="Soccerverse Under the Lights" width={1774} height={887} priority />
        </Link>
        <Link href="/" className="public-player-back"><ArrowLeft size={17} weight="bold" /> Back to the game</Link>
      </header>

      <section className="public-player-hero" aria-labelledby="player-name">
        <div className="public-player-identity">
          <div className="public-player-avatar" aria-hidden="true">
            {initials(player.displayName)}
            {player.avatarUrl && <span style={{ backgroundImage: `url(${JSON.stringify(player.avatarUrl)})` }} />}
          </div>
          <div>
            <span>{player.rank ? `Season rank #${player.rank}` : "Season 1 competitor"}</span>
            <h1 id="player-name">{player.displayName}</h1>
            <p>A public record of settled predictions and achievements.</p>
          </div>
        </div>
        <div className="public-player-destination">
          {player.soccerverseUsername ? (
            <>
              <small>Soccerverse identity</small>
              <strong>@{player.soccerverseUsername}</strong>
              <a href={soccerverseProfileUrl(player.soccerverseUsername)} target="_blank" rel="noreferrer">
                View on Soccerverse <ArrowSquareOut size={16} weight="bold" />
              </a>
            </>
          ) : (
            <>
              <small>Soccerverse identity</small>
              <strong>Not linked yet</strong>
              <p>This competitor has not added a public Soccerverse username.</p>
            </>
          )}
        </div>
      </section>

      <section className="public-player-stats" aria-label="Season statistics">
        <div><strong>{player.stats.points}</strong><span>Season points</span></div>
        <div><strong>{player.stats.played}</strong><span>Results settled</span></div>
        <div><strong>{player.stats.exactScores}</strong><span>Exact scores</span></div>
        <div><strong>{player.stats.accuracy}%</strong><span>Result accuracy</span></div>
        <div><strong>{player.stats.countries}</strong><span>Countries played</span></div>
        <div><strong>{player.stats.badges}</strong><span>Achievements</span></div>
      </section>

      <div className="public-player-content">
        <section className="public-results" aria-labelledby="public-results-title">
          <div className="public-section-heading">
            <Trophy size={27} weight="duotone" />
            <div>
              <h2 id="public-results-title">Settled results</h2>
              <p>Only completed and scored matches appear on this page.</p>
            </div>
          </div>
          <div className="public-results-list">
            {player.history.map((item) => {
              if (!item.result || !item.score) return null;
              return (
                <article key={item.matchId}>
                  <time dateTime={new Date(item.kickoff * 1000).toISOString()}>{formatDate(item.kickoff * 1000)}</time>
                  <div className="public-result-main">
                    <small>{item.competitionName}</small>
                    <h3>{item.homeName} <b>{item.result.homeScore}-{item.result.awayScore}</b> {item.awayName}</h3>
                    <span>Prediction {item.prediction.homeScore}-{item.prediction.awayScore}</span>
                    <div className="public-score-breakdown">
                      {scoreBreakdown(item.score).map(([label, points]) => (
                        <i className={points ? "hit" : ""} key={label}>{label} +{points}</i>
                      ))}
                    </div>
                  </div>
                  <strong>+{item.score.totalPoints}</strong>
                </article>
              );
            })}
            {!player.history.length && (
              <div className="public-player-empty">
                <Trophy size={34} weight="duotone" />
                <strong>No settled results yet</strong>
                <span>Completed Spotlight predictions will appear here after scoring.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="public-achievements" aria-labelledby="public-achievements-title">
          <div className="public-section-heading">
            <Medal size={27} weight="duotone" />
            <div>
              <h2 id="public-achievements-title">Achievements</h2>
              <p>{unlockedBadges.length} of {player.badges.length} unlocked</p>
            </div>
          </div>
          <div className="public-badge-list">
            {unlockedBadges.map((badge) => {
              const Icon = badgeIcons[badge.key];
              return (
                <article key={badge.key}>
                  <div><Icon size={27} weight="fill" /></div>
                  <div><h3>{badge.name}</h3><p>{badge.description}</p></div>
                  <Check size={17} weight="bold" />
                </article>
              );
            })}
            {!unlockedBadges.length && (
              <div className="public-player-empty compact">
                <Medal size={30} weight="duotone" />
                <strong>No achievements yet</strong>
                <span>The first unlocked badge will join this cabinet.</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="public-player-footer">
        <span>One world. One match. Every week.</span>
        <Link href="/">Play Under the Lights <ArrowSquareOut size={15} weight="bold" /></Link>
      </footer>
    </main>
  );
}

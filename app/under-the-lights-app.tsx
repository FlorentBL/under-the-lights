"use client";

import {
  ArrowRight,
  CaretDown,
  Check,
  Clock,
  Crosshair,
  DiscordLogo,
  Fire,
  GlobeHemisphereWest,
  Lock,
  MagnifyingGlass,
  Medal,
  ShieldCheck,
  SignIn as SignInIcon,
  SignOut,
  Sparkle,
  Target,
  Trophy,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { positionCategories, positionSummary, primaryPositionCategory, type PositionCategory } from "@/lib/player-positions";
import { GOAL_WINDOWS, MAX_PREDICTION_POINTS, NO_GOAL, type GoalWindow, type ScoreBreakdown } from "@/lib/scoring";
import type { BadgeKey, SeasonPayload, SeasonViewer } from "@/lib/season";

type View = "spotlight" | "leaderboard" | "achievements" | "profile";

type Prediction = {
  homeScore: number;
  awayScore: number;
  firstScorer: string;
  goalWindow: GoalWindow;
  firstTeam: string;
};

type PredictionScore = ScoreBreakdown & { scoredAt: number };

type SpotlightPlayer = {
  id: number;
  clubId: number;
  name: string;
  position: number | null;
  rating: number | null;
  imageUrl: string;
};

type Spotlight = {
  fixtureId: number;
  kickoff: number;
  homeClubId: number;
  awayClubId: number;
  countryCode: string;
  competitionName: string;
  homeName: string;
  awayName: string;
  homePosition: number | null;
  awayPosition: number | null;
  homePoints: number | null;
  awayPoints: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  homeManager: string | null;
  awayManager: string | null;
  homeStrength: number | null;
  awayStrength: number | null;
  title: string;
  summary: string;
  reasons: string[];
  players: SpotlightPlayer[];
  result: null | {
    homeScore: number;
    awayScore: number;
    firstScorer: string;
    firstGoalMinute: number | null;
    goalWindow: GoalWindow;
    firstTeam: string;
    settledAt: number;
  };
};

const fallbackSpotlight: Spotlight = {
  fixtureId: 0,
  kickoff: 1785004200,
  homeClubId: 0,
  awayClubId: 0,
  countryCode: "POL",
  competitionName: "I Liga",
  homeName: "Wisła Kraków",
  awayName: "Arka Gdynia",
  homePosition: 2,
  awayPosition: 1,
  homePoints: null,
  awayPoints: null,
  homeRecord: "W-W-D-W",
  awayRecord: null,
  homeManager: null,
  awayManager: null,
  homeStrength: null,
  awayStrength: null,
  title: "Two points apart. Four games left.",
  summary: "One night can redraw the race for promotion.",
  reasons: ["Promotion race"],
  players: [],
  result: null,
};

const badgeIcons = {
  bullseye: Target,
  "perfect-timing": Crosshair,
  "on-fire": Fire,
  "globe-trotter": GlobeHemisphereWest,
  "the-wall": ShieldCheck,
  "against-the-odds": Sparkle,
} satisfies Record<BadgeKey, typeof Target>;

const emptySeason: SeasonPayload = { leaderboard: [], viewer: null };

export function UnderTheLightsApp() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [view, setView] = useState<View>("spotlight");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [prediction, setPrediction] = useState<Prediction>({
    homeScore: 2,
    awayScore: 1,
    firstScorer: "",
    goalWindow: "16-30",
    firstTeam: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [spotlight, setSpotlight] = useState<Spotlight>(fallbackSpotlight);
  const [adminUserId, setAdminUserId] = useState("");
  const [predictionScore, setPredictionScore] = useState<PredictionScore | null>(null);
  const [season, setSeason] = useState<SeasonPayload>(emptySeason);
  const [seasonLoading, setSeasonLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => await response.json() as { admin?: boolean })
      .then((payload) => setAdminUserId(payload.admin ? session.user.id : ""))
      .catch(() => setAdminUserId(""));
  }, [session]);

  const isAdmin = Boolean(session && adminUserId === session.user.id);

  const refreshSeason = useCallback(() => {
    return fetch("/api/season", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Season data unavailable");
        return response.json() as Promise<SeasonPayload>;
      })
      .then(setSeason)
      .catch(() => setSeason(emptySeason))
      .finally(() => setSeasonLoading(false));
  }, []);

  useEffect(() => {
    if (sessionPending) return;
    void refreshSeason();
  }, [refreshSeason, session?.user.id, sessionPending]);

  useEffect(() => {
    fetch("/api/spotlight/current")
      .then(async (response) => await response.json() as { spotlight?: Spotlight | null })
      .then((payload) => {
        if (!payload.spotlight) return;
        const next = payload.spotlight;
        setSpotlight(next);
        setPrediction({
          homeScore: 2,
          awayScore: 1,
          firstScorer: "",
          goalWindow: "16-30",
          firstTeam: String(next.homeClubId),
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!spotlight.fixtureId) return;
    const controller = new AbortController();
    const localKey = `utl-prediction:${spotlight.fixtureId}`;
    if (!session) {
      const saved = window.localStorage.getItem(localKey);
      if (saved) {
        try {
          const savedPrediction = JSON.parse(saved) as Prediction;
          queueMicrotask(() => {
            setPrediction(savedPrediction);
            setSubmitted(true);
          });
        } catch {
          window.localStorage.removeItem(localKey);
        }
      }
      return () => controller.abort();
    }
    fetch(`/api/predictions?matchId=${spotlight.fixtureId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => await response.json() as { prediction?: (Prediction & { score?: PredictionScore | null }) | null })
      .then((payload) => {
        if (!payload.prediction) return;
        setPrediction(payload.prediction);
        setPredictionScore(payload.prediction.score || null);
        setSubmitted(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [session, spotlight.fixtureId]);

  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function submitPrediction(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setNotice("Sign in to lock your prediction for the season.");
      setAuthOpen(true);
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: spotlight.fixtureId ? String(spotlight.fixtureId) : "preview-spotlight", ...prediction }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Prediction could not be saved");
      window.localStorage.setItem(`utl-prediction:${spotlight.fixtureId}`, JSON.stringify(prediction));
      setSubmitted(true);
      setNotice("Prediction locked. You can edit it until kick-off.");
      await refreshSeason();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Prediction could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand-button" onClick={() => navigate("spotlight")} aria-label="Under the Lights home">
          <Image src="/logo.png" alt="Soccerverse Under the Lights" className="brand-logo" width={1774} height={887} priority />
        </button>
        <nav className={mobileOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <NavButton active={view === "spotlight"} onClick={() => navigate("spotlight")}>Spotlight</NavButton>
          <NavButton active={view === "leaderboard"} onClick={() => navigate("leaderboard")}>Leaderboard</NavButton>
          <NavButton active={view === "achievements"} onClick={() => navigate("achievements")}>Achievements</NavButton>
          <NavButton active={view === "profile"} onClick={() => navigate("profile")}>My profile</NavButton>
          {isAdmin && <a className="nav-button admin-link" href="/admin"><Lock size={15} weight="bold" /> Admin</a>}
        </nav>
        <div className="header-actions">
          {session ? (
            <button className="profile-chip" onClick={() => navigate("profile")}>
              <span className="avatar">{initials(session.user.name)}</span>
              <span>{session.user.name}</span>
            </button>
          ) : (
            <button className="sign-in-button" onClick={() => setAuthOpen(true)} disabled={sessionPending}>
              <SignInIcon size={17} weight="bold" /> Sign in
            </button>
          )}
          <button className="mobile-menu" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
            <CaretDown size={20} weight="bold" />
          </button>
        </div>
      </header>

      <main>
        {view === "spotlight" && (
          <SpotlightView
            spotlight={spotlight}
            prediction={prediction}
            setPrediction={setPrediction}
            submitted={submitted}
            saving={saving}
            notice={notice}
            score={predictionScore}
            leaders={season.leaderboard}
            projectedPoints={MAX_PREDICTION_POINTS}
            onSubmit={submitPrediction}
            onLeaderboard={() => navigate("leaderboard")}
          />
        )}
        {view === "leaderboard" && <LeaderboardView leaders={season.leaderboard} loading={seasonLoading} />}
        {view === "achievements" && <AchievementsView viewer={season.viewer} user={session?.user ?? null} loading={seasonLoading} onSignIn={() => setAuthOpen(true)} />}
        {view === "profile" && <ProfileView user={session?.user ?? null} viewer={season.viewer} loading={seasonLoading} onAchievements={() => navigate("achievements")} onSignIn={() => setAuthOpen(true)} />}
      </main>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}

      <footer className="site-footer">
        <Image src="/logo.png" alt="Soccerverse Under the Lights" width={1774} height={887} />
        <p>One world. One match. Every week.</p>
        <span>A Soccerverse community game</span>
      </footer>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [discordEnabled, setDiscordEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth-providers")
      .then((response) => response.json())
      .then((providers) => setDiscordEnabled(Boolean((providers as { discord?: boolean }).discord)))
      .catch(() => setDiscordEnabled(false));
  }, []);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = mode === "sign-up"
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message || "Authentication failed");
      return;
    }
    onClose();
  }

  async function signInWithDiscord() {
    setPending(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "discord", callbackURL: window.location.href });
    if (result.error) {
      setPending(false);
      setError("Discord sign-in is waiting for the app credentials.");
    }
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
        <span className="auth-kicker">Enter the competition</span>
        <h2 id="auth-title">{mode === "sign-in" ? "Welcome back." : "Join the season."}</h2>
        <p>Your predictions, points and badges stay attached to one identity.</p>
        <button className="discord-button" onClick={signInWithDiscord} disabled={pending || !discordEnabled}>
          <DiscordLogo size={21} weight="fill" /> {discordEnabled ? "Continue with Discord" : "Discord setup pending"}
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <form onSubmit={submitEmail}>
          {mode === "sign-up" && <label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={32} autoComplete="name" /></label>}
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>
          {mode === "sign-in" ? "New under the lights? Create an account" : "Already competing? Sign in"}
        </button>
      </section>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>{children}</button>;
}

function SpotlightView({ spotlight, prediction, setPrediction, submitted, saving, notice, score, leaders, projectedPoints, onSubmit, onLeaderboard }: {
  spotlight: Spotlight;
  prediction: Prediction;
  setPrediction: (prediction: Prediction) => void;
  submitted: boolean;
  saving: boolean;
  notice: string;
  score: PredictionScore | null;
  leaders: SeasonPayload["leaderboard"];
  projectedPoints: number;
  onSubmit: (event: FormEvent) => void;
  onLeaderboard: () => void;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const [clock, setClock] = useState(0);
  const kickoff = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(new Date(spotlight.kickoff * 1000));
  const selectedScorer = spotlight.players.find((player) => String(player.id) === prediction.firstScorer)?.name
    || (prediction.firstScorer === NO_GOAL ? "No first goalscorer" : "Select a player");
  const predictionsClosed = Boolean(spotlight.result) || clock >= spotlight.kickoff * 1000;
  const awaitingResult = predictionsClosed && !spotlight.result;
  const spotlightReason = spotlight.reasons[0] || "The match of the week";
  const resultScorer = spotlight.players.find((player) => String(player.id) === spotlight.result?.firstScorer)?.name
    || (spotlight.result?.firstScorer === NO_GOAL ? "No goalscorer" : "Pending confirmation");

  useEffect(() => {
    const initialTick = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(timer);
    };
  }, []);

  function updateScore(field: "homeScore" | "awayScore", value: number) {
    const next = { ...prediction, [field]: value };
    if (next.homeScore + next.awayScore === 0) {
      next.firstScorer = NO_GOAL;
      next.goalWindow = NO_GOAL;
      next.firstTeam = NO_GOAL;
    } else {
      if (next.firstScorer === NO_GOAL) next.firstScorer = "";
      if (next.goalWindow === NO_GOAL) next.goalWindow = "1-15";
      if (next.firstTeam === NO_GOAL) next.firstTeam = String(spotlight.homeClubId);
    }
    setPrediction(next);
  }

  function moveHeroLight(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !heroRef.current) return;
    const bounds = heroRef.current.getBoundingClientRect();
    heroRef.current.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    heroRef.current.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <>
      <section className="match-hero" ref={heroRef} onPointerMove={moveHeroLight}>
        <Image className="hero-photo" src="/stadium-night.jpg" alt="Floodlit football stadium before kick-off" fill priority quality={88} sizes="100vw" />
        <div className="hero-scrim" />
        <div className="hero-pointer-light" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow"><GlobeHemisphereWest size={16} weight="bold" /> This week in {spotlight.countryCode}</div>
          <h1>One match.<br /><em>All eyes.</em></h1>
          <p>Discover the games that matter, wherever football takes you.</p>
          <a href="#prediction" className="primary-cta">Make your prediction <ArrowRight size={18} weight="bold" /></a>
        </div>

        <article className="fixture-panel" aria-label="Featured match">
          <div className="fixture-heading">
            <div><span>Featured fixture</span><strong>{spotlight.competitionName}</strong></div>
            <time>{kickoff}</time>
          </div>
          <div className="teams">
            <TeamMark initials={initials(spotlight.homeName)} name={spotlight.homeName} position={spotlight.homePosition} competition={spotlight.competitionName} home />
            <div className="versus"><span>VS</span><small>{spotlightReason}</small></div>
            <TeamMark initials={initials(spotlight.awayName)} name={spotlight.awayName} position={spotlight.awayPosition} competition={spotlight.competitionName} />
          </div>
          <div className="fixture-story"><strong>{spotlight.title}</strong><p>{spotlight.summary}</p></div>
        </article>
      </section>

      <section className="match-dossier" aria-label="Match context">
        <div className="dossier-intro"><span>Why this match</span><strong>{spotlight.reasons.slice(0, 2).join(". ") || "One fixture deserves the world stage."}</strong></div>
        <div><strong>{positionMatchup(spotlight)}</strong><span>League positions</span></div>
        <div><strong>{strengthMatchup(spotlight)}</strong><span>Squad strength</span></div>
        <div><strong>{spotlight.homeRecord || "Fresh start"}</strong><span>{spotlight.homeName} record</span></div>
      </section>

      <section className="prediction-section" id="prediction">
        <div className="section-heading"><span>Your call</span><h2>Read the game.<br />Own the moment.</h2><p>Every correct detail adds points. Precision unlocks the rarest achievements.</p></div>
        <form className="prediction-grid" onSubmit={onSubmit}>
          <div className="prediction-main">
            <fieldset className="score-fieldset">
              <legend>Full-time score</legend>
              <div className="score-picker">
                <ScoreControl label={spotlight.homeName} value={prediction.homeScore} disabled={predictionsClosed} onChange={(homeScore) => updateScore("homeScore", homeScore)} />
                <span className="score-separator">:</span>
                <ScoreControl label={spotlight.awayName} value={prediction.awayScore} disabled={predictionsClosed} onChange={(awayScore) => updateScore("awayScore", awayScore)} />
              </div>
            </fieldset>
            <PlayerPicker
              players={spotlight.players}
              homeClubId={spotlight.homeClubId}
              awayClubId={spotlight.awayClubId}
              homeName={spotlight.homeName}
              awayName={spotlight.awayName}
              value={prediction.firstScorer}
              disabled={predictionsClosed || !spotlight.players.length || prediction.homeScore + prediction.awayScore === 0}
              loading={!spotlight.players.length}
              onChange={(firstScorer) => setPrediction({ ...prediction, firstScorer })}
            />
            <fieldset className="field-block"><legend>First goal window</legend><div className="choice-row">{GOAL_WINDOWS.map((window) => <button type="button" key={window} disabled={predictionsClosed} className={prediction.goalWindow === window ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, goalWindow: window })}>{window === NO_GOAL ? "No goal" : window}</button>)}</div></fieldset>
            <fieldset className="field-block"><legend>Who scores first?</legend><div className="choice-row three">{spotlight.fixtureId > 0 && [
              { key: "home", value: String(spotlight.homeClubId), label: spotlight.homeName },
              { key: "away", value: String(spotlight.awayClubId), label: spotlight.awayName },
              { key: "no-goal", value: NO_GOAL, label: "No goal" },
            ].map((team) => <button type="button" key={team.key} disabled={predictionsClosed} className={prediction.firstTeam === team.value ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, firstTeam: team.value })}>{team.label}</button>)}</div></fieldset>
          </div>

          <aside className="prediction-summary">
            <div className="summary-top"><Clock size={20} /><span>{spotlight.result ? "Final result" : awaitingResult ? "Result processing" : "Predictions close"}</span><strong>{spotlight.result ? "Settled" : kickoff}</strong></div>
            <div className={spotlight.result ? "score-preview final" : "score-preview"}><span>{initials(spotlight.homeName)}</span><strong>{spotlight.result ? `${spotlight.result.homeScore} - ${spotlight.result.awayScore}` : `${prediction.homeScore} - ${prediction.awayScore}`}</strong><span>{initials(spotlight.awayName)}</span></div>
            {score ? <ScoreBreakdown score={score} /> : <div className="scoring-key" aria-label="Scoring rules"><span>Result <b>3</b></span><span>Exact <b>+5</b></span><span>Scorer <b>4</b></span><span>Window <b>2</b></span><span>First team <b>1</b></span></div>}
            <dl>{spotlight.result ? <><div><dt>First scorer</dt><dd>{resultScorer}</dd></div><div><dt>First goal</dt><dd>{spotlight.result.firstGoalMinute ? `${spotlight.result.firstGoalMinute}' · ${spotlight.result.goalWindow}` : "No goal"}</dd></div><div><dt>Your total</dt><dd>{score ? `${score.totalPoints} pts` : submitted ? "Processing" : "No prediction"}</dd></div></> : <><div><dt>First scorer</dt><dd>{selectedScorer}</dd></div><div><dt>Goal window</dt><dd>{prediction.goalWindow === NO_GOAL ? "No goal" : `${prediction.goalWindow} min`}</dd></div><div><dt>Maximum haul</dt><dd>{projectedPoints} pts</dd></div></>}</dl>
            {spotlight.result && score ? <div className="points-awarded"><Trophy size={20} weight="fill" /><span>Points awarded</span><strong>+{score.totalPoints}</strong></div> : <button className="submit-prediction" type="submit" disabled={saving || predictionsClosed || !spotlight.players.length || (prediction.homeScore + prediction.awayScore > 0 && (!prediction.firstScorer || prediction.firstScorer === NO_GOAL))}>{saving ? "Locking prediction..." : awaitingResult ? "Awaiting final result" : predictionsClosed ? "Predictions closed" : submitted ? "Update prediction" : "Lock prediction"}{submitted ? <Check size={19} weight="bold" /> : <ArrowRight size={19} weight="bold" />}</button>}
            {notice && <p className="form-notice" role="status">{notice}</p>}
          </aside>
        </form>
      </section>

      <section className="week-leaders">
        <div className="leaders-copy"><span>Season table</span><h2>The season never stops.</h2><p>Weekly precision builds a reputation across every league.</p><button className="text-link" onClick={onLeaderboard}>View full leaderboard <ArrowRight size={18} /></button></div>
        <div className="leader-podium">{leaders.length ? leaders.slice(0, 3).map((entry) => <div key={`${entry.rank}:${entry.displayName}`} className="mini-rank"><span>{String(entry.rank).padStart(2, "0")}</span><div><strong>{entry.displayName}</strong><small>{entry.played} played · {entry.exactScores} exact</small></div><b>{entry.points}<small> pts</small></b></div>) : <SeasonEmpty compact title="The table is waiting" description="The first settled spotlight will reveal the opening standings." />}</div>
      </section>
    </>
  );
}

function ScoreBreakdown({ score }: { score: PredictionScore }) {
  const items = [
    ["Result", score.outcomePoints],
    ["Exact", score.exactScorePoints],
    ["Scorer", score.firstScorerPoints],
    ["Window", score.goalWindowPoints],
    ["First team", score.firstTeamPoints],
  ] as const;
  return <div className="scoring-key awarded" aria-label="Points breakdown">{items.map(([label, points]) => <span className={points ? "hit" : "miss"} key={label}>{label} <b>+{points}</b></span>)}</div>;
}

function TeamMark({ initials: mark, name, position, competition, home = false }: { initials: string; name: string; position: number | null; competition: string; home?: boolean }) {
  return <div className="team-mark"><div className={home ? "team-badge home" : "team-badge"}>{mark}</div><strong>{name}</strong><span>{position ? `#${position}` : "Unranked"} in {competition}</span></div>;
}

function positionMatchup(spotlight: Spotlight) {
  return spotlight.homePosition && spotlight.awayPosition ? `#${spotlight.homePosition} / #${spotlight.awayPosition}` : "Cup tie";
}

function strengthMatchup(spotlight: Spotlight) {
  return spotlight.homeStrength !== null && spotlight.awayStrength !== null
    ? `${spotlight.homeStrength.toFixed(1)} / ${spotlight.awayStrength.toFixed(1)}`
    : "Evenly matched";
}

function ScoreControl({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="score-control"><span>{label}</span><div><button type="button" disabled={disabled} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${label} score`}>−</button><strong>{value}</strong><button type="button" disabled={disabled} onClick={() => onChange(Math.min(9, value + 1))} aria-label={`Increase ${label} score`}>+</button></div></div>;
}

function PlayerPicker({ players, homeClubId, awayClubId, homeName, awayName, value, disabled, loading, onChange }: {
  players: SpotlightPlayer[];
  homeClubId: number;
  awayClubId: number;
  homeName: string;
  awayName: string;
  value: string;
  disabled: boolean;
  loading: boolean;
  onChange: (playerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<"all" | "home" | "away">("all");
  const [positionCategory, setPositionCategory] = useState<"all" | PositionCategory>("all");
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = players.find((player) => String(player.id) === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlayers = players
    .filter((player) => team === "all"
      || (team === "home" && player.clubId === homeClubId)
      || (team === "away" && player.clubId === awayClubId))
    .filter((player) => positionCategory === "all" || positionCategories(player.position).includes(positionCategory))
    .filter((player) => !normalizedQuery
      || player.name.toLocaleLowerCase().includes(normalizedQuery)
      || positionSummary(player.position).toLocaleLowerCase().includes(normalizedQuery))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectPlayer(player: SpotlightPlayer) {
    onChange(String(player.id));
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="field-block player-picker" ref={pickerRef}>
      <span id="first-scorer-label">First goalscorer</span>
      <button
        className="player-picker-trigger"
        type="button"
        disabled={disabled}
        aria-labelledby="first-scorer-label"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? <PlayerPortrait player={selected} /> : <span className="player-portrait empty">{loading ? "..." : value === NO_GOAL ? "0" : "?"}</span>}
        <span className="player-trigger-copy">
          <strong>{selected?.name || (loading ? "Squads are loading" : value === NO_GOAL ? "No goalscorer" : "Choose a player")}</strong>
          {selected ? <small><span>{selected.clubId === homeClubId ? homeName : awayName}</span><PositionBadge position={selected.position} />{selected.rating && <span>{selected.rating} OVR</span>}</small> : <small>{value === NO_GOAL ? "0-0 prediction" : "Search both squads"}</small>}
        </span>
        <span className="player-trigger-action">{selected ? "Change" : "Choose"}<CaretDown size={16} weight="bold" /></span>
      </button>

      {open && <div className="player-picker-popover">
        <div className="player-picker-tools">
          <label className="player-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">Search players</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by player name" />
          </label>
          <div className="player-team-filter" aria-label="Filter players by team">
            {[
              { value: "all", label: "All" },
              { value: "home", label: homeName },
              { value: "away", label: awayName },
            ].map((option) => <button type="button" key={option.value} className={team === option.value ? "active" : ""} onClick={() => setTeam(option.value as "all" | "home" | "away")}>{option.label}</button>)}
          </div>
          <div className="player-position-filter" aria-label="Filter players by position">
            {[
              { value: "all", label: "All", title: "All positions" },
              { value: "FWD", label: "FWD", title: "Forwards" },
              { value: "MID", label: "MID", title: "Midfielders" },
              { value: "DEF", label: "DEF", title: "Defenders" },
              { value: "GK", label: "GK", title: "Goalkeepers" },
            ].map((option) => <button type="button" key={option.value} title={option.title} aria-pressed={positionCategory === option.value} className={positionCategory === option.value ? "active" : ""} onClick={() => setPositionCategory(option.value as "all" | PositionCategory)}>{option.label}</button>)}
          </div>
        </div>
        <div className="player-options" role="listbox" aria-label="First goalscorer">
          {visiblePlayers.map((player) => <button
            type="button"
            role="option"
            aria-selected={String(player.id) === value}
            className={String(player.id) === value ? "player-option selected" : "player-option"}
            key={player.id}
            onClick={() => selectPlayer(player)}
          >
            <PlayerPortrait player={player} />
            <span><strong>{player.name}</strong><small><span>{player.clubId === homeClubId ? homeName : awayName}</span><PositionBadge position={player.position} /></small></span>
            {player.rating && <b>{player.rating}</b>}
            {String(player.id) === value && <Check size={16} weight="bold" />}
          </button>)}
          {!visiblePlayers.length && <div className="player-empty"><MagnifyingGlass size={22} /><strong>No player found</strong><span>Try another position, name or team.</span></div>}
        </div>
      </div>}
    </div>
  );
}

function PlayerPortrait({ player }: { player: SpotlightPlayer }) {
  return <span className="player-portrait"><span>{initials(player.name)}</span><Image key={player.imageUrl} src={player.imageUrl} alt="" width={52} height={52} onError={(event) => { event.currentTarget.style.display = "none"; }} /></span>;
}

function PositionBadge({ position }: { position: number | null }) {
  const category = primaryPositionCategory(position)?.toLocaleLowerCase() || "unknown";
  return <b className={`position-code ${category}`}>{positionSummary(position)}</b>;
}

function SeasonEmpty({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={compact ? "season-empty compact" : "season-empty"}><Trophy size={compact ? 24 : 36} weight="duotone" /><strong>{title}</strong><span>{description}</span></div>;
}

function LeaderboardView({ leaders, loading }: { leaders: SeasonPayload["leaderboard"]; loading: boolean }) {
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Trophy size={25} weight="fill" /><span>Season 1 standings</span></div><h1>Every call<br />counts.</h1><p>Accuracy creates distance. Consistency keeps you under the lights.</p></div>
      <div className="leaderboard-layout">
        <div className="leaderboard-table"><div className="table-header"><span>Rank</span><span>Player</span><span>Exact scores</span><span>Points</span></div>{leaders.map((entry) => <div className={entry.isViewer ? "table-row current" : "table-row"} key={`${entry.rank}:${entry.displayName}`}><span className="rank-number">{String(entry.rank).padStart(2, "0")}</span><span className="player-name"><i>{initials(entry.displayName)}</i><b>{entry.displayName}</b><small>{entry.played} played · {entry.badges} badges</small></span><span>{entry.exactScores}</span><strong>{entry.points}</strong></div>)}{!leaders.length && <SeasonEmpty title={loading ? "Loading the standings" : "No points awarded yet"} description={loading ? "Collecting the current season." : "The leaderboard starts as soon as the first spotlight is settled."} />}</div>
        <aside className="season-card"><Medal size={34} weight="fill" /><h2>Season honours</h2><p>Accuracy decides the table. Exploration, timing and bold calls build a separate badge collection.</p><div><span>Current campaign</span><strong>Season 1</strong></div></aside>
      </div>
    </section>
  );
}

function AchievementsView({ viewer, user, loading, onSignIn }: { viewer: SeasonViewer | null; user: { name: string } | null; loading: boolean; onSignIn: () => void }) {
  if (!user) return <section className="inner-page signed-out-profile"><Medal size={72} weight="duotone" /><h1>Your cabinet<br />starts here.</h1><p>Sign in to track progress and keep every badge you unlock.</p><button onClick={onSignIn}><SignInIcon size={18} weight="bold" /> Sign in to see achievements</button></section>;
  if (loading || !viewer) return <section className="inner-page"><SeasonEmpty title="Loading your achievements" description="Calculating progress from your prediction history." /></section>;
  const unlocked = viewer.badges.filter((badge) => badge.unlocked).length;
  const completion = Math.round(unlocked / viewer.badges.length * 100);
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Medal size={25} weight="fill" /><span>Your trophy cabinet</span></div><h1>Build your<br />legend.</h1><p>Collect the moments that turn a good prediction into a story.</p></div>
      <div className="badge-summary"><div><strong>{unlocked}</strong><span>Unlocked</span></div><div><strong>{viewer.badges.length - unlocked}</strong><span>In progress</span></div><div><strong>{completion}%</strong><span>Collection complete</span></div></div>
      <div className="badge-grid">{viewer.badges.map((badge) => { const Icon = badgeIcons[badge.key]; return <article className={badge.unlocked ? "badge-card unlocked" : "badge-card"} key={badge.key}><div className="badge-icon">{badge.unlocked ? <Icon size={37} weight="fill" /> : <Lock size={31} />}</div><div><span>{badge.unlocked ? "Unlocked" : `${badge.progress} of ${badge.target}`}</span><h2>{badge.name}</h2><p>{badge.description}</p></div><small>{badge.unlocked ? <><Check size={16} weight="bold" /> {badge.earnedAt ? `Earned ${formatShortDate(badge.earnedAt)}` : "Earned"}</> : `${Math.round((badge.progress / badge.target) * 100)}% complete`}</small></article>; })}</div>
    </section>
  );
}

function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function historyBreakdown(score: NonNullable<SeasonViewer["history"][number]["score"]>) {
  return [
    ["Result", score.outcomePoints],
    ["Exact", score.exactScorePoints],
    ["Scorer", score.firstScorerPoints],
    ["Window", score.goalWindowPoints],
    ["First team", score.firstTeamPoints],
  ] as const;
}

function ProfileView({ user, viewer, loading, onAchievements, onSignIn }: { user: { name: string; email: string; image?: string | null } | null; viewer: SeasonViewer | null; loading: boolean; onAchievements: () => void; onSignIn: () => void }) {
  if (!user) return <section className="inner-page signed-out-profile"><UserCircle size={72} weight="duotone" /><h1>Your season<br />starts here.</h1><p>Sign in to keep every prediction, point and badge together.</p><button onClick={onSignIn}><SignInIcon size={18} weight="bold" /> Sign in or create an account</button></section>;
  const stats = viewer?.stats || { points: 0, exactScores: 0, accuracy: 0, countries: 0, predictions: 0 };
  return (
    <section className="inner-page">
      <div className="profile-hero"><div className="profile-avatar"><UserCircle size={68} weight="duotone" /></div><div><span>{viewer?.rank ? `Season rank #${viewer.rank}` : "Season 1 competitor"}</span><h1>{user.name}</h1><p>{user.email}</p></div><div className="profile-actions"><button onClick={onAchievements}>View achievements <ArrowRight size={18} /></button><button className="sign-out-button" onClick={() => authClient.signOut()}><SignOut size={18} /> Sign out</button></div></div>
      <div className="profile-stats"><div><strong>{stats.points}</strong><span>Season points</span></div><div><strong>{stats.exactScores}</strong><span>Exact scores</span></div><div><strong>{stats.accuracy}%</strong><span>Result accuracy</span></div><div><strong>{stats.countries}</strong><span>Countries explored</span></div></div>
      <div className="history-panel"><div className="history-heading"><h2>Prediction history</h2><span>{loading ? "Loading" : `${stats.predictions} prediction${stats.predictions === 1 ? "" : "s"}`}</span></div>{viewer?.history.map((item) => <article key={item.matchId}><span>{formatShortDate(item.kickoff * 1000)}</span><div className="history-match"><strong>{item.homeName} {item.result ? `${item.result.homeScore}-${item.result.awayScore}` : "vs"} {item.awayName}</strong><small>Your pick: {item.prediction.homeScore}-{item.prediction.awayScore} · {item.competitionName}</small>{item.score && <div className="history-breakdown">{historyBreakdown(item.score).map(([label, points]) => <i className={points ? "hit" : ""} key={label}>{label} +{points}</i>)}</div>}</div><small>{item.score ? "Settled" : item.result ? "Scoring" : "Pending result"}</small><b>{item.score ? `+${item.score.totalPoints}` : "-"}</b></article>)}{!loading && !viewer?.history.length && <SeasonEmpty title="No predictions yet" description="Your first locked spotlight will appear here immediately." />}</div>
    </section>
  );
}

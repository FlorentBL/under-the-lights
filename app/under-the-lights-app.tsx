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
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type View = "spotlight" | "leaderboard" | "achievements" | "profile";

type Prediction = {
  homeScore: number;
  awayScore: number;
  firstScorer: string;
  goalWindow: string;
  firstTeam: string;
};

type Spotlight = {
  fixtureId: number;
  kickoff: number;
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
};

const fallbackSpotlight: Spotlight = {
  fixtureId: 0,
  kickoff: 1785004200,
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
};

const scorers = [
  "Ángel Rodado",
  "Jesús Alfaro",
  "Szymon Sobczak",
  "Karol Czubak",
  "Olaf Kobacki",
  "No first goalscorer",
];

const leaderboard = [
  ["Marta_V", "ESP", 118, 7],
  ["NorthBank", "ENG", 113, 5],
  ["Kaito88", "JPN", 108, 6],
  ["KrakowKing", "POL", 105, 4],
  ["LesGones", "FRA", 99, 5],
  ["Tactico", "ARG", 96, 3],
  ["BolaNaRede", "BRA", 91, 4],
  ["KopEnd", "ENG", 88, 2],
] as const;

const badges = [
  { icon: Target, name: "Bullseye", description: "Predict an exact score", progress: 1, target: 1 },
  { icon: Crosshair, name: "Perfect Timing", description: "Find a scorer and the right time window", progress: 1, target: 1 },
  { icon: Fire, name: "On Fire", description: "Predict five results in a row", progress: 3, target: 5 },
  { icon: GlobeHemisphereWest, name: "Globe-trotter", description: "Play matches across five countries", progress: 4, target: 5 },
  { icon: ShieldCheck, name: "The Wall", description: "Correctly predict a 0-0 draw", progress: 0, target: 1 },
  { icon: Sparkle, name: "Against the Odds", description: "Back an outsider to win", progress: 1, target: 1 },
] as const;

const histories = [
  { round: "Week 04", match: "Ehime FC 1-1 Oita Trinita", points: 7, badge: "Perfect Timing" },
  { round: "Week 03", match: "Racing Santander 2-0 Elche", points: 10, badge: "Bullseye" },
  { round: "Week 02", match: "Bari 1-2 Palermo", points: 3, badge: null },
] as const;

export function UnderTheLightsApp() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [view, setView] = useState<View>("spotlight");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [prediction, setPrediction] = useState<Prediction>({
    homeScore: 2,
    awayScore: 1,
    firstScorer: "Ángel Rodado",
    goalWindow: "16-30",
    firstTeam: "Wisła Kraków",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [spotlight, setSpotlight] = useState<Spotlight>(fallbackSpotlight);
  const [adminUserId, setAdminUserId] = useState("");

  useEffect(() => {
    if (!session) return;

    fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => await response.json() as { admin?: boolean })
      .then((payload) => setAdminUserId(payload.admin ? session.user.id : ""))
      .catch(() => setAdminUserId(""));
  }, [session]);

  const isAdmin = Boolean(session && adminUserId === session.user.id);

  useEffect(() => {
    fetch("/api/spotlight/current")
      .then(async (response) => await response.json() as { spotlight?: Spotlight | null })
      .then((payload) => {
        if (!payload.spotlight) return;
        setSpotlight(payload.spotlight);
        setPrediction((current) => ({
          ...current,
          firstTeam: current.firstTeam === fallbackSpotlight.homeName ? payload.spotlight!.homeName : current.firstTeam,
          firstScorer: current.firstScorer === scorers[0] ? `${payload.spotlight!.homeName} first scorer` : current.firstScorer,
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("utl-current-prediction");
      if (saved) {
        setPrediction(JSON.parse(saved));
        setSubmitted(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const projectedPoints = useMemo(() => {
    let total = 3;
    if (prediction.homeScore === 2 && prediction.awayScore === 1) total += 5;
    if (prediction.firstScorer) total += 4;
    if (prediction.goalWindow) total += 2;
    return total;
  }, [prediction]);

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
      if (!response.ok) throw new Error("Prediction could not be saved");
      window.localStorage.setItem("utl-current-prediction", JSON.stringify(prediction));
      setSubmitted(true);
      setNotice("Prediction locked. You can edit it until kick-off.");
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
            projectedPoints={projectedPoints}
            onSubmit={submitPrediction}
            onLeaderboard={() => navigate("leaderboard")}
          />
        )}
        {view === "leaderboard" && <LeaderboardView />}
        {view === "achievements" && <AchievementsView />}
        {view === "profile" && <ProfileView user={session?.user ?? null} onAchievements={() => navigate("achievements")} onSignIn={() => setAuthOpen(true)} />}
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

function SpotlightView({ spotlight, prediction, setPrediction, submitted, saving, notice, projectedPoints, onSubmit, onLeaderboard }: {
  spotlight: Spotlight;
  prediction: Prediction;
  setPrediction: (prediction: Prediction) => void;
  submitted: boolean;
  saving: boolean;
  notice: string;
  projectedPoints: number;
  onSubmit: (event: FormEvent) => void;
  onLeaderboard: () => void;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const kickoff = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(new Date(spotlight.kickoff * 1000));
  const dynamicScorers = spotlight.fixtureId
    ? [`${spotlight.homeName} first scorer`, `${spotlight.awayName} first scorer`, "No first goalscorer"]
    : scorers;
  const spotlightReason = spotlight.reasons[0] || "The match of the week";

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
                <ScoreControl label={spotlight.homeName} value={prediction.homeScore} onChange={(homeScore) => setPrediction({ ...prediction, homeScore })} />
                <span className="score-separator">:</span>
                <ScoreControl label={spotlight.awayName} value={prediction.awayScore} onChange={(awayScore) => setPrediction({ ...prediction, awayScore })} />
              </div>
            </fieldset>
            <label className="field-block"><span>First goalscorer</span><select value={dynamicScorers.includes(prediction.firstScorer) ? prediction.firstScorer : dynamicScorers[0]} onChange={(event) => setPrediction({ ...prediction, firstScorer: event.target.value })}>{dynamicScorers.map((player) => <option key={player}>{player}</option>)}</select></label>
            <fieldset className="field-block"><legend>First goal window</legend><div className="choice-row">{["1-15", "16-30", "31-45+", "46-60", "61-75", "76-90+"].map((window) => <button type="button" key={window} className={prediction.goalWindow === window ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, goalWindow: window })}>{window}</button>)}</div></fieldset>
            <fieldset className="field-block"><legend>Who scores first?</legend><div className="choice-row three">{[spotlight.homeName, spotlight.awayName, "No goal"].map((team) => <button type="button" key={team} className={prediction.firstTeam === team ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, firstTeam: team })}>{team}</button>)}</div></fieldset>
          </div>

          <aside className="prediction-summary">
            <div className="summary-top"><Clock size={20} /><span>Predictions close</span><strong>{kickoff}</strong></div>
            <div className="score-preview"><span>{initials(spotlight.homeName)}</span><strong>{prediction.homeScore} - {prediction.awayScore}</strong><span>{initials(spotlight.awayName)}</span></div>
            <dl><div><dt>First scorer</dt><dd>{prediction.firstScorer}</dd></div><div><dt>Goal window</dt><dd>{prediction.goalWindow} min</dd></div><div><dt>Maximum haul</dt><dd>{projectedPoints} pts</dd></div></dl>
            <button className="submit-prediction" type="submit" disabled={saving}>{saving ? "Locking prediction..." : submitted ? "Update prediction" : "Lock prediction"}{submitted ? <Check size={19} weight="bold" /> : <ArrowRight size={19} weight="bold" />}</button>
            {notice && <p className="form-notice" role="status">{notice}</p>}
          </aside>
        </form>
      </section>

      <section className="week-leaders">
        <div className="leaders-copy"><span>Season table</span><h2>The season never stops.</h2><p>Weekly precision builds a reputation across every league.</p><button className="text-link" onClick={onLeaderboard}>View full leaderboard <ArrowRight size={18} /></button></div>
        <div className="leader-podium">{leaderboard.slice(0, 3).map(([name, country, points], index) => <div key={name} className="mini-rank"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{country}</small></div><b>{points}<small> pts</small></b></div>)}</div>
      </section>
    </>
  );
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

function ScoreControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="score-control"><span>{label}</span><div><button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${label} score`}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange(Math.min(9, value + 1))} aria-label={`Increase ${label} score`}>+</button></div></div>;
}

function LeaderboardView() {
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Trophy size={25} weight="fill" /><span>Season 1 standings</span></div><h1>Every call<br />counts.</h1><p>Accuracy creates distance. Consistency keeps you under the lights.</p></div>
      <div className="leaderboard-layout">
        <div className="leaderboard-table"><div className="table-header"><span>Rank</span><span>Player</span><span>Exact scores</span><span>Points</span></div>{leaderboard.map(([name, country, points, exact], index) => <div className={name === "LesGones" ? "table-row current" : "table-row"} key={name}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><span className="player-name"><i>{name.slice(0, 2).toUpperCase()}</i><b>{name}</b><small>{country}</small></span><span>{exact}</span><strong>{points}</strong></div>)}</div>
        <aside className="season-card"><Medal size={34} weight="fill" /><h2>Season rewards</h2><p>The most accurate predictors share the final prize pool. Explorers and badge hunters earn their own collections.</p><div><span>Next reset</span><strong>End of Season 1</strong></div></aside>
      </div>
    </section>
  );
}

function AchievementsView() {
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Medal size={25} weight="fill" /><span>Your trophy cabinet</span></div><h1>Build your<br />legend.</h1><p>Collect the moments that turn a good prediction into a story.</p></div>
      <div className="badge-summary"><div><strong>3</strong><span>Unlocked</span></div><div><strong>6</strong><span>In progress</span></div><div><strong>50%</strong><span>Collection complete</span></div></div>
      <div className="badge-grid">{badges.map(({ icon: Icon, name, description, progress, target }) => { const unlocked = progress >= target; return <article className={unlocked ? "badge-card unlocked" : "badge-card"} key={name}><div className="badge-icon">{unlocked ? <Icon size={37} weight="fill" /> : <Lock size={31} />}</div><div><span>{unlocked ? "Unlocked" : `${progress} of ${target}`}</span><h2>{name}</h2><p>{description}</p></div><small>{unlocked ? <><Check size={16} weight="bold" /> Earned</> : `${Math.round((progress / target) * 100)}% complete`}</small></article>; })}</div>
    </section>
  );
}

function ProfileView({ user, onAchievements, onSignIn }: { user: { name: string; email: string; image?: string | null } | null; onAchievements: () => void; onSignIn: () => void }) {
  if (!user) return <section className="inner-page signed-out-profile"><UserCircle size={72} weight="duotone" /><h1>Your season<br />starts here.</h1><p>Sign in to keep every prediction, point and badge together.</p><button onClick={onSignIn}><SignInIcon size={18} weight="bold" /> Sign in or create an account</button></section>;
  return (
    <section className="inner-page">
      <div className="profile-hero"><div className="profile-avatar"><UserCircle size={68} weight="duotone" /></div><div><span>Season 1 competitor</span><h1>{user.name}</h1><p>{user.email}</p></div><div className="profile-actions"><button onClick={onAchievements}>View achievements <ArrowRight size={18} /></button><button className="sign-out-button" onClick={() => authClient.signOut()}><SignOut size={18} /> Sign out</button></div></div>
      <div className="profile-stats"><div><strong>74</strong><span>Season points</span></div><div><strong>2</strong><span>Exact scores</span></div><div><strong>68%</strong><span>Result accuracy</span></div><div><strong>4</strong><span>Countries explored</span></div></div>
      <div className="history-panel"><div className="history-heading"><h2>Prediction history</h2><span>Last 3 matches</span></div>{histories.map((item) => <article key={item.round}><span>{item.round}</span><strong>{item.match}</strong><small>{item.badge || "Points earned"}</small><b>+{item.points}</b></article>)}</div>
    </section>
  );
}

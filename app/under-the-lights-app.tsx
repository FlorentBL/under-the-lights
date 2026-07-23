"use client";

import {
  ArrowSquareOut,
  ArrowRight,
  BookOpen,
  Broadcast,
  CalendarCheck,
  CaretDown,
  ChartBar,
  Check,
  Clock,
  Crosshair,
  Database,
  DiscordLogo,
  EnvelopeSimple,
  Fire,
  GlobeHemisphereWest,
  GithubLogo,
  Lightbulb,
  Lock,
  Password,
  MagnifyingGlass,
  Medal,
  ShieldCheck,
  SignIn as SignInIcon,
  SignOut,
  Sparkle,
  Strategy,
  SoccerBall,
  Target,
  Trophy,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { positionCategories, positionSummary, primaryPositionCategory, type PositionCategory } from "@/lib/player-positions";
import { GOAL_WINDOWS, MAX_PREDICTION_POINTS, NO_GOAL, type GoalWindow, type ScoreBreakdown } from "@/lib/scoring";
import type { BadgeKey, SeasonPayload, SeasonViewer } from "@/lib/season";

type View = "spotlight" | "how-it-works" | "leaderboard" | "achievements" | "project" | "profile";
type AuthIntent = "sign-in" | "reset-password" | "verified" | "verification-error" | "reset-error";

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
  competitionId: number;
  divisionLevel: number;
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
  competitionId: 0,
  divisionLevel: 1,
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

function pendingPredictionKey(fixtureId: number) {
  return `utl-pending-prediction:${fixtureId}`;
}

function readPendingPrediction(fixtureId: number) {
  const key = pendingPredictionKey(fixtureId);
  const saved = window.localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Prediction;
    if (!Number.isInteger(parsed.homeScore) || !Number.isInteger(parsed.awayScore)
      || typeof parsed.firstScorer !== "string" || typeof parsed.firstTeam !== "string"
      || !GOAL_WINDOWS.includes(parsed.goalWindow)) throw new Error("Invalid prediction draft");
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function UnderTheLightsApp() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [view, setView] = useState<View>("spotlight");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("sign-in");
  const [authToken, setAuthToken] = useState("");
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
  const pendingSyncRef = useRef("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const auth = parameters.get("auth");
    const error = parameters.get("error");
    const token = parameters.get("token") || "";
    if (auth === "reset-password") {
      queueMicrotask(() => {
        setAuthIntent(error || !token ? "reset-error" : "reset-password");
        setAuthToken(token);
        setAuthOpen(true);
      });
    } else if (auth === "verified") {
      queueMicrotask(() => {
        setAuthIntent(error ? "verification-error" : "verified");
        setAuthOpen(true);
      });
    }
    if (auth) window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  const openAuth = useCallback(() => {
    setAuthIntent("sign-in");
    setAuthToken("");
    setAuthOpen(true);
  }, []);

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

  const savePrediction = useCallback(async (draft: Prediction, afterAuthentication = false) => {
    setSaving(true);
    setNotice(afterAuthentication ? "Signed in. Locking your prediction..." : "");
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: String(spotlight.fixtureId), ...draft }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Prediction could not be saved");
      window.localStorage.removeItem(pendingPredictionKey(spotlight.fixtureId));
      window.localStorage.removeItem(`utl-prediction:${spotlight.fixtureId}`);
      setPrediction(draft);
      setSubmitted(true);
      setNotice("Prediction locked. You can edit it until kick-off.");
      void refreshSeason();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prediction could not be saved";
      setNotice(afterAuthentication ? `${message}. Your prediction is still here; click Lock prediction to retry.` : message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [refreshSeason, spotlight.fixtureId]);

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
    if (sessionPending || !spotlight.fixtureId) return;
    const controller = new AbortController();
    const pending = readPendingPrediction(spotlight.fixtureId);
    if (!session) {
      if (pending) queueMicrotask(() => setPrediction(pending));
      return () => controller.abort();
    }

    if (pending) {
      const syncKey = `${session.user.id}:${spotlight.fixtureId}`;
      if (pendingSyncRef.current !== syncKey) {
        pendingSyncRef.current = syncKey;
        queueMicrotask(() => {
          setPrediction(pending);
          void savePrediction(pending, true);
        });
      }
      return () => controller.abort();
    }

    fetch(`/api/predictions?matchId=${spotlight.fixtureId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => await response.json() as { prediction?: (Prediction & { score?: PredictionScore | null }) | null })
      .then((payload) => {
        if (!payload.prediction) {
          setSubmitted(false);
          setPredictionScore(null);
          return;
        }
        setPrediction(payload.prediction);
        setPredictionScore(payload.prediction.score || null);
        setSubmitted(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [savePrediction, session, sessionPending, spotlight.fixtureId]);

  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function submitPrediction(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      try {
        window.localStorage.setItem(pendingPredictionKey(spotlight.fixtureId), JSON.stringify(prediction));
      } catch {
        setNotice("Your browser could not keep this prediction during sign-in. Please try again after signing in.");
        return;
      }
      setNotice("Sign in to lock your prediction for the season.");
      openAuth();
      return;
    }
    await savePrediction(prediction);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand-button" onClick={() => navigate("spotlight")} aria-label="Under the Lights home">
          <Image src="/logo.png" alt="Soccerverse Under the Lights" className="brand-logo" width={1774} height={887} priority />
        </button>
        <nav className={mobileOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <NavButton active={view === "spotlight"} onClick={() => navigate("spotlight")}>Spotlight</NavButton>
          <NavButton active={view === "how-it-works"} onClick={() => navigate("how-it-works")}>How it works</NavButton>
          <NavButton active={view === "leaderboard"} onClick={() => navigate("leaderboard")}>Leaderboard</NavButton>
          <NavButton active={view === "achievements"} onClick={() => navigate("achievements")}>Achievements</NavButton>
          <NavButton active={view === "project"} onClick={() => navigate("project")}>The project</NavButton>
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
            <button className="sign-in-button" onClick={openAuth} disabled={sessionPending}>
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
        {view === "how-it-works" && <HowItWorksView spotlight={spotlight} onPlay={() => navigate("spotlight")} />}
        {view === "leaderboard" && <LeaderboardView leaders={season.leaderboard} loading={seasonLoading} />}
        {view === "achievements" && <AchievementsView viewer={season.viewer} user={session?.user ?? null} loading={seasonLoading} onSignIn={openAuth} />}
        {view === "project" && <ProjectView onPlay={() => navigate("spotlight")} />}
        {view === "profile" && <ProfileView user={session?.user ?? null} viewer={season.viewer} loading={seasonLoading} onAchievements={() => navigate("achievements")} onSignIn={openAuth} />}
      </main>

      {authOpen && <AuthDialog intent={authIntent} token={authToken} onClose={() => setAuthOpen(false)} />}

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

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "check-email" | "verified" | "verification-error" | "reset-error" | "reset-success";

function AuthDialog({ intent, token, onClose }: { intent: AuthIntent; token: string; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [emailPurpose, setEmailPurpose] = useState<"verification" | "reset">("verification");
  const [providers, setProviders] = useState({ ready: false, discord: false, emailVerification: false, passwordReset: false });

  useEffect(() => {
    fetch("/api/auth-providers")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload as { discord?: boolean; emailVerification?: boolean; passwordReset?: boolean };
        setProviders({
          ready: true,
          discord: Boolean(next.discord),
          emailVerification: Boolean(next.emailVerification),
          passwordReset: Boolean(next.passwordReset),
        });
      })
      .catch(() => setProviders({ ready: true, discord: false, emailVerification: false, passwordReset: false }));
  }, []);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const callbackURL = `${window.location.origin}/?auth=verified`;
    const result = mode === "sign-up"
      ? await authClient.signUp.email({ name, email, password, callbackURL })
      : await authClient.signIn.email({ email, password, callbackURL });
    setPending(false);
    if (result.error) {
      const authError = result.error as typeof result.error & { code?: string; status?: number };
      if (authError.code === "EMAIL_NOT_VERIFIED"
        || (authError.status === 403 && authError.message?.toLowerCase().includes("verif"))) {
        setEmailPurpose("verification");
        setMode("check-email");
        return;
      }
      setError(result.error.message || "Authentication failed");
      return;
    }
    if (mode === "sign-up" && providers.emailVerification) {
      setEmailPurpose("verification");
      setMode("check-email");
    } else {
      onClose();
    }
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/?auth=reset-password`,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message || "The reset email could not be sent");
      return;
    }
    setEmailPurpose("reset");
    setMode("check-email");
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      setError(result.error.message || "This reset link is invalid or expired");
      return;
    }
    setMode("reset-success");
    setPassword("");
    setPasswordConfirmation("");
  }

  async function resendVerification() {
    setPending(true);
    setError("");
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/?auth=verified`,
    });
    setPending(false);
    if (result.error) setError(result.error.message || "The verification email could not be sent");
  }

  async function signInWithDiscord() {
    setPending(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "discord", callbackURL: window.location.origin });
    if (result.error) {
      setPending(false);
      setError("Discord sign-in is waiting for the app credentials.");
    }
  }

  if (mode === "verified" || mode === "reset-success") {
    const verified = mode === "verified";
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><ShieldCheck size={38} weight="fill" /></div>
        <span className="auth-kicker">{verified ? "Email verified" : "Password updated"}</span>
        <h2 id="auth-title">{verified ? "You’re in." : "Back in the game."}</h2>
        <p>{verified ? "Your email is confirmed and your Under the Lights account is ready." : "Your new password is active. All other sessions have been signed out for safety."}</p>
        <button className="auth-submit" onClick={verified ? onClose : () => setMode("sign-in")}>{verified ? "Continue to the spotlight" : "Sign in with the new password"}</button>
      </AuthShell>
    );
  }

  if (mode === "verification-error" || mode === "reset-error") {
    const verification = mode === "verification-error";
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon error"><X size={34} weight="bold" /></div>
        <span className="auth-kicker">Link expired</span>
        <h2 id="auth-title">Let’s try again.</h2>
        <p>{verification ? "This verification link is invalid or has expired." : "This password-reset link is invalid or has expired."}</p>
        <button className="auth-submit" onClick={() => setMode(verification ? "sign-in" : "forgot-password")}>{verification ? "Return to sign in" : "Request a new link"}</button>
      </AuthShell>
    );
  }

  if (mode === "check-email") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><EnvelopeSimple size={38} weight="duotone" /></div>
        <span className="auth-kicker">Check your inbox</span>
        <h2 id="auth-title">Link sent.</h2>
        <p>If an account exists for <strong>{email}</strong>, the secure link is on its way. It expires in 60 minutes.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {emailPurpose === "verification" && providers.emailVerification && <button className="auth-submit" onClick={resendVerification} disabled={pending || !email}>{pending ? "Sending..." : "Resend verification email"}</button>}
        <button className="auth-switch" onClick={() => setMode("sign-in")}>Return to sign in</button>
      </AuthShell>
    );
  }

  if (mode === "forgot-password") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><Password size={38} weight="duotone" /></div>
        <span className="auth-kicker">Account recovery</span>
        <h2 id="auth-title">Reset your password.</h2>
        <p>Enter your email and we’ll send a secure, one-hour reset link.</p>
        <form onSubmit={requestPasswordReset}>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Sending..." : "Send reset link"}</button>
        </form>
        <button className="auth-switch" onClick={() => setMode("sign-in")}>Return to sign in</button>
      </AuthShell>
    );
  }

  if (mode === "reset-password") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><Password size={38} weight="duotone" /></div>
        <span className="auth-kicker">Secure reset</span>
        <h2 id="auth-title">Choose a new password.</h2>
        <p>Use at least eight characters. Your other sessions will be closed after the reset.</p>
        <form onSubmit={resetPassword}>
          <label><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" autoFocus /></label>
          <label><span>Confirm password</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Updating..." : "Set new password"}</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
        <span className="auth-kicker">Enter the competition</span>
        <h2 id="auth-title">{mode === "sign-in" ? "Welcome back." : "Join the season."}</h2>
        <p>Your predictions, points and badges stay attached to one identity.</p>
        <button className="discord-button" onClick={signInWithDiscord} disabled={pending || !providers.discord}>
          <DiscordLogo size={21} weight="fill" /> {providers.discord ? "Continue with Discord" : "Discord setup pending"}
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <form onSubmit={submitEmail}>
          {mode === "sign-up" && <label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={32} autoComplete="name" /></label>}
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending || !providers.ready}>{pending || !providers.ready ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
        </form>
        {mode === "sign-in" && providers.passwordReset && <button className="auth-forgot" onClick={() => { setMode("forgot-password"); setError(""); }}>Forgot your password?</button>}
        <button className="auth-switch" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>
          {mode === "sign-in" ? "New under the lights? Create an account" : "Already competing? Sign in"}
        </button>
      </section>
    </div>
  );
}

function AuthShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog auth-state" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label="Close authentication"><X size={20} /></button>
        {children}
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
          <SoccerverseLinks spotlight={spotlight} />
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

function SoccerverseLinks({ spotlight }: { spotlight: Spotlight }) {
  if (!spotlight.fixtureId || !spotlight.countryCode || spotlight.divisionLevel < 0) return null;
  const matchUrl = `https://play.soccerverse.com/match/${spotlight.fixtureId}`;
  const leagueUrl = `https://play.soccerverse.com/country/${spotlight.countryCode}/league/${spotlight.divisionLevel + 1}`;
  return <div className="soccerverse-links"><span>Open in Soccerverse</span><div><a href={matchUrl} target="_blank" rel="noreferrer" aria-label={`${spotlight.homeName} vs ${spotlight.awayName} on Soccerverse`}>Match<ArrowSquareOut size={15} weight="bold" /></a><a href={leagueUrl} target="_blank" rel="noreferrer" aria-label={`${spotlight.competitionName} on Soccerverse`}>League<ArrowSquareOut size={15} weight="bold" /></a></div></div>;
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

function HowItWorksView({ spotlight, onPlay }: { spotlight: Spotlight; onPlay: () => void }) {
  const exampleScorer = spotlight.players.find((player) => positionCategories(player.position).includes("FWD"))?.name || "your chosen forward";
  const playLabel = spotlight.fixtureId ? `Play ${spotlight.homeName} vs ${spotlight.awayName}` : "Play this week";
  const flow = [
    { icon: GlobeHemisphereWest, title: "Discover", text: "One fixture from the wider Soccerverse world becomes the weekly Spotlight." },
    { icon: Strategy, title: "Predict", text: "Call the score, first scorer, first-goal window and first team to score." },
    { icon: Lock, title: "Lock", text: "Save your call with one account. You can edit every detail until kick-off." },
    { icon: Trophy, title: "Score", text: "The final match data awards points, updates the table and unlocks badges." },
  ];
  const scoring = [
    { label: "Match outcome", points: 3, text: "Correct home win, draw or away win." },
    { label: "Exact score", points: 5, text: "A bonus on top of the outcome points." },
    { label: "First scorer", points: 4, text: "Name the player who scores first." },
    { label: "Goal window", points: 2, text: "Place the opening goal in the right time band." },
    { label: "First team", points: 1, text: "Choose which club opens the scoring." },
  ];

  return (
    <section className="explainer-page">
      <section className="guide-hero">
        <div className="guide-hero-copy"><span><BookOpen size={18} weight="fill" /> Game guide</span><h1>One match.<br />Four calls.</h1><p>A weekly prediction game built around one carefully selected Soccerverse fixture.</p><button onClick={onPlay}>{playLabel}<ArrowRight size={18} weight="bold" /></button></div>
        <div className="guide-hero-visual">
          <Image src="/stadium-night.jpg" alt="A floodlit stadium ready for the weekly Spotlight" fill sizes="(max-width: 820px) 100vw, 48vw" />
          <div className="guide-fixture"><span>This week</span><strong>{spotlight.homeName}<i>vs</i>{spotlight.awayName}</strong><small>{spotlight.competitionName}</small></div>
        </div>
      </section>

      <section className="game-flow" aria-labelledby="game-flow-title">
        <div className="guide-heading"><h2 id="game-flow-title">The complete game loop</h2><p>From Monday&apos;s selection to the final whistle, every action has a clear place.</p></div>
        <div className="flow-track">{flow.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={27} weight="duotone" /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="prediction-tutorial" aria-labelledby="tutorial-title">
        <div className="tutorial-copy"><span>Worked example</span><h2 id="tutorial-title">Build one complete call.</h2><p>The four answers describe the same match story. A 0-0 prediction automatically switches every goal detail to no goal.</p></div>
        <div className="tutorial-board">
          <div className="tutorial-score"><span>{spotlight.homeName}</span><strong>2 - 1</strong><span>{spotlight.awayName}</span></div>
          <div className="tutorial-details"><div><Crosshair size={20} /><span>First scorer</span><strong>{exampleScorer}</strong></div><div><Clock size={20} /><span>Goal window</span><strong>16-30</strong></div><div><SoccerBall size={20} /><span>Scores first</span><strong>{spotlight.homeName}</strong></div></div>
          <p>If the final result matches every call above, this prediction earns the full 15 points.</p>
        </div>
      </section>

      <section className="scoring-guide" aria-labelledby="scoring-title">
        <div className="guide-heading"><h2 id="scoring-title">Fifteen points are available</h2><p>Each correct detail scores independently, so a missed result can still earn useful points.</p></div>
        <div className="score-map">{scoring.map((item) => <article key={item.label}><span>+{item.points}</span><div><h3>{item.label}</h3><p>{item.text}</p></div></article>)}</div>
      </section>

      <section className="rules-guide" aria-labelledby="rules-title">
        <div><CalendarCheck size={36} weight="duotone" /><h2 id="rules-title">Rules worth knowing</h2><p>No hidden mechanics. The same rules apply to every weekly Spotlight.</p></div>
        <div className="rules-list">
          <details><summary>Can I change a prediction?</summary><p>Yes. Update it as often as you want before the published kick-off time. The server rejects every change after kick-off.</p></details>
          <details><summary>What happens after the match?</summary><p>Under the Lights reads the final score and match events, calculates each category, then updates your history, badges and season rank.</p></details>
          <details><summary>How does a 0-0 prediction work?</summary><p>Select 0-0 and the scorer, window and first-team fields become no goal. A perfect goalless call can still earn 15 points.</p></details>
          <details><summary>Why do I need an account?</summary><p>Your account keeps predictions, points and achievements attached to one season identity across devices.</p></details>
          <details><summary>When do new matches appear?</summary><p>The Spotlight Radar prepares a new weekend shortlist every Monday. An editor then publishes the match that best fits the project.</p></details>
        </div>
      </section>

      <section className="guide-cta"><div><h2>Ready for this week?</h2><p>Read the match story, study both squads and lock your four calls.</p></div><button onClick={onPlay}>Open the Spotlight<ArrowRight size={18} weight="bold" /></button></section>
    </section>
  );
}

function ProjectView({ onPlay }: { onPlay: () => void }) {
  return (
    <section className="project-page">
      <section className="project-hero">
        <div className="project-hero-copy"><span><Lightbulb size={18} weight="fill" /> The project</span><h1>Hidden leagues.<br />Shared stage.</h1><p>Under the Lights turns Soccerverse&apos;s global football world into one shared weekly prediction ritual.</p></div>
        <div className="project-hero-image"><Image src="/stadium-night.jpg" alt="Football under stadium floodlights" fill priority sizes="(max-width: 820px) 100vw, 52vw" /></div>
      </section>

      <section className="project-manifesto"><strong>Most football games concentrate attention on familiar names.</strong><p>Soccerverse contains far more: lower divisions, unfamiliar clubs, active managers and competitive stories across the world. Under the Lights exists to find one of those stories and invite everyone to care about it together.</p></section>

      <section className="radar-story" aria-labelledby="radar-story-title">
        <div className="radar-intro"><Broadcast size={38} weight="duotone" /><h2 id="radar-story-title">How the Spotlight is chosen</h2><p>Automation builds the shortlist. Editorial judgment chooses the stage.</p></div>
        <div className="radar-path">
          <article><CalendarCheck size={25} /><h3>Read the weekend</h3><p>The Radar scans the Soccerverse calendar for the next playable weekend.</p></article>
          <article><ChartBar size={25} /><h3>Measure the stakes</h3><p>League positions, points, form and squad balance reveal the strongest sporting stories.</p></article>
          <article><UsersThree size={25} /><h3>Require active managers</h3><p>Both clubs must have a manager who made a Soccerverse move within the last 14 days.</p></article>
          <article><Broadcast size={25} /><h3>Publish one Spotlight</h3><p>Twenty candidates reach the control room. One edited match story goes live.</p></article>
        </div>
      </section>

      <section className="project-principles">
        <article><GlobeHemisphereWest size={30} weight="duotone" /><h2>A global lens</h2><p>The country and division can change every week. The selection follows the strongest story, not a fixed league.</p></article>
        <article><Strategy size={30} weight="duotone" /><h2>Skill over luck</h2><p>Five scoring categories reward a coherent reading of the match, not a single binary guess.</p></article>
        <article><Medal size={30} weight="duotone" /><h2>A season memory</h2><p>Every result builds a permanent history of points, exact calls, streaks, countries and badges.</p></article>
      </section>

      <section className="built-open">
        <div><GithubLogo size={40} weight="duotone" /><h2>Built in public</h2><p>Under the Lights is an open-source community companion to Soccerverse. The code, scoring logic and product evolution can be inspected on GitHub.</p><a href="https://github.com/FlorentBL/under-the-lights" target="_blank" rel="noreferrer">View the repository<ArrowSquareOut size={17} weight="bold" /></a></div>
        <div className="project-stack"><div><Database size={23} /><span>Persistent game data</span><strong>Cloudflare D1</strong></div><div><ShieldCheck size={23} /><span>Player identity</span><strong>Better Auth</strong></div><div><Crosshair size={23} /><span>Match selection</span><strong>Spotlight Radar</strong></div></div>
      </section>

      <section className="community-note"><div><UsersThree size={35} weight="duotone" /><h2>A community project</h2><p>Under the Lights adds a weekly prediction layer around Soccerverse. Match, club and player information comes from the Soccerverse world, while this experience is developed openly by the community.</p></div><div className="community-actions"><a href="https://guide.soccerverse.com" target="_blank" rel="noreferrer">Discover Soccerverse<ArrowSquareOut size={17} /></a><button onClick={onPlay}>Play the Spotlight<ArrowRight size={18} /></button></div></section>
    </section>
  );
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

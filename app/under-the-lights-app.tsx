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
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LanguageProvider, languages, type Language, useI18n } from "@/lib/i18n";
import { positionCategories, positionSummary, primaryPositionCategory, type PositionCategory } from "@/lib/player-positions";
import { MAX_AVATAR_DATA_URL_LENGTH } from "@/lib/profile-avatar";
import { GOAL_WINDOWS, MAX_PREDICTION_POINTS, NO_GOAL, type GoalWindow, type ScoreBreakdown } from "@/lib/scoring";
import type { PredictionTrends } from "@/lib/prediction-trends";
import type { BadgeKey, SeasonPayload, SeasonViewer } from "@/lib/season";
import { soccerverseProfileUrl } from "@/lib/soccerverse-profile";
import type { DatapackMode } from "@/lib/datapack";

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
  homeCommunityLogoUrl: string | null;
  awayCommunityLogoUrl: string | null;
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
  homeCommunityLogoUrl: null,
  awayCommunityLogoUrl: null,
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
  return <LanguageProvider><UnderTheLightsContent /></LanguageProvider>;
}

function UnderTheLightsContent() {
  const { language, setLanguage, t } = useI18n();
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
  const [predictionTrends, setPredictionTrends] = useState<PredictionTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
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

  const refreshPredictionTrends = useCallback(() => {
    if (!spotlight.fixtureId) return Promise.resolve();
    return fetch(`/api/predictions/trends?matchId=${spotlight.fixtureId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Community picks unavailable");
        return response.json() as Promise<{ trends: PredictionTrends }>;
      })
      .then((payload) => setPredictionTrends(payload.trends))
      .catch(() => setPredictionTrends(null))
      .finally(() => setTrendsLoading(false));
  }, [spotlight.fixtureId]);

  const savePrediction = useCallback(async (draft: Prediction, afterAuthentication = false) => {
    setSaving(true);
    setNotice(afterAuthentication ? t("Signed in. Locking your prediction...") : "");
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: String(spotlight.fixtureId), ...draft }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("Prediction could not be saved"));
      window.localStorage.removeItem(pendingPredictionKey(spotlight.fixtureId));
      window.localStorage.removeItem(`utl-prediction:${spotlight.fixtureId}`);
      setPrediction(draft);
      setSubmitted(true);
      setNotice(t("Prediction locked. You can edit it until kick-off."));
      void refreshSeason();
      void refreshPredictionTrends();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Prediction could not be saved");
      setNotice(afterAuthentication ? t("{message}. Your prediction is still here; click Lock prediction to retry.", { message }) : message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [refreshPredictionTrends, refreshSeason, spotlight.fixtureId, t]);

  useEffect(() => {
    if (sessionPending) return;
    void refreshSeason();
  }, [refreshSeason, session?.user.id, sessionPending]);

  useEffect(() => {
    void refreshPredictionTrends();
  }, [refreshPredictionTrends]);

  useEffect(() => {
    fetch("/api/spotlight/current")
      .then(async (response) => await response.json() as { spotlight?: Spotlight | null })
      .then((payload) => {
        if (!payload.spotlight) {
          setTrendsLoading(false);
          return;
        }
        const next = payload.spotlight;
        setPredictionTrends(null);
        setTrendsLoading(true);
        setSpotlight(next);
        setPrediction({
          homeScore: 2,
          awayScore: 1,
          firstScorer: "",
          goalWindow: "16-30",
          firstTeam: String(next.homeClubId),
        });
      })
      .catch(() => setTrendsLoading(false));
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
        setNotice(t("Your browser could not keep this prediction during sign-in. Please try again after signing in."));
        return;
      }
      setNotice(t("Sign in to lock your prediction for the season."));
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
        <nav className={mobileOpen ? "main-nav is-open" : "main-nav"} aria-label={t("Main navigation")}>
          <NavButton active={view === "spotlight"} onClick={() => navigate("spotlight")}>{t("Spotlight")}</NavButton>
          <NavButton active={view === "how-it-works"} onClick={() => navigate("how-it-works")}>{t("How it works")}</NavButton>
          <NavButton active={view === "leaderboard"} onClick={() => navigate("leaderboard")}>{t("Leaderboard")}</NavButton>
          <NavButton active={view === "achievements"} onClick={() => navigate("achievements")}>{t("Achievements")}</NavButton>
          <NavButton active={view === "project"} onClick={() => navigate("project")}>{t("The project")}</NavButton>
          <NavButton active={view === "profile"} onClick={() => navigate("profile")}>{t("My profile")}</NavButton>
          {isAdmin && <a className="nav-button admin-link" href="/admin"><Lock size={15} weight="bold" /> Admin</a>}
        </nav>
        <div className="header-actions">
          <label className="language-select">
            <GlobeHemisphereWest size={17} weight="bold" aria-hidden="true" />
            <span className="sr-only">{t("Select language")}</span>
            <span className="language-code">{languages.find((option) => option.code === language)?.short}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t("Select language")}>
              {languages.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
            <CaretDown size={13} weight="bold" aria-hidden="true" />
          </label>
          {session ? (
            <button className="profile-chip" onClick={() => navigate("profile")}>
              <span className="avatar">{initials(session.user.name)}</span>
              <span>{session.user.name}</span>
            </button>
          ) : (
            <button className="sign-in-button" onClick={openAuth} disabled={sessionPending}>
              <SignInIcon size={17} weight="bold" /> {t("Sign in")}
            </button>
          )}
          <button className="mobile-menu" onClick={() => setMobileOpen((open) => !open)} aria-label={t("Toggle navigation")} aria-expanded={mobileOpen}>
            <CaretDown size={20} weight="bold" />
          </button>
        </div>
      </header>

      <main>
        {view === "spotlight" && (
          <SpotlightView
            spotlight={spotlight}
            datapackMode={season.viewer?.datapackMode || "default"}
            prediction={prediction}
            setPrediction={setPrediction}
            submitted={submitted}
            saving={saving}
            notice={notice}
            score={predictionScore}
            trends={predictionTrends}
            trendsLoading={trendsLoading}
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
        {view === "profile" && <ProfileView key={seasonLoading ? "loading" : "loaded"} user={session?.user ?? null} viewer={season.viewer} loading={seasonLoading} onAchievements={() => navigate("achievements")} onProfileUpdated={refreshSeason} onSignIn={openAuth} />}
      </main>

      {authOpen && <AuthDialog intent={authIntent} token={authToken} onClose={() => setAuthOpen(false)} />}

      <footer className="site-footer">
        <Image src="/logo.png" alt="Soccerverse Under the Lights" width={1774} height={887} />
        <p>{t("One world. One match. Every week.")}</p>
        <span>{t("A Soccerverse community game")}</span>
      </footer>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function CompetitorAvatar({ name, avatarUrl, className = "" }: { name: string; avatarUrl: string | null; className?: string }) {
  return (
    <span className={`competitor-avatar ${className}`.trim()} aria-hidden="true">
      {initials(name)}
      {avatarUrl && <span className="competitor-avatar-image" style={{ backgroundImage: `url(${JSON.stringify(avatarUrl)})` }} />}
    </span>
  );
}

async function prepareAvatar(file: File, t: ReturnType<typeof useI18n>["t"]) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(t("Choose a JPEG, PNG or WebP image"));
  }
  if (file.size > 10_000_000) throw new Error(t("Choose an image smaller than 10 MB"));

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(t("This image could not be opened")));
      image.src = objectUrl;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error(t("This image has invalid dimensions"));

    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("This browser cannot prepare the image"));
    context.drawImage(
      image,
      Math.floor((image.naturalWidth - side) / 2),
      Math.floor((image.naturalHeight - side) / 2),
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const avatarDataUrl = canvas.toDataURL("image/webp", .82);
    if (avatarDataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
      throw new Error(t("The compressed profile photo is still too large"));
    }
    return avatarDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function SoccerverseAccountLink({ username, compact = false }: { username: string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <a
      className={compact ? "soccerverse-account-link compact" : "soccerverse-account-link"}
      href={soccerverseProfileUrl(username)}
      target="_blank"
      rel="noreferrer"
      aria-label={t("Open {username} on Soccerverse", { username })}
    >
      @{username}<ArrowSquareOut size={compact ? 12 : 15} weight="bold" />
    </a>
  );
}

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "check-email" | "verified" | "verification-error" | "reset-error" | "reset-success";

function AuthDialog({ intent, token, onClose }: { intent: AuthIntent; token: string; onClose: () => void }) {
  const { t } = useI18n();
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
      setError(result.error.message || t("Authentication failed"));
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
      setError(result.error.message || t("The reset email could not be sent"));
      return;
    }
    setEmailPurpose("reset");
    setMode("check-email");
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation) {
      setError(t("Passwords do not match."));
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      setError(result.error.message || t("This reset link is invalid or expired"));
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
    if (result.error) setError(result.error.message || t("The verification email could not be sent"));
  }

  async function signInWithDiscord() {
    setPending(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "discord", callbackURL: window.location.origin });
    if (result.error) {
      setPending(false);
      setError(t("Discord sign-in is waiting for the app credentials."));
    }
  }

  if (mode === "verified" || mode === "reset-success") {
    const verified = mode === "verified";
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><ShieldCheck size={38} weight="fill" /></div>
        <span className="auth-kicker">{verified ? t("Email verified") : t("Password updated")}</span>
        <h2 id="auth-title">{verified ? t("You’re in.") : t("Back in the game.")}</h2>
        <p>{verified ? t("Your email is confirmed and your Under the Lights account is ready.") : t("Your new password is active. All other sessions have been signed out for safety.")}</p>
        <button className="auth-submit" onClick={verified ? onClose : () => setMode("sign-in")}>{verified ? t("Continue to the spotlight") : t("Sign in with the new password")}</button>
      </AuthShell>
    );
  }

  if (mode === "verification-error" || mode === "reset-error") {
    const verification = mode === "verification-error";
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon error"><X size={34} weight="bold" /></div>
        <span className="auth-kicker">{t("Link expired")}</span>
        <h2 id="auth-title">{t("Let’s try again.")}</h2>
        <p>{verification ? t("This verification link is invalid or has expired.") : t("This password-reset link is invalid or has expired.")}</p>
        <button className="auth-submit" onClick={() => setMode(verification ? "sign-in" : "forgot-password")}>{verification ? t("Return to sign in") : t("Request a new link")}</button>
      </AuthShell>
    );
  }

  if (mode === "check-email") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><EnvelopeSimple size={38} weight="duotone" /></div>
        <span className="auth-kicker">{t("Check your inbox")}</span>
        <h2 id="auth-title">{t("Link sent.")}</h2>
        <p>{t("If an account exists for {email}, the secure link is on its way. It expires in 60 minutes.", { email })}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {emailPurpose === "verification" && providers.emailVerification && <button className="auth-submit" onClick={resendVerification} disabled={pending || !email}>{pending ? t("Sending...") : t("Resend verification email")}</button>}
        <button className="auth-switch" onClick={() => setMode("sign-in")}>{t("Return to sign in")}</button>
      </AuthShell>
    );
  }

  if (mode === "forgot-password") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><Password size={38} weight="duotone" /></div>
        <span className="auth-kicker">{t("Account recovery")}</span>
        <h2 id="auth-title">{t("Reset your password.")}</h2>
        <p>{t("Enter your email and we’ll send a secure, one-hour reset link.")}</p>
        <form onSubmit={requestPasswordReset}>
          <label><span>{t("Email")}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? t("Sending...") : t("Send reset link")}</button>
        </form>
        <button className="auth-switch" onClick={() => setMode("sign-in")}>{t("Return to sign in")}</button>
      </AuthShell>
    );
  }

  if (mode === "reset-password") {
    return (
      <AuthShell onClose={onClose}>
        <div className="auth-state-icon"><Password size={38} weight="duotone" /></div>
        <span className="auth-kicker">{t("Secure reset")}</span>
        <h2 id="auth-title">{t("Choose a new password.")}</h2>
        <p>{t("Use at least eight characters. Your other sessions will be closed after the reset.")}</p>
        <form onSubmit={resetPassword}>
          <label><span>{t("New password")}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" autoFocus /></label>
          <label><span>{t("Confirm password")}</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? t("Updating...") : t("Set new password")}</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label={t("Close sign in")}><X size={20} /></button>
        <span className="auth-kicker">{t("Season leaderboard")}</span>
        <h2 id="auth-title">{mode === "sign-in" ? t("Welcome back.") : t("Join the season.")}</h2>
        <p>{t("Your predictions, points and badges stay attached to one identity.")}</p>
        <button className="discord-button" onClick={signInWithDiscord} disabled={pending || !providers.discord}>
          <DiscordLogo size={21} weight="fill" /> {providers.discord ? t("Continue with Discord") : "Discord"}
        </button>
        <div className="auth-divider"><span>{t("or use email")}</span></div>
        <form onSubmit={submitEmail}>
          {mode === "sign-up" && <label><span>{t("Display name")}</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={32} autoComplete="name" /></label>}
          <label><span>{t("Email")}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label><span>{t("Password")}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending || !providers.ready}>{pending || !providers.ready ? t("Please wait...") : mode === "sign-in" ? t("Sign in") : t("Create account")}</button>
        </form>
        {mode === "sign-in" && providers.passwordReset && <button className="auth-forgot" onClick={() => { setMode("forgot-password"); setError(""); }}>{t("Forgot your password?")}</button>}
        <button className="auth-switch" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>
          {mode === "sign-in" ? t("New under the lights? Create an account") : t("Already competing? Sign in")}
        </button>
      </section>
    </div>
  );
}

function AuthShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog auth-state" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label={t("Close authentication")}><X size={20} /></button>
        {children}
      </section>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>{children}</button>;
}

function SpotlightView({ spotlight, datapackMode, prediction, setPrediction, submitted, saving, notice, score, trends, trendsLoading, leaders, projectedPoints, onSubmit, onLeaderboard }: {
  spotlight: Spotlight;
  datapackMode: DatapackMode;
  prediction: Prediction;
  setPrediction: (prediction: Prediction) => void;
  submitted: boolean;
  saving: boolean;
  notice: string;
  score: PredictionScore | null;
  trends: PredictionTrends | null;
  trendsLoading: boolean;
  leaders: SeasonPayload["leaderboard"];
  projectedPoints: number;
  onSubmit: (event: FormEvent) => void;
  onLeaderboard: () => void;
}) {
  const { t, locale } = useI18n();
  const heroRef = useRef<HTMLElement>(null);
  const [clock, setClock] = useState(0);
  const kickoff = new Intl.DateTimeFormat(locale, { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(new Date(spotlight.kickoff * 1000));
  const selectedScorer = spotlight.players.find((player) => String(player.id) === prediction.firstScorer)?.name
    || (prediction.firstScorer === NO_GOAL ? t("No goal") : t("Choose a player"));
  const predictionsClosed = Boolean(spotlight.result) || clock >= spotlight.kickoff * 1000;
  const awaitingResult = predictionsClosed && !spotlight.result;
  const spotlightReason = spotlight.reasons[0] || t("The match of the week");
  const resultScorer = spotlight.players.find((player) => String(player.id) === spotlight.result?.firstScorer)?.name
    || (spotlight.result?.firstScorer === NO_GOAL ? t("No goal") : t("Pending confirmation"));

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
          <div className="eyebrow"><GlobeHemisphereWest size={16} weight="bold" /> {t("This week in {country}", { country: spotlight.countryCode })}</div>
          <h1>{t("One match.")}<br /><em>{t("All eyes.")}</em></h1>
          <p>{t("Discover the games that matter, wherever football takes you.")}</p>
          <a href="#prediction" className="primary-cta">{t("Make your prediction")} <ArrowRight size={18} weight="bold" /></a>
        </div>

        <article className="fixture-panel" aria-label={t("Featured match")}>
          <div className="fixture-heading">
            <div><span>{t("Featured fixture")}</span><strong>{spotlight.competitionName}</strong></div>
            <time>{kickoff}</time>
          </div>
          <div className="teams">
            <TeamMark
              initials={initials(spotlight.homeName)}
              name={spotlight.homeName}
              position={spotlight.homePosition}
              competition={spotlight.competitionName}
              logoUrl={datapackMode === "community" ? spotlight.homeCommunityLogoUrl : null}
              home
            />
            <div className="versus"><span>VS</span><small>{spotlightReason}</small></div>
            <TeamMark
              initials={initials(spotlight.awayName)}
              name={spotlight.awayName}
              position={spotlight.awayPosition}
              competition={spotlight.competitionName}
              logoUrl={datapackMode === "community" ? spotlight.awayCommunityLogoUrl : null}
            />
          </div>
          <div className="fixture-story"><strong>{spotlight.title}</strong><p>{spotlight.summary}</p></div>
          <SoccerverseLinks spotlight={spotlight} />
        </article>
      </section>

      <section className="match-dossier" aria-label={t("Match context")}>
        <div className="dossier-intro"><span>{t("Why this match")}</span><strong>{spotlight.reasons.slice(0, 2).join(". ") || t("The match of the week")}</strong></div>
        <div><strong>{t(positionMatchup(spotlight))}</strong><span>{t("League positions")}</span></div>
        <div><strong>{t(strengthMatchup(spotlight))}</strong><span>{t("Squad strength")}</span></div>
        <div><strong>{spotlight.homeRecord || "-"}</strong><span>{t("{team} record", { team: spotlight.homeName })}</span></div>
      </section>

      <section className="prediction-section" id="prediction">
        <div className="section-heading"><span>{t("Your call")}</span><h2>{t("Read the game.")}<br />{t("Own the moment.")}</h2><p>{t("Every correct detail adds points. Precision unlocks the rarest achievements.")}</p></div>
        <form className="prediction-grid" onSubmit={onSubmit}>
          <div className="prediction-main">
            <fieldset className="score-fieldset">
              <legend>{t("Full-time score")}</legend>
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
            <fieldset className="field-block"><legend>{t("First goal window")}</legend><div className="choice-row">{GOAL_WINDOWS.map((window) => <button type="button" key={window} disabled={predictionsClosed} className={prediction.goalWindow === window ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, goalWindow: window })}>{window === NO_GOAL ? t("No goal") : window}</button>)}</div></fieldset>
            <fieldset className="field-block"><legend>{t("Who scores first?")}</legend><div className="choice-row three">{spotlight.fixtureId > 0 && [
              { key: "home", value: String(spotlight.homeClubId), label: spotlight.homeName },
              { key: "away", value: String(spotlight.awayClubId), label: spotlight.awayName },
              { key: "no-goal", value: NO_GOAL, label: t("No goal") },
            ].map((team) => <button type="button" key={team.key} disabled={predictionsClosed} className={prediction.firstTeam === team.value ? "choice active" : "choice"} onClick={() => setPrediction({ ...prediction, firstTeam: team.value })}>{team.label}</button>)}</div></fieldset>
          </div>

          <aside className="prediction-summary">
            <div className="summary-top"><Clock size={20} /><span>{spotlight.result ? t("Final result") : awaitingResult ? t("Result processing") : t("Predictions close")}</span><strong>{spotlight.result ? t("Settled") : kickoff}</strong></div>
            <div className={spotlight.result ? "score-preview final" : "score-preview"}><span>{initials(spotlight.homeName)}</span><strong>{spotlight.result ? `${spotlight.result.homeScore} - ${spotlight.result.awayScore}` : `${prediction.homeScore} - ${prediction.awayScore}`}</strong><span>{initials(spotlight.awayName)}</span></div>
            {score ? <ScoreBreakdown score={score} /> : <div className="scoring-key" aria-label={t("Scoring rules")}><span>{t("Result")} <b>3</b></span><span>{t("Exact")} <b>+5</b></span><span>{t("Scorer")} <b>4</b></span><span>{t("Window")} <b>2</b></span><span>{t("First team")} <b>1</b></span></div>}
            <dl>{spotlight.result ? <><div><dt>{t("First scorer")}</dt><dd>{resultScorer}</dd></div><div><dt>{t("Goal window")}</dt><dd>{spotlight.result.firstGoalMinute ? `${spotlight.result.firstGoalMinute}' · ${spotlight.result.goalWindow}` : t("No goal")}</dd></div><div><dt>{t("Your total")}</dt><dd>{score ? `${score.totalPoints} pts` : "-"}</dd></div></> : <><div><dt>{t("First scorer")}</dt><dd>{selectedScorer}</dd></div><div><dt>{t("Goal window")}</dt><dd>{prediction.goalWindow === NO_GOAL ? t("No goal") : `${prediction.goalWindow} min`}</dd></div><div><dt>{t("Maximum haul")}</dt><dd>{projectedPoints} pts</dd></div></>}</dl>
            {spotlight.result && score ? <div className="points-awarded"><Trophy size={20} weight="fill" /><span>{t("Points awarded")}</span><strong>+{score.totalPoints}</strong></div> : <button className="submit-prediction" type="submit" disabled={saving || predictionsClosed || !spotlight.players.length || (prediction.homeScore + prediction.awayScore > 0 && (!prediction.firstScorer || prediction.firstScorer === NO_GOAL))}>{saving ? t("Locking prediction...") : awaitingResult ? t("Awaiting final result") : predictionsClosed ? t("Predictions closed") : submitted ? t("Update prediction") : t("Lock prediction")}{submitted ? <Check size={19} weight="bold" /> : <ArrowRight size={19} weight="bold" />}</button>}
            {notice && <p className="form-notice" role="status">{notice}</p>}
          </aside>
        </form>
        <CommunityTrends trends={trends} loading={trendsLoading} homeName={spotlight.homeName} awayName={spotlight.awayName} />
      </section>

      <section className="week-leaders">
        <div className="leaders-copy"><span>{t("Season table")}</span><h2>{t("The season never stops.")}</h2><p>{t("Weekly precision builds a reputation across every league.")}</p><button className="text-link" onClick={onLeaderboard}>{t("View full leaderboard")} <ArrowRight size={18} /></button></div>
        <div className="leader-podium">{leaders.length ? leaders.slice(0, 3).map((entry) => <div key={entry.participantId} className="mini-rank"><span>{String(entry.rank).padStart(2, "0")}</span><div><CompetitorAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} className="mini-player-avatar" /><a className="public-player-link" href={`/players/${encodeURIComponent(entry.participantId)}`}>{entry.displayName}</a><small>{t("{played} played · {exact} exact", { played: entry.played, exact: entry.exactScores })}</small>{entry.soccerverseUsername && <SoccerverseAccountLink username={entry.soccerverseUsername} compact />}</div><b>{entry.points}<small> pts</small></b></div>) : <SeasonEmpty compact title={t("The table is waiting")} description={t("The first settled spotlight will reveal the opening standings.")} />}</div>
      </section>
    </>
  );
}

function CommunityTrends({ trends, loading, homeName, awayName }: {
  trends: PredictionTrends | null;
  loading: boolean;
  homeName: string;
  awayName: string;
}) {
  const { t } = useI18n();
  const outcomeLabels = {
    home: homeName,
    draw: t("Draw"),
    away: awayName,
  } as const;

  return (
    <section className="community-trends" aria-labelledby="community-trends-title" aria-busy={loading}>
      <div className="trends-heading">
        <div>
          <UsersThree size={22} weight="duotone" />
          <h3 id="community-trends-title">{t("Community picks")}</h3>
        </div>
        <strong>{loading && !trends ? t("Loading") : t("{count} locked", { count: trends?.total || 0 })}</strong>
      </div>

      {loading && !trends ? (
        <div className="trends-skeleton" aria-label={t("Loading community picks")}><span /><span /><span /></div>
      ) : !trends ? (
        <p className="trends-message">{t("Community picks could not be loaded right now.")}</p>
      ) : !trends.available ? (
        <p className="trends-message">
          {trends.total === 0
            ? t("Be the first to lock a prediction.")
            : t("{count} more picks needed before anonymous trends appear.", { count: trends.minimumSampleSize - trends.total })}
        </p>
      ) : (
        <div className="trends-grid">
          <div className="outcome-trends">
            <span>{t("Match result")}</span>
            <div>
              {trends.outcomes.map((item) => (
                <article key={item.key}>
                  <strong>{item.percentage}%</strong>
                  <span>{outcomeLabels[item.key as keyof typeof outcomeLabels] || item.label}</span>
                  <small>{t("{count} picks", { count: item.count })}</small>
                </article>
              ))}
            </div>
          </div>
          <TrendRanking title={t("Top scorelines")} items={trends.topScores} />
          <TrendRanking title={t("First goalscorer ranking")} items={trends.topScorers} />
        </div>
      )}
      <p className="trends-privacy">{t("Anonymous totals only. Trends refresh after every locked prediction.")}</p>
    </section>
  );
}

function TrendRanking({ title, items }: { title: string; items: PredictionTrends["topScores"] }) {
  return (
    <div className="trend-ranking">
      <span>{title}</span>
      <ol>
        {items.map((item, index) => (
          <li key={item.key}>
            <i>{index + 1}</i>
            <strong>{item.label}</strong>
            <span>{item.percentage}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScoreBreakdown({ score }: { score: PredictionScore }) {
  const { t } = useI18n();
  const items = [
    [t("Result"), score.outcomePoints],
    [t("Exact"), score.exactScorePoints],
    [t("Scorer"), score.firstScorerPoints],
    [t("Window"), score.goalWindowPoints],
    [t("First team"), score.firstTeamPoints],
  ] as const;
  return <div className="scoring-key awarded" aria-label={t("Points breakdown")}>{items.map(([label, points]) => <span className={points ? "hit" : "miss"} key={label}>{label} <b>+{points}</b></span>)}</div>;
}

function TeamMark({ initials: mark, name, position, competition, logoUrl, home = false }: {
  initials: string;
  name: string;
  position: number | null;
  competition: string;
  logoUrl: string | null;
  home?: boolean;
}) {
  const { t } = useI18n();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showCommunityLogo = Boolean(logoUrl && logoUrl !== failedLogoUrl);

  return (
    <div className="team-mark">
      <div className={`team-badge${home ? " home" : ""}${showCommunityLogo ? " community" : ""}`}>
        {showCommunityLogo
          ? <Image className="team-community-logo" src={logoUrl!} alt="" width={88} height={96} referrerPolicy="no-referrer" onError={() => setFailedLogoUrl(logoUrl)} />
          : mark}
      </div>
      <strong>{name}</strong>
      <span>{t("{position} in {competition}", { position: position ? `#${position}` : t("Unranked"), competition })}</span>
    </div>
  );
}

function SoccerverseLinks({ spotlight }: { spotlight: Spotlight }) {
  const { t } = useI18n();
  if (!spotlight.fixtureId || !spotlight.countryCode || spotlight.divisionLevel < 0) return null;
  const matchUrl = `https://play.soccerverse.com/match/${spotlight.fixtureId}`;
  const leagueUrl = `https://play.soccerverse.com/country/${spotlight.countryCode}/league/${spotlight.divisionLevel + 1}`;
  return <div className="soccerverse-links"><span>{t("Open in Soccerverse")}</span><div><a href={matchUrl} target="_blank" rel="noreferrer" aria-label={`${spotlight.homeName} vs ${spotlight.awayName} · Soccerverse`}>{t("Match")}<ArrowSquareOut size={15} weight="bold" /></a><a href={leagueUrl} target="_blank" rel="noreferrer" aria-label={`${spotlight.competitionName} · Soccerverse`}>{t("League")}<ArrowSquareOut size={15} weight="bold" /></a></div></div>;
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
  const { t } = useI18n();
  return <div className="score-control"><span>{label}</span><div><button type="button" disabled={disabled} onClick={() => onChange(Math.max(0, value - 1))} aria-label={t("Decrease {team} score", { team: label })}>−</button><strong>{value}</strong><button type="button" disabled={disabled} onClick={() => onChange(Math.min(9, value + 1))} aria-label={t("Increase {team} score", { team: label })}>+</button></div></div>;
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
  const { t } = useI18n();
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
      <span id="first-scorer-label">{t("First goalscorer")}</span>
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
          <strong>{selected?.name || (loading ? "…" : value === NO_GOAL ? t("No goal") : t("Choose a player"))}</strong>
          {selected ? <small><span>{selected.clubId === homeClubId ? homeName : awayName}</span><PositionBadge position={selected.position} />{selected.rating && <span>{selected.rating} OVR</span>}</small> : <small>{value === NO_GOAL ? "0-0" : t("Search both squads")}</small>}
        </span>
        <span className="player-trigger-action">{selected ? t("Change") : t("Choose")}<CaretDown size={16} weight="bold" /></span>
      </button>

      {open && <div className="player-picker-popover">
        <div className="player-picker-tools">
          <label className="player-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">{t("Search players")}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search by player name")} />
          </label>
          <div className="player-team-filter" aria-label={t("Filter players by team")}>
            {[
              { value: "all", label: t("All players") },
              { value: "home", label: homeName },
              { value: "away", label: awayName },
            ].map((option) => <button type="button" key={option.value} className={team === option.value ? "active" : ""} onClick={() => setTeam(option.value as "all" | "home" | "away")}>{option.label}</button>)}
          </div>
          <div className="player-position-filter" aria-label={t("Filter players by position")}>
            {[
              { value: "all", label: t("All positions"), title: t("All positions") },
              { value: "FWD", label: "FWD", title: t("Forwards") },
              { value: "MID", label: "MID", title: t("Midfielders") },
              { value: "DEF", label: "DEF", title: t("Defenders") },
              { value: "GK", label: "GK", title: t("Goalkeepers") },
            ].map((option) => <button type="button" key={option.value} title={option.title} aria-pressed={positionCategory === option.value} className={positionCategory === option.value ? "active" : ""} onClick={() => setPositionCategory(option.value as "all" | PositionCategory)}>{option.label}</button>)}
          </div>
        </div>
        <div className="player-options" role="listbox" aria-label={t("First goalscorer")}>
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
          {!visiblePlayers.length && <div className="player-empty"><MagnifyingGlass size={22} /><strong>{t("No players match these filters.")}</strong></div>}
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
  const { t } = useI18n();
  const exampleScorer = spotlight.players.find((player) => positionCategories(player.position).includes("FWD"))?.name || t("your chosen forward");
  const playLabel = spotlight.fixtureId ? `${spotlight.homeName} vs ${spotlight.awayName}` : t("Play this week");
  const flow = [
    { icon: GlobeHemisphereWest, title: t("Discover"), text: t("One fixture from the wider Soccerverse world becomes the weekly Spotlight.") },
    { icon: Strategy, title: t("Predict"), text: t("Call the score, first scorer, first-goal window and first team to score.") },
    { icon: Lock, title: t("Lock"), text: t("Save your call with one account. You can edit every detail until kick-off.") },
    { icon: Trophy, title: t("Score"), text: t("The final match data awards points, updates the table and unlocks badges.") },
  ];
  const scoring = [
    { label: t("Match outcome"), points: 3, text: t("Correct home win, draw or away win.") },
    { label: t("Exact score"), points: 5, text: t("A bonus on top of the outcome points.") },
    { label: t("First scorer"), points: 4, text: t("Name the player who scores first.") },
    { label: t("Goal window"), points: 2, text: t("Place the opening goal in the right time band.") },
    { label: t("First team"), points: 1, text: t("Choose which club opens the scoring.") },
  ];

  return (
    <section className="explainer-page">
      <section className="guide-hero">
        <div className="guide-hero-copy"><span><BookOpen size={18} weight="fill" /> {t("Game guide")}</span><h1>{t("One match. Four calls.")}</h1><p>{t("A weekly prediction game built around one carefully selected Soccerverse fixture.")}</p><button onClick={onPlay}>{playLabel}<ArrowRight size={18} weight="bold" /></button></div>
        <div className="guide-hero-visual">
          <Image src="/stadium-night.jpg" alt={t("A floodlit stadium ready for the weekly Spotlight")} fill sizes="(max-width: 820px) 100vw, 48vw" />
          <div className="guide-fixture"><span>{t("This week")}</span><strong>{spotlight.homeName}<i>vs</i>{spotlight.awayName}</strong><small>{spotlight.competitionName}</small></div>
        </div>
      </section>

      <section className="game-flow" aria-labelledby="game-flow-title">
        <div className="guide-heading"><h2 id="game-flow-title">{t("The complete game loop")}</h2><p>{t("From Monday's selection to the final whistle, every action has a clear place.")}</p></div>
        <div className="flow-track">{flow.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={27} weight="duotone" /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="prediction-tutorial" aria-labelledby="tutorial-title">
        <div className="tutorial-copy"><span>{t("Worked example")}</span><h2 id="tutorial-title">{t("Build one complete call.")}</h2><p>{t("The four answers describe the same match story. A 0-0 prediction automatically switches every goal detail to no goal.")}</p></div>
        <div className="tutorial-board">
          <div className="tutorial-score"><span>{spotlight.homeName}</span><strong>2 - 1</strong><span>{spotlight.awayName}</span></div>
          <div className="tutorial-details"><div><Crosshair size={20} /><span>{t("First scorer")}</span><strong>{exampleScorer}</strong></div><div><Clock size={20} /><span>{t("Goal window")}</span><strong>16-30</strong></div><div><SoccerBall size={20} /><span>{t("Scores first")}</span><strong>{spotlight.homeName}</strong></div></div>
          <p>{t("If the final result matches every call above, this prediction earns the full 15 points.")}</p>
        </div>
      </section>

      <section className="scoring-guide" aria-labelledby="scoring-title">
        <div className="guide-heading"><h2 id="scoring-title">{t("Fifteen points are available")}</h2><p>{t("Each correct detail scores independently, so a missed result can still earn useful points.")}</p></div>
        <div className="score-map">{scoring.map((item) => <article key={item.label}><span>+{item.points}</span><div><h3>{item.label}</h3><p>{item.text}</p></div></article>)}</div>
      </section>

      <section className="rules-guide" aria-labelledby="rules-title">
        <div><CalendarCheck size={36} weight="duotone" /><h2 id="rules-title">{t("Rules worth knowing")}</h2><p>{t("No hidden mechanics. The same rules apply to every weekly Spotlight.")}</p></div>
        <div className="rules-list">
          <details><summary>{t("Can I change a prediction?")}</summary><p>{t("Yes. Update it as often as you want before the published kick-off time. The server rejects every change after kick-off.")}</p></details>
          <details><summary>{t("What happens after the match?")}</summary><p>{t("Under the Lights reads the final score and match events, calculates each category, then updates your history, badges and season rank.")}</p></details>
          <details><summary>{t("How does a 0-0 prediction work?")}</summary><p>{t("Select 0-0 and the scorer, window and first-team fields become no goal. A perfect goalless call can still earn 15 points.")}</p></details>
          <details><summary>{t("Why do I need an account?")}</summary><p>{t("Your account keeps predictions, points and achievements attached to one season identity across devices.")}</p></details>
          <details><summary>{t("When do new matches appear?")}</summary><p>{t("The Spotlight Radar prepares a new weekend shortlist every Monday. An editor then publishes the match that best fits the project.")}</p></details>
        </div>
      </section>

      <section className="guide-cta"><div><h2>{t("Ready for this week?")}</h2><p>{t("Every correct detail adds points. Precision unlocks the rarest achievements.")}</p></div><button onClick={onPlay}>{t("Open the Spotlight")}<ArrowRight size={18} weight="bold" /></button></section>
    </section>
  );
}

function ProjectView({ onPlay }: { onPlay: () => void }) {
  const { t } = useI18n();
  return (
    <section className="project-page">
      <section className="project-hero">
        <div className="project-hero-copy"><span><Lightbulb size={18} weight="fill" /> {t("The project")}</span><h1>{t("Built for the wider Soccerverse world.")}</h1><p>{t("One world. One match. Every week.")}</p></div>
        <div className="project-hero-image"><Image src="/stadium-night.jpg" alt={t("Football under stadium floodlights")} fill priority sizes="(max-width: 820px) 100vw, 52vw" /></div>
      </section>

      <section className="project-manifesto"><strong>{t("Most football games concentrate attention on familiar names.")}</strong><p>{t("Soccerverse contains far more: lower divisions, unfamiliar clubs, active managers and competitive stories across the world. Under the Lights exists to find one of those stories and invite everyone to care about it together.")}</p></section>

      <section className="radar-story" aria-labelledby="radar-story-title">
        <div className="radar-intro"><Broadcast size={38} weight="duotone" /><h2 id="radar-story-title">{t("How the Spotlight is chosen")}</h2><p>{t("Automation builds the shortlist. Editorial judgment chooses the stage.")}</p></div>
        <div className="radar-path">
          <article><CalendarCheck size={25} /><h3>{t("Read the weekend")}</h3><p>{t("The Radar scans the Soccerverse calendar for the next playable weekend.")}</p></article>
          <article><ChartBar size={25} /><h3>{t("Measure the stakes")}</h3><p>{t("League positions, points, form and squad balance reveal the strongest sporting stories.")}</p></article>
          <article><UsersThree size={25} /><h3>{t("Require active managers")}</h3><p>{t("Both clubs must have a manager who made a Soccerverse move within the last 14 days.")}</p></article>
          <article><Broadcast size={25} /><h3>{t("Publish one Spotlight")}</h3><p>{t("Twenty candidates reach the control room. One edited match story goes live.")}</p></article>
        </div>
      </section>

      <section className="project-principles">
        <article><GlobeHemisphereWest size={30} weight="duotone" /><h2>{t("A global lens")}</h2><p>{t("The country and division can change every week. The selection follows the strongest story, not a fixed league.")}</p></article>
        <article><Strategy size={30} weight="duotone" /><h2>{t("Skill over luck")}</h2><p>{t("Five scoring categories reward a coherent reading of the match, not a single binary guess.")}</p></article>
        <article><Medal size={30} weight="duotone" /><h2>{t("A season memory")}</h2><p>{t("Every result builds a permanent history of points, exact calls, streaks, countries and badges.")}</p></article>
      </section>

      <section className="built-open">
        <div><GithubLogo size={40} weight="duotone" /><h2>{t("Built in public")}</h2><p>{t("Under the Lights is an open-source community companion to Soccerverse. The code, scoring logic and product evolution can be inspected on GitHub.")}</p><a href="https://github.com/FlorentBL/under-the-lights" target="_blank" rel="noreferrer">{t("View the repository")}<ArrowSquareOut size={17} weight="bold" /></a></div>
        <div className="project-stack"><div><Database size={23} /><span>{t("Persistent game data")}</span><strong>Cloudflare D1</strong></div><div><ShieldCheck size={23} /><span>{t("Player identity")}</span><strong>Better Auth</strong></div><div><Crosshair size={23} /><span>{t("Match selection")}</span><strong>Spotlight Radar</strong></div></div>
      </section>

      <section className="community-note"><div><UsersThree size={35} weight="duotone" /><h2>{t("A community project")}</h2><p>{t("Under the Lights adds a weekly prediction layer around Soccerverse. Match, club and player information comes from the Soccerverse world, while this experience is developed openly by the community.")}</p></div><div className="community-actions"><a href="https://guide.soccerverse.com" target="_blank" rel="noreferrer">Soccerverse<ArrowSquareOut size={17} /></a><button onClick={onPlay}>{t("Open the Spotlight")}<ArrowRight size={18} /></button></div></section>
    </section>
  );
}

function SeasonEmpty({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={compact ? "season-empty compact" : "season-empty"}><Trophy size={compact ? 24 : 36} weight="duotone" /><strong>{title}</strong><span>{description}</span></div>;
}

function LeaderboardView({ leaders, loading }: { leaders: SeasonPayload["leaderboard"]; loading: boolean }) {
  const { t } = useI18n();
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Trophy size={25} weight="fill" /><span>{t("Season leaderboard")}</span></div><h1>{t("Global table. Weekly stakes.")}</h1><p>{t("Weekly precision builds a reputation across every league.")}</p></div>
      <div className="leaderboard-layout">
        <div className="leaderboard-table"><div className="table-header"><span>{t("Rank")}</span><span>{t("Player")}</span><span>{t("Exact scores")}</span><span>{t("Points")}</span></div>{leaders.map((entry) => <div className={entry.isViewer ? "table-row current" : "table-row"} key={entry.participantId}><span className="rank-number">{String(entry.rank).padStart(2, "0")}</span><span className="player-name"><CompetitorAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} /><a className="public-player-link" href={`/players/${encodeURIComponent(entry.participantId)}`}>{entry.displayName}</a><small>{t("{played} played · {badges} badges", { played: entry.played, badges: entry.badges })}</small>{entry.soccerverseUsername && <SoccerverseAccountLink username={entry.soccerverseUsername} compact />}</span><span>{entry.exactScores}</span><strong>{entry.points}</strong></div>)}{!leaders.length && <SeasonEmpty title={loading ? t("Loading the standings") : t("No points awarded yet")} description={loading ? t("Collecting the current season.") : t("The leaderboard starts as soon as the first spotlight is settled.")} />}</div>
        <aside className="season-card"><Medal size={34} weight="fill" /><h2>{t("Season honours")}</h2><p>{t("Accuracy decides the table. Exploration, timing and bold calls build a separate badge collection.")}</p><div><span>{t("Current campaign")}</span><strong>{t("Season 1")}</strong></div></aside>
      </div>
    </section>
  );
}

function AchievementsView({ viewer, user, loading, onSignIn }: { viewer: SeasonViewer | null; user: { name: string } | null; loading: boolean; onSignIn: () => void }) {
  const { t, locale } = useI18n();
  if (!user) return <section className="inner-page signed-out-profile"><Medal size={72} weight="duotone" /><h1>{t("Your trophy room")}</h1><p>{t("Every correct detail adds points. Precision unlocks the rarest achievements.")}</p><button onClick={onSignIn}><SignInIcon size={18} weight="bold" /> {t("Sign in or create an account")}</button></section>;
  if (loading || !viewer) return <section className="inner-page"><SeasonEmpty title={t("Loading your achievements")} description={t("Calculating progress from your prediction history.")} /></section>;
  const unlocked = viewer.badges.filter((badge) => badge.unlocked).length;
  const completion = Math.round(unlocked / viewer.badges.length * 100);
  return (
    <section className="inner-page">
      <div className="page-intro"><div><Medal size={25} weight="fill" /><span>{t("Your trophy room")}</span></div><h1>{t("Achievements")}</h1><p>{t("Every correct detail adds points. Precision unlocks the rarest achievements.")}</p></div>
      <div className="badge-summary"><div><strong>{unlocked}</strong><span>{t("Unlocked")}</span></div><div><strong>{viewer.badges.length - unlocked}</strong><span>{t("In progress")}</span></div><div><strong>{completion}%</strong><span>{t("Collection complete")}</span></div></div>
      <div className="badge-grid">{viewer.badges.map((badge) => { const Icon = badgeIcons[badge.key]; return <article className={badge.unlocked ? "badge-card unlocked" : "badge-card"} key={badge.key}><div className="badge-icon">{badge.unlocked ? <Icon size={37} weight="fill" /> : <Lock size={31} />}</div><div><span>{badge.unlocked ? t("Unlocked") : t("{progress} of {target}", { progress: badge.progress, target: badge.target })}</span><h2>{t(badge.name)}</h2><p>{t(badge.description)}</p></div><small>{badge.unlocked ? <><Check size={16} weight="bold" /> {badge.earnedAt ? t("Earned {date}", { date: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(badge.earnedAt)) }) : t("Earned")}</> : t("{progress}% complete", { progress: Math.round((badge.progress / badge.target) * 100) })}</small></article>; })}</div>
    </section>
  );
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

function ProfileView({ user, viewer, loading, onAchievements, onProfileUpdated, onSignIn }: { user: { name: string; email: string; image?: string | null } | null; viewer: SeasonViewer | null; loading: boolean; onAchievements: () => void; onProfileUpdated: () => Promise<void>; onSignIn: () => void }) {
  const { t, locale } = useI18n();
  const [soccerverseUsername, setSoccerverseUsername] = useState(viewer?.soccerverseUsername || "");
  const [savedSoccerverseUsername, setSavedSoccerverseUsername] = useState(viewer?.soccerverseUsername || "");
  const [avatarUrl, setAvatarUrl] = useState(viewer?.avatarUrl || user?.image || null);
  const [hasCustomAvatar, setHasCustomAvatar] = useState(Boolean(viewer?.hasCustomAvatar));
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [datapackMode, setDatapackMode] = useState<DatapackMode>(viewer?.datapackMode || "default");
  const [datapackSaving, setDatapackSaving] = useState(false);
  const [datapackNotice, setDatapackNotice] = useState("");
  const [datapackError, setDatapackError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function saveAvatar(avatarDataUrl: string | null) {
    setAvatarSaving(true);
    setAvatarNotice("");
    setAvatarError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl }),
      });
      const payload = await response.json() as {
        avatarUrl?: string | null;
        hasCustomAvatar?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || t("Profile photo could not be saved"));
      setAvatarUrl(payload.avatarUrl || null);
      setHasCustomAvatar(Boolean(payload.hasCustomAvatar));
      setAvatarNotice(payload.hasCustomAvatar ? t("Profile photo updated.") : t("Custom photo removed."));
      await onProfileUpdated();
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : t("Profile photo could not be saved"));
    } finally {
      setAvatarSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarSaving(true);
    setAvatarNotice("");
    setAvatarError("");
    try {
      await saveAvatar(await prepareAvatar(file, t));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : t("Profile photo could not be prepared"));
      setAvatarSaving(false);
      event.target.value = "";
    }
  }

  async function saveSoccerverseAccount(value: string) {
    setProfileSaving(true);
    setProfileNotice("");
    setProfileError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soccerverseUsername: value }),
      });
      const payload = await response.json() as { soccerverseUsername?: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Soccerverse account could not be saved"));
      const canonicalUsername = payload.soccerverseUsername || "";
      setSoccerverseUsername(canonicalUsername);
      setSavedSoccerverseUsername(canonicalUsername);
      setProfileNotice(canonicalUsername ? t("Connected to @{username}.", { username: canonicalUsername }) : t("Soccerverse account removed."));
      await onProfileUpdated();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t("Soccerverse account could not be saved"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitSoccerverseAccount(event: FormEvent) {
    event.preventDefault();
    await saveSoccerverseAccount(soccerverseUsername);
  }

  async function submitDatapackMode(event: FormEvent) {
    event.preventDefault();
    setDatapackSaving(true);
    setDatapackNotice("");
    setDatapackError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datapackMode }),
      });
      const payload = await response.json() as { datapackMode?: DatapackMode; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Datapack source could not be saved"));
      const savedMode = payload.datapackMode || "default";
      setDatapackMode(savedMode);
      setDatapackNotice(savedMode === "community"
        ? t("Community club crests are now active for the Spotlight.")
        : t("Soccerverse standard crests are now active."));
      await onProfileUpdated();
    } catch (error) {
      setDatapackError(error instanceof Error ? error.message : t("Datapack source could not be saved"));
    } finally {
      setDatapackSaving(false);
    }
  }

  if (!user) return <section className="inner-page signed-out-profile"><UserCircle size={72} weight="duotone" /><h1>{t("My profile")}</h1><p>{t("One world. One match. Every week.")}</p><button onClick={onSignIn}><SignInIcon size={18} weight="bold" /> {t("Sign in or create an account")}</button></section>;
  const stats = viewer?.stats || { points: 0, exactScores: 0, accuracy: 0, countries: 0, predictions: 0 };
  return (
    <section className="inner-page">
      <div className="profile-hero">
        <div className="profile-avatar-editor">
          <CompetitorAvatar name={user.name} avatarUrl={avatarUrl} className="profile-avatar" />
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectAvatar(event)} disabled={avatarSaving} />
          <button type="button" className="profile-photo-button" onClick={() => avatarInputRef.current?.click()} disabled={avatarSaving}>{avatarSaving ? t("Preparing...") : t("Change photo")}</button>
          {hasCustomAvatar && <button type="button" className="profile-photo-remove" onClick={() => void saveAvatar(null)} disabled={avatarSaving}>{t("Remove")}</button>}
          {avatarNotice && <small className="profile-photo-notice success" role="status">{avatarNotice}</small>}
          {avatarError && <small className="profile-photo-notice error" role="alert">{avatarError}</small>}
        </div>
        <div><span>{viewer?.rank ? t("Season rank #{rank}", { rank: viewer.rank }) : t("Season 1 competitor")}</span><h1>{user.name}</h1><p>{user.email}</p>{savedSoccerverseUsername && <SoccerverseAccountLink username={savedSoccerverseUsername} />}</div>
        <div className="profile-actions">{viewer?.participantId && <a href={`/players/${encodeURIComponent(viewer.participantId)}`}>{t("View public profile")} <ArrowSquareOut size={18} /></a>}<button onClick={onAchievements}>{t("View achievements")} <ArrowRight size={18} /></button><button className="sign-out-button" onClick={() => authClient.signOut()}><SignOut size={18} /> {t("Sign out")}</button></div>
      </div>
      <section className="profile-connection" aria-labelledby="soccerverse-account-title">
        <div className="profile-connection-copy"><SoccerBall size={28} weight="duotone" /><div><h2 id="soccerverse-account-title">{t("Your Soccerverse account")}</h2><p>{t("Add your in-game username and choose which club crests appear in the weekly Spotlight.")}</p></div></div>
        <div className="profile-settings-forms">
          <form onSubmit={submitSoccerverseAccount}>
            <label htmlFor="soccerverse-username">{t("Soccerverse username")}</label>
            <div className="profile-connection-control">
              <input id="soccerverse-username" value={soccerverseUsername} onChange={(event) => setSoccerverseUsername(event.target.value)} placeholder={t("For example: klo")} autoComplete="off" disabled={profileSaving} />
              <button type="submit" disabled={profileSaving}>{profileSaving ? "…" : t("Save account")}</button>
              {savedSoccerverseUsername && <button className="remove-account" type="button" onClick={() => void saveSoccerverseAccount("")} disabled={profileSaving}>{t("Remove")}</button>}
            </div>
            <small>{t("You can also paste your Soccerverse profile URL. This public link never grants access to your game account.")}</small>
            {profileNotice && <span className="profile-form-notice success" role="status">{profileNotice}</span>}
            {profileError && <span className="profile-form-notice error" role="alert">{profileError}</span>}
          </form>
          <form className="datapack-settings" onSubmit={submitDatapackMode}>
            <fieldset>
              <legend>{t("Datapack source")}</legend>
              <div className="datapack-options">
                <label className={datapackMode === "default" ? "datapack-option active" : "datapack-option"}>
                  <input type="radio" name="datapack-mode" value="default" checked={datapackMode === "default"} onChange={() => setDatapackMode("default")} disabled={datapackSaving} />
                  <span><strong>{t("Soccerverse standard")}</strong><small>{t("Keep the current Spotlight shields.")}</small></span>
                </label>
                <label className={datapackMode === "community" ? "datapack-option active" : "datapack-option"}>
                  <input type="radio" name="datapack-mode" value="community" checked={datapackMode === "community"} onChange={() => setDatapackMode("community")} disabled={datapackSaving} />
                  <span><strong>{t("Community pack")}</strong><small>{t("Show real club crests from El Rincón.")}</small></span>
                </label>
              </div>
            </fieldset>
            <div className="datapack-save-row">
              <small>{t("Only the two crest images for the current match are requested. The full datapack is never downloaded.")}</small>
              <button type="submit" disabled={datapackSaving}>{datapackSaving ? "…" : t("Save display source")}</button>
            </div>
            {datapackNotice && <span className="profile-form-notice success" role="status">{datapackNotice}</span>}
            {datapackError && <span className="profile-form-notice error" role="alert">{datapackError}</span>}
          </form>
        </div>
      </section>
      <div className="profile-stats"><div><strong>{stats.points}</strong><span>{t("Season points")}</span></div><div><strong>{stats.exactScores}</strong><span>{t("Exact scores")}</span></div><div><strong>{stats.accuracy}%</strong><span>{t("Result accuracy")}</span></div><div><strong>{stats.countries}</strong><span>{t("Countries explored")}</span></div></div>
      <div className="history-panel"><div className="history-heading"><h2>{t("Prediction history")}</h2><span>{loading ? t("Loading") : new Intl.NumberFormat(locale).format(stats.predictions)}</span></div>{viewer?.history.map((item) => <article key={item.matchId}><span>{new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.kickoff * 1000))}</span><div className="history-match"><strong>{item.homeName} {item.result ? `${item.result.homeScore}-${item.result.awayScore}` : "vs"} {item.awayName}</strong><small>{item.prediction.homeScore}-{item.prediction.awayScore} · {item.competitionName}</small>{item.score && <div className="history-breakdown">{historyBreakdown(item.score).map(([label, points]) => <i className={points ? "hit" : ""} key={label}>{t(label)} +{points}</i>)}</div>}</div><small>{item.score ? t("Settled") : "..."}</small><b>{item.score ? `+${item.score.totalPoints}` : "-"}</b></article>)}{!loading && !viewer?.history.length && <SeasonEmpty title="-" description={t("Make your prediction")} />}</div>
    </section>
  );
}

"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- native anchors avoid a vinext dev-runtime duplicate React issue */

import {
  ArrowLeft,
  ArrowsClockwise,
  Broadcast,
  CalendarDots,
  CheckCircle,
  Crosshair,
  GlobeHemisphereWest,
  Lightning,
  LockKey,
  MagnifyingGlass,
  Ranking,
  SoccerBall,
  Sparkle,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildEditorialDraft, type EditorialTone } from "@/lib/editorial-story";

type Candidate = {
  id: string;
  rank: number;
  score: number;
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
  reasons: string[];
};

type Overview = {
  admin: { name: string; email: string };
  run: null | {
    id: string;
    weekKey: string;
    status: string;
    fixturesScanned: number;
    countriesScanned: number;
    createdAt: number;
    completedAt: number | null;
    error: string | null;
  };
  candidates: Candidate[];
  published: null | {
    candidateId: string;
    weekKey: string;
    editorialTitle: string;
    editorialSummary: string;
    homeName: string;
    awayName: string;
    kickoff: number;
    competitionName: string;
  };
};

type AdminView = "radar" | "users";

const storyDirections: { id: EditorialTone; label: string; description: string }[] = [
  { id: "dramatic", label: "Dramatic", description: "Stakes and tension" },
  { id: "analytical", label: "Analytical", description: "Numbers and balance" },
  { id: "discovery", label: "Discovery", description: "League and context" },
];

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  predictionCount: number;
  role: "admin" | "player";
  roleSource: "configured" | "delegated" | null;
  isCurrentUser: boolean;
};

type UsersPayload = {
  users: AdminUser[];
  summary: {
    total: number;
    joinedThisWeek: number;
    verified: number;
    predictors: number;
  };
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

export function AdminPanel() {
  const [adminView, setAdminView] = useState<AdminView>("radar");
  const [data, setData] = useState<Overview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [storyTone, setStoryTone] = useState<EditorialTone>("dramatic");
  const [storyVariation, setStoryVariation] = useState(0);

  const applyEditorialDraft = useCallback((candidate: Candidate, tone: EditorialTone, variation: number) => {
    const draft = buildEditorialDraft(candidate, tone, variation);
    setStoryTone(tone);
    setStoryVariation(variation);
    setTitle(draft.title);
    setSummary(draft.summary);
  }, []);

  const load = useCallback(async (preferredId?: string) => {
    const response = await fetch("/api/admin/radar", { cache: "no-store" });
    const payload = await response.json() as Overview & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Control room unavailable");
    setData(payload);
    const next = payload.candidates.find((item) => item.id === preferredId) || payload.candidates[0] || null;
    setSelectedId(next?.id || null);
    if (next) applyEditorialDraft(next, "dramatic", 0);
    else { setTitle(""); setSummary(""); }
  }, [applyEditorialDraft]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/radar", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Overview & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Control room unavailable");
        return payload;
      })
      .then((payload) => {
        const next = payload.candidates[0] || null;
        setData(payload);
        setSelectedId(next?.id || null);
        if (next) applyEditorialDraft(next, "dramatic", 0);
        else { setTitle(""); setSummary(""); }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Control room unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applyEditorialDraft]);

  const selected = useMemo(() => data?.candidates.find((candidate) => candidate.id === selectedId) || null, [data, selectedId]);

  function chooseCandidate(candidate: Candidate) {
    setSelectedId(candidate.id);
    applyEditorialDraft(candidate, "dramatic", 0);
  }

  function chooseStoryDirection(tone: EditorialTone) {
    if (!selected) return;
    applyEditorialDraft(selected, tone, storyVariation);
  }

  function regenerateStory() {
    if (!selected) return;
    applyEditorialDraft(selected, storyTone, storyVariation + 1);
  }

  async function runRadar() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/admin/radar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Radar failed");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Radar failed");
    } finally {
      setRunning(false);
    }
  }

  async function publish() {
    if (!selected) return;
    setPublishing(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/candidates/${selected.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Publication failed");
      await load(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication failed");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <AdminLoading />;
  if (!data) return <AdminDenied message={error} />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Image src="/logo.png" alt="Under the Lights" width={1774} height={887} priority />
        <button className={adminView === "radar" ? "admin-nav-item active" : "admin-nav-item"} onClick={() => setAdminView("radar")} aria-label="Spotlight radar"><Crosshair size={19} weight="bold" /><span>Spotlight radar</span></button>
        <div className="admin-nav-item soon"><Ranking size={19} /><span>Scoring rules</span><small>Soon</small></div>
        <button className={adminView === "users" ? "admin-nav-item active" : "admin-nav-item"} onClick={() => setAdminView("users")} aria-label="Participants"><UsersThree size={19} weight="bold" /><span>Participants</span></button>
        <div className="admin-sidebar-foot">
          <span>{initials(data.admin.name)}</span>
          <div><strong>{data.admin.name}</strong><small>Administrator</small></div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><p>{adminView === "radar" ? "Editorial control room" : "Community registry"}</p><h1>{adminView === "radar" ? "Choose the match that matters." : "Track every player."}</h1></div>
          <div className="admin-top-actions">
            <a href="/"><ArrowLeft size={17} /> Public site</a>
            {adminView === "radar" && <button onClick={runRadar} disabled={running}>
              <ArrowsClockwise size={18} className={running ? "is-spinning" : ""} />
              {running ? "Scanning Soccerverse" : "Run radar"}
            </button>}
          </div>
        </header>

        {error && <div className="admin-alert" role="alert"><WarningCircle size={20} /><span>{error}</span></div>}

        {adminView === "users" ? <UsersView /> : <>
        <section className="admin-metrics" aria-label="Radar summary">
          <Metric icon={CalendarDots} label="Target weekend" value={data.run?.weekKey ? formatWeek(data.run.weekKey) : "Not calculated"} />
          <Metric icon={SoccerBall} label="Fixtures screened" value={String(data.run?.fixturesScanned || 0)} />
          <Metric icon={GlobeHemisphereWest} label="Countries covered" value={String(data.run?.countriesScanned || 0)} />
          <Metric icon={Sparkle} label="Shortlist" value={`${data.candidates.length} matches`} />
        </section>

        {data.published && (
          <section className="published-strip">
            <div className="published-icon"><Broadcast size={25} weight="fill" /></div>
            <div>
              <span>Live spotlight</span>
              <strong>{data.published.homeName} vs {data.published.awayName}</strong>
              <small>{data.published.competitionName} - {dateTime.format(new Date(data.published.kickoff * 1000))}</small>
            </div>
            <CheckCircle size={24} weight="fill" />
          </section>
        )}

        {!data.run ? (
          <section className="admin-empty">
            <Lightning size={42} weight="duotone" />
            <h2>The radar is ready.</h2>
            <p>Launch the first scan to rank every Soccerverse fixture scheduled for next weekend.</p>
            <button onClick={runRadar} disabled={running}>{running ? "Scanning Soccerverse" : "Run the first radar"}</button>
          </section>
        ) : data.run.status === "failed" ? (
          <section className="admin-empty error-state"><WarningCircle size={42} /><h2>The scan did not finish.</h2><p>{data.run.error}</p><button onClick={runRadar}>Try again</button></section>
        ) : (
          <section className="radar-workspace">
            <div className="candidate-list">
              <div className="candidate-list-head">
                <div><h2>Weekend shortlist</h2><p>Ranked by sporting stakes, balance, form and discovery value.</p></div>
                <span>{data.run.status === "completed" ? "Calculation complete" : data.run.status}</span>
              </div>
              <div className="candidate-scroll">
                {data.candidates.map((candidate) => (
                  <button key={candidate.id} className={selectedId === candidate.id ? "candidate-row selected" : "candidate-row"} onClick={() => chooseCandidate(candidate)}>
                    <span className="candidate-rank">{String(candidate.rank).padStart(2, "0")}</span>
                    <span className="candidate-clubs"><strong>{candidate.homeName}</strong><small>vs</small><strong>{candidate.awayName}</strong><em>{candidate.competitionName} - {candidate.countryCode}</em></span>
                    <span className="candidate-date">{dateTime.format(new Date(candidate.kickoff * 1000))}</span>
                    <span className="candidate-score"><strong>{candidate.score.toFixed(1)}</strong><small>radar</small></span>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <aside className="candidate-inspector">
                <div className="inspector-top"><span>Candidate {String(selected.rank).padStart(2, "0")}</span><strong>{selected.score.toFixed(1)}</strong></div>
                <p className="inspector-competition">{selected.competitionName} - {selected.countryCode}</p>
                <div className="inspector-fixture">
                  <Team name={selected.homeName} position={selected.homePosition} points={selected.homePoints} />
                  <span>vs</span>
                  <Team name={selected.awayName} position={selected.awayPosition} points={selected.awayPoints} />
                </div>
                <time>{dateTime.format(new Date(selected.kickoff * 1000))}</time>

                <div className="comparison-grid">
                  <Comparison label="Form" home={selected.homeRecord || "No data"} away={selected.awayRecord || "No data"} />
                  <Comparison label="Squad rating" home={formatStrength(selected.homeStrength)} away={formatStrength(selected.awayStrength)} />
                  <Comparison label="Manager" home={selected.homeManager || "Vacant"} away={selected.awayManager || "Vacant"} />
                </div>

                <div className="reason-list"><h3>Why it surfaced</h3>{selected.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>

                <section className="story-workbench" aria-labelledby="story-direction-heading">
                  <div className="story-workbench-head">
                    <div><strong id="story-direction-heading">Story direction</strong><small>Built from verified radar data</small></div>
                    <button type="button" onClick={regenerateStory} aria-label="Generate another match story"><ArrowsClockwise size={14} /> New version</button>
                  </div>
                  <div className="story-directions" role="group" aria-label="Match story direction">
                    {storyDirections.map((direction) => (
                      <button key={direction.id} type="button" className={storyTone === direction.id ? "selected" : ""} aria-pressed={storyTone === direction.id} onClick={() => chooseStoryDirection(direction.id)}>
                        <strong>{direction.label}</strong><span>{direction.description}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="editorial-fields">
                  <label><span>Editorial title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
                  <label><span>Match story <small>{summary.length}/360</small></span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={360} rows={6} /></label>
                </div>
                <button className="publish-button" onClick={publish} disabled={publishing || !title.trim() || !summary.trim()}>
                  <Broadcast size={19} weight="fill" /> {publishing ? "Publishing" : data.published?.candidateId === selected.id ? "Update live spotlight" : "Publish this spotlight"}
                </button>
              </aside>
            )}
          </section>
        )}
        </>}
      </main>
    </div>
  );
}

function UsersView() {
  const [payload, setPayload] = useState<UsersPayload | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [pendingDemotionId, setPendingDemotionId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/users", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as UsersPayload & { error?: string };
        if (!response.ok) throw new Error(result.error || "Participant registry unavailable");
        return result;
      })
      .then(setPayload)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Participant registry unavailable");
      });
    return () => controller.abort();
  }, []);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload?.users || [];
    return (payload?.users || []).filter((user) =>
      `${user.name} ${user.email} ${user.providers.join(" ")}`.toLowerCase().includes(needle),
    );
  }, [payload, query]);

  async function updateRole(user: AdminUser, role: "admin" | "player") {
    setUpdatingUserId(user.id);
    setActionError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, role }),
      });
      const result = await response.json() as { error?: string; roleSource?: AdminUser["roleSource"] };
      if (!response.ok) throw new Error(result.error || "Unable to update access");
      setPayload((current) => current ? {
        ...current,
        users: current.users.map((item) => item.id === user.id
          ? { ...item, role, roleSource: result.roleSource ?? null }
          : item),
      } : current);
      setNotice(role === "admin" ? `${user.name} is now an administrator.` : `${user.name} is now a player.`);
      setPendingDemotionId(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update access");
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (error) return <section className="admin-empty error-state"><WarningCircle size={42} /><h2>Registry unavailable.</h2><p>{error}</p></section>;
  if (!payload) return <UsersLoading />;

  return (
    <>
      <section className="admin-metrics" aria-label="Participant summary">
        <Metric icon={UsersThree} label="Registered players" value={String(payload.summary.total)} />
        <Metric icon={CalendarDots} label="Joined this week" value={String(payload.summary.joinedThisWeek)} />
        <Metric icon={CheckCircle} label="Verified accounts" value={String(payload.summary.verified)} />
        <Metric icon={SoccerBall} label="Made a prediction" value={String(payload.summary.predictors)} />
      </section>

      <section className="users-registry">
        <header className="users-registry-head">
          <div><h2>Participant registry</h2><p>Every account created for Under the Lights, newest first.</p></div>
          <label className="user-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">Search participants</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or provider" />
          </label>
        </header>

        {notice ? <p className="users-role-notice success" role="status">{notice}</p> : null}
        {actionError ? <p className="users-role-notice error" role="alert">{actionError}</p> : null}

        {visibleUsers.length ? (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Participant</th><th>Sign-in</th><th>Joined</th><th>Last active</th><th>Predictions</th><th>Access</th></tr></thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Participant"><div className="user-identity"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}{user.emailVerified ? " / Verified" : ""}</small></div></div></td>
                    <td data-label="Sign-in"><div className="provider-list">{user.providers.map((provider) => <span key={provider}>{providerLabel(provider)}</span>)}</div></td>
                    <td data-label="Joined"><time dateTime={new Date(user.createdAt).toISOString()}>{memberDate(user.createdAt)}</time></td>
                    <td data-label="Last active"><time dateTime={new Date(user.lastActiveAt).toISOString()}>{relativeActivity(user.lastActiveAt)}</time></td>
                    <td data-label="Predictions"><strong className="prediction-count">{user.predictionCount}</strong></td>
                    <td data-label="Access">
                      <div className="access-control">
                        <span className={`access-level ${user.role}`}>{user.roleSource === "configured" ? "Owner admin" : user.role === "admin" ? "Admin" : "Player"}</span>
                        {user.roleSource === "configured" ? <small>Cloudflare managed</small> : user.role === "player" ? (
                          <button type="button" onClick={() => updateRole(user, "admin")} disabled={updatingUserId === user.id}>
                            {updatingUserId === user.id ? "Updating…" : "Make admin"}
                          </button>
                        ) : pendingDemotionId === user.id ? (
                          <span className="access-confirm">
                            <button type="button" className="danger" onClick={() => updateRole(user, "player")} disabled={updatingUserId === user.id}>
                              {updatingUserId === user.id ? "Updating…" : "Confirm removal"}
                            </button>
                            <button type="button" className="quiet" onClick={() => setPendingDemotionId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button type="button" className="danger" onClick={() => setPendingDemotionId(user.id)} disabled={user.isCurrentUser || updatingUserId === user.id} title={user.isCurrentUser ? "You cannot remove your own access" : undefined}>
                            {updatingUserId === user.id ? "Updating…" : user.isCurrentUser ? "Current account" : "Remove admin"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="users-empty"><MagnifyingGlass size={30} /><strong>No participant found</strong><span>Try another name, email or sign-in provider.</span></div>
        )}
        <footer className="users-registry-foot"><span>{visibleUsers.length} of {payload.summary.total} participants</span><span>Up to 500 newest accounts</span></footer>
      </section>
    </>
  );
}

function UsersLoading() {
  return <section className="users-loading" aria-label="Loading participants"><div /><div /><div /><div /><div /></section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarDots; label: string; value: string }) {
  return <div><Icon size={20} /><span>{label}</span><strong>{value}</strong></div>;
}

function Team({ name, position, points }: { name: string; position: number | null; points: number | null }) {
  return <div><span>{initials(name)}</span><strong>{name}</strong><small>{position ? `#${position}` : "Unranked"}{points !== null ? ` / ${points} pts` : ""}</small></div>;
}

function Comparison({ label, home, away }: { label: string; home: string; away: string }) {
  return <div><span>{label}</span><strong>{home}</strong><i /><strong>{away}</strong></div>;
}

function AdminLoading() {
  return <div className="admin-loading"><Image src="/logo.png" alt="Under the Lights" width={1774} height={887} priority /><div /><div /><p>Opening the control room</p></div>;
}

function AdminDenied({ message }: { message: string }) {
  return <main className="admin-denied"><LockKey size={46} weight="duotone" /><h1>Control room locked.</h1><p>{message || "Sign in with an authorised account to continue."}</p><a href="/"><ArrowLeft size={17} /> Return to the spotlight</a></main>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

function formatStrength(value: number | null) {
  return value === null ? "No data" : value.toFixed(1);
}

function formatWeek(weekKey: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${weekKey}T12:00:00Z`));
}

function providerLabel(provider: string) {
  return provider === "credential" ? "Email" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function memberDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function relativeActivity(timestamp: number) {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (elapsed < 7 * 86_400_000) return `${Math.floor(elapsed / 86_400_000)} days ago`;
  return memberDate(timestamp);
}

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
  Ranking,
  SoccerBall,
  Sparkle,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const dateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

export function AdminPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const load = useCallback(async (preferredId?: string) => {
    const response = await fetch("/api/admin/radar", { cache: "no-store" });
    const payload = await response.json() as Overview & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Control room unavailable");
    setData(payload);
    const next = payload.candidates.find((item) => item.id === preferredId) || payload.candidates[0] || null;
    setSelectedId(next?.id || null);
    setTitle(next ? `${next.homeName} vs ${next.awayName}` : "");
    setSummary(next ? editorialSuggestion(next) : "");
  }, []);

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
        setTitle(next ? `${next.homeName} vs ${next.awayName}` : "");
        setSummary(next ? editorialSuggestion(next) : "");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Control room unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(() => data?.candidates.find((candidate) => candidate.id === selectedId) || null, [data, selectedId]);

  function chooseCandidate(candidate: Candidate) {
    setSelectedId(candidate.id);
    setTitle(`${candidate.homeName} vs ${candidate.awayName}`);
    setSummary(editorialSuggestion(candidate));
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
        <div className="admin-nav-item active"><Crosshair size={19} weight="bold" /><span>Spotlight radar</span></div>
        <div className="admin-nav-item"><Ranking size={19} /><span>Scoring rules</span><small>Soon</small></div>
        <div className="admin-nav-item"><UsersThree size={19} /><span>Participants</span><small>Soon</small></div>
        <div className="admin-sidebar-foot">
          <span>{initials(data.admin.name)}</span>
          <div><strong>{data.admin.name}</strong><small>Administrator</small></div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><p>Editorial control room</p><h1>Choose the match that matters.</h1></div>
          <div className="admin-top-actions">
            <a href="/"><ArrowLeft size={17} /> Public site</a>
            <button onClick={runRadar} disabled={running}>
              <ArrowsClockwise size={18} className={running ? "is-spinning" : ""} />
              {running ? "Scanning Soccerverse" : "Run radar"}
            </button>
          </div>
        </header>

        {error && <div className="admin-alert" role="alert"><WarningCircle size={20} /><span>{error}</span></div>}

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

                <div className="editorial-fields">
                  <label><span>Editorial title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
                  <label><span>Match story</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={360} rows={4} /></label>
                </div>
                <button className="publish-button" onClick={publish} disabled={publishing || !title.trim() || !summary.trim()}>
                  <Broadcast size={19} weight="fill" /> {publishing ? "Publishing" : data.published?.candidateId === selected.id ? "Update live spotlight" : "Publish this spotlight"}
                </button>
              </aside>
            )}
          </section>
        )}
      </main>
    </div>
  );
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

function editorialSuggestion(candidate: Candidate) {
  if (candidate.homePosition && candidate.awayPosition && Math.max(candidate.homePosition, candidate.awayPosition) <= 2) {
    return `First meets second after matching starts to the season. ${candidate.homeName} and ${candidate.awayName} now share one stage.`;
  }
  return `${candidate.homeName} and ${candidate.awayName} arrive closely matched. This weekend, Soccerverse puts their story under the lights.`;
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

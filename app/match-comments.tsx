"use client";

import { ChatCircleText, PaperPlaneRight, Trash } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { MAX_COMMENT_LENGTH } from "@/lib/comments";
import { useI18n } from "@/lib/i18n";

type MatchComment = {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: number;
};

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function MatchComments({ matchId, user, onSignIn }: {
  matchId: number;
  user: { id: string; name: string } | null;
  onSignIn: () => void;
}) {
  const { t, locale } = useI18n();
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoadState("loading"));
    fetch(`/api/comments?matchId=${matchId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Comments unavailable");
        return await response.json() as { comments?: MatchComment[] };
      })
      .then((payload) => {
        setComments(payload.comments || []);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    return () => controller.abort();
  }, [matchId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (posting || !draft.trim()) return;
    setPosting(true);
    setNotice("");
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: String(matchId), body: draft }),
      });
      const payload = await response.json() as { comment?: MatchComment; error?: string };
      const created = payload.comment;
      if (!response.ok || !created) throw new Error(payload.error || t("Comment could not be posted"));
      setComments((current) => [created, ...current]);
      setDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("Comment could not be posted"));
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setComments((current) => current.filter((comment) => comment.id !== id));
  }

  const timestamp = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="match-comments" aria-labelledby="match-comments-title">
      <div className="section-heading">
        <span><ChatCircleText size={16} weight="bold" /> {t("Match talk")}</span>
        <h2 id="match-comments-title">{t("Every match tells a story.")}</h2>
        <p>{t("Share your take before kick-off or your memories after the final whistle.")}</p>
      </div>
      <div className="comments-panel">
        {user ? (
          <form className="comment-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="comment-draft">{t("Your story, your feelings, your take...")}</label>
            <textarea
              id="comment-draft"
              value={draft}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder={t("Your story, your feelings, your take...")}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="comment-form-footer">
              <small>{draft.length} / {MAX_COMMENT_LENGTH}</small>
              <button type="submit" disabled={posting || !draft.trim()}>
                {posting ? t("Posting...") : t("Post comment")} <PaperPlaneRight size={16} weight="bold" />
              </button>
            </div>
            {notice && <p className="form-notice" role="status">{notice}</p>}
          </form>
        ) : (
          <div className="comment-signin">
            <ChatCircleText size={24} weight="duotone" />
            <p>{t("Sign in to add your voice to this match.")}</p>
            <button type="button" onClick={onSignIn}>{t("Sign in")}</button>
          </div>
        )}
        {loadState === "loading" ? (
          <p className="comments-status">{t("Loading")}</p>
        ) : loadState === "error" ? (
          <p className="comments-status">{t("Comments are unavailable right now.")}</p>
        ) : comments.length === 0 ? (
          <p className="comments-status">{t("No comments yet. Yours could start the conversation.")}</p>
        ) : (
          <ol className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <span className="competitor-avatar" aria-hidden="true">
                  {initials(comment.authorName)}
                  {comment.avatarUrl && <span className="competitor-avatar-image" style={{ backgroundImage: `url(${JSON.stringify(comment.avatarUrl)})` }} />}
                </span>
                <div className="comment-content">
                  <header>
                    <strong>{comment.authorName}</strong>
                    <time dateTime={new Date(comment.createdAt).toISOString()}>{timestamp.format(new Date(comment.createdAt))}</time>
                  </header>
                  <p>{comment.body}</p>
                </div>
                {user?.id === comment.authorId && (
                  <button type="button" className="comment-delete" aria-label={t("Delete comment")} onClick={() => void remove(comment.id)}>
                    <Trash size={17} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

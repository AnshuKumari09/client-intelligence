import { useState } from "react";

const CLASS_LABELS = {
  confirmed_fact: "Confirmed fact",
  client_reported: "Client-reported",
  ai_inference: "AI inference",
  missing_information: "Missing info",
};

const CLASS_DOTS = {
  confirmed_fact: "🟢",
  client_reported: "🔵",
  ai_inference: "🟠",
  missing_information: "⚪",
};

function ClassBadge({ classification }) {
  const cls = classification || "missing_information";
  return (
    <span className={`badge ${cls}`}>
      {CLASS_DOTS[cls]} {CLASS_LABELS[cls] || cls}
    </span>
  );
}

function ConfidenceBar({ confidence }) {
  if (typeof confidence !== "number") return null;
  const pct = Math.round(confidence * 100);
  const filled = Math.round(confidence * 10);
  return (
    <div className="conf" title={`confidence ${confidence.toFixed(2)}`}>
      <span className="mono">{"█".repeat(filled)}{"░".repeat(10 - filled)}</span> {pct}%
    </div>
  );
}

function Evidence({ items, flaggedQuotes }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="evidence">
      {items.map((e, i) => {
        const flagged = flaggedQuotes?.has(e.quote);
        return (
          <div className="ev-item" key={i}>
            <b>
              {e.day}
              {e.timestamp ? ` · ${e.timestamp}` : ""} · {e.speaker}:
            </b>{" "}
            <span className="quote">&ldquo;{e.quote}&rdquo;</span>
            {flagged && (
              <div className="grounding-warning">
                ⚠ This quote could not be verified against the source transcript.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * label: optional small heading above the badge (e.g. "Overall rating")
 * finding: { value, classification, confidence, evidence, reason, review_status }
 * unit: optional suffix to append to the displayed value (e.g. "hrs", "steps/day")
 * flaggedQuotes: Set of quote strings that failed the evidence-grounding check
 * plausibilityIssue: { path, value, reason } if this finding's value failed a
 *                     sanity-range check (e.g. "7000" under sleep hours), else undefined
 * onReview(id, status, editedValue): called when the coach approves/edits/rejects
 * id: stable identifier for this finding, used only to report back to the parent
 */
export default function FindingCard({ label, finding, unit, flaggedQuotes, plausibilityIssue, onReview, id }) {
  const [status, setStatus] = useState("pending");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(finding?.value);

  if (!finding) return null;

  const cls = finding.classification || "missing_information";

  const displayValue =
    value === null || value === undefined || value === ""
      ? <i style={{ color: "var(--gray)" }}>Not mentioned in conversation</i>
      : `${value}${unit ? " " + unit : ""}`;

  function handleClick(newStatus) {
    setStatus(newStatus);
    setEditing(newStatus === "edited");
    onReview?.(id, newStatus, value);
  }

  return (
    <div className={`card ${cls}`}>
      <div className="card-top">
        <div>
          {label && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".03em",
                marginBottom: 4,
              }}
            >
              {label}
            </div>
          )}
          <ClassBadge classification={cls} />
        </div>
        <ConfidenceBar confidence={finding.confidence} />
      </div>

      {editing ? (
        <input
          className="value editable"
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onReview?.(id, "edited", value)}
          style={{ width: "100%", border: "none", background: "transparent", font: "inherit" }}
        />
      ) : (
        <div className="value">{displayValue}</div>
      )}

      {plausibilityIssue && (
        <div className="grounding-warning">⚠ {plausibilityIssue.reason}</div>
      )}

      {finding.reason && <div className="reason">Why AI concluded this: {finding.reason}</div>}

      <Evidence items={finding.evidence} flaggedQuotes={flaggedQuotes} />

      <div className="review-row">
        <button
          className={`rbtn approve ${status === "approved" ? "active" : ""}`}
          onClick={() => handleClick("approved")}
        >
          Approve
        </button>
        <button
          className={`rbtn edit ${status === "edited" ? "active" : ""}`}
          onClick={() => handleClick("edited")}
        >
          Edit
        </button>
        <button
          className={`rbtn reject ${status === "rejected" ? "active" : ""}`}
          onClick={() => handleClick("rejected")}
        >
          Reject
        </button>
        <span className="status-pill">{status === "pending" ? "pending review" : status}</span>
      </div>
    </div>
  );
}

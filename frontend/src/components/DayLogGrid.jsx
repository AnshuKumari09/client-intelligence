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

/**
 * entries: [{ day, finding }]
 * unit: suffix shown after the value (e.g. "steps", "hrs", "L")
 * plausibilityByIndex: Map<index, PlausibilityIssue> — cells whose value failed
 *                       a sanity-range check (e.g. "7000" under sleep hours)
 */
export default function DayLogGrid({ entries, unit, plausibilityByIndex }) {
  if (!entries || entries.length === 0) {
    return <p className="placeholder" style={{ padding: "10px 0" }}>No daily log returned.</p>;
  }
  return (
    <div className="daylog-grid">
      {entries.map((e, i) => {
        const f = e.finding || {};
        const cls = f.classification || "missing_information";
        const flagged = plausibilityByIndex?.get(i);
        const v =
          f.value === null || f.value === undefined || f.value === ""
            ? "—"
            : `${f.value}${unit ? " " + unit : ""}`;
        return (
          <div className="daylog-cell" key={i}>
            <div className="day">{e.day}</div>
            <div className="val" style={{ color: cls === "missing_information" ? "var(--gray)" : "var(--ink)" }}>
              {v}
            </div>
            <span className={`badge ${cls}`}>
              {CLASS_DOTS[cls]} {CLASS_LABELS[cls] || cls}
            </span>
            {flagged && (
              <div className="grounding-warning" style={{ marginTop: 6 }}>
                ⚠ {flagged.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import FindingCard from "./FindingCard";
import DayLogGrid from "./DayLogGrid";

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

function Empty({ text }) {
  return <p className="placeholder" style={{ padding: "10px 0" }}>{text}</p>;
}

function parsePlausibilityIssues(issues) {
  const exact = new Map();
  const indexed = new Map(); // prefix -> Map(index -> issue)
  for (const issue of issues || []) {
    const m = issue.path.match(/^(.*)\[(\d+)\]\.finding$/);
    if (m) {
      const [, prefix, idx] = m;
      if (!indexed.has(prefix)) indexed.set(prefix, new Map());
      indexed.get(prefix).set(Number(idx), issue);
    } else {
      exact.set(issue.path, issue);
    }
  }
  return { exact, indexed };
}

/**
 * report: the validated ClientIntelligenceReport dict from the backend
 * groundingIssues: array of { path, day, speaker, quote, reason } from the backend
 * plausibilityIssues: array of { path, value, reason } from the backend
 * activeTab: which section to render
 * onReview(id, status, value): bubbled up to the parent for export
 */
export default function ReportView({ report, groundingIssues, plausibilityIssues, activeTab, onReview }) {
  const flaggedQuotes = new Set((groundingIssues || []).map((g) => g.quote));
  const { exact: plausExact, indexed: plausIndexed } = parsePlausibilityIssues(plausibilityIssues);

  const d = report.domains || {};
  const nutrition = d.nutrition_adherence || {};
  const exercise = d.exercise_steps || {};
  const sleep = d.sleep || {};
  const water = d.water_intake || {};
  const symptoms = d.symptoms_stress || {};
  const eng = report.engagement || {};

  let idCounter = 0;
  const nextId = (prefix) => `${prefix}-${idCounter++}`;

  if (activeTab === "summary") {
    const ws = report.weekly_summary || {};
    return (
      <div>
        <h2 className="section-title">Weekly Summary</h2>
        <p className="section-sub">Period: {(report.meta || {}).period_covered || "—"}</p>
        <div className={`card ${ws.classification || "client_reported"}`}>
          <div className="card-top">
            <span className={`badge ${ws.classification || "client_reported"}`}>
              {CLASS_DOTS[ws.classification]} {CLASS_LABELS[ws.classification] || ws.classification}
            </span>
            <span className="conf">
              {typeof ws.confidence === "number" ? `confidence ${ws.confidence.toFixed(2)}` : ""}
            </span>
          </div>
          <p className="summary-text">{ws.text || "No summary returned."}</p>
        </div>
      </div>
    );
  }

  if (activeTab === "nutrition") {
    return (
      <div>
        <h2 className="section-title">Nutrition Adherence</h2>
        <p className="section-sub">Overall rating, daily log and identified gaps.</p>
        <FindingCard
          label="Overall rating"
          finding={nutrition.overall_rating}
          flaggedQuotes={flaggedQuotes}
          onReview={onReview}
          id={nextId("nutrition-overall")}
        />
        <h3 className="subhead">Daily log</h3>
        <DayLogGrid entries={nutrition.daily_log} />
        <h3 className="subhead">Gaps identified</h3>
        {(nutrition.gaps_identified || []).length ? (
          nutrition.gaps_identified.map((g) => (
            <FindingCard
              key={nextId("gap")}
              finding={g}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("gap")}
            />
          ))
        ) : (
          <Empty text="None flagged." />
        )}
      </div>
    );
  }

  if (activeTab === "exercise") {
    return (
      <div>
        <h2 className="section-title">Exercise / Steps</h2>
        <FindingCard
          label="Average steps"
          finding={exercise.avg_steps}
          unit="steps/day"
          flaggedQuotes={flaggedQuotes}
          plausibilityIssue={plausExact.get("domains.exercise_steps.avg_steps")}
          onReview={onReview}
          id={nextId("avg-steps")}
        />
        <h3 className="subhead">Daily step log</h3>
        <DayLogGrid
          entries={exercise.daily_log}
          unit="steps"
          plausibilityByIndex={plausIndexed.get("domains.exercise_steps.daily_log")}
        />
        <h3 className="subhead">Exercise types mentioned</h3>
        <p>{(exercise.exercise_types_mentioned || []).join(", ") || "—"}</p>
      </div>
    );
  }

  if (activeTab === "sleep") {
    return (
      <div>
        <h2 className="section-title">Sleep</h2>
        <FindingCard
          label="Average hours"
          finding={sleep.avg_hours}
          unit="hrs"
          flaggedQuotes={flaggedQuotes}
          plausibilityIssue={plausExact.get("domains.sleep.avg_hours")}
          onReview={onReview}
          id={nextId("avg-sleep")}
        />
        <FindingCard
          label="Trend"
          finding={sleep.trend}
          flaggedQuotes={flaggedQuotes}
          onReview={onReview}
          id={nextId("sleep-trend")}
        />
        <h3 className="subhead">Daily log</h3>
        <DayLogGrid
          entries={sleep.daily_log}
          unit="hrs"
          plausibilityByIndex={plausIndexed.get("domains.sleep.daily_log")}
        />
      </div>
    );
  }

  if (activeTab === "water") {
    return (
      <div>
        <h2 className="section-title">Water Intake</h2>
        <DayLogGrid
          entries={water.daily_log}
          unit="L"
          plausibilityByIndex={plausIndexed.get("domains.water_intake.daily_log")}
        />
      </div>
    );
  }

  if (activeTab === "symptoms") {
    return (
      <div>
        <h2 className="section-title">Symptoms / Stress</h2>
        <h3 className="subhead" style={{ marginTop: 0 }}>Symptoms reported</h3>
        {(symptoms.symptoms_reported || []).length ? (
          symptoms.symptoms_reported.map((s) => (
            <FindingCard
              key={nextId("symptom")}
              finding={s}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("symptom")}
            />
          ))
        ) : (
          <Empty text="None reported." />
        )}
        <h3 className="subhead">Stress events</h3>
        {(symptoms.stress_events || []).length ? (
          symptoms.stress_events.map((s) => (
            <FindingCard
              key={nextId("stress")}
              finding={s}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("stress")}
            />
          ))
        ) : (
          <Empty text="None flagged." />
        )}
      </div>
    );
  }

  if (activeTab === "engagement") {
    return (
      <div>
        <h2 className="section-title" style={{ textTransform: "capitalize" }}>
          Engagement — {eng.level || "—"}
        </h2>
        <FindingCard
          label="Engagement level basis"
          finding={eng.finding}
          flaggedQuotes={flaggedQuotes}
          onReview={onReview}
          id={nextId("engagement")}
        />
        <h3 className="subhead">Missed check-ins</h3>
        {(eng.missed_checkins || []).length ? (
          eng.missed_checkins.map((m) => (
            <FindingCard
              key={nextId("missed")}
              finding={m}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("missed")}
            />
          ))
        ) : (
          <Empty text="None." />
        )}
      </div>
    );
  }

  if (activeTab === "barriers") {
    return (
      <div>
        <h2 className="section-title">Key Barriers &amp; Pending Actions</h2>
        <h3 className="subhead" style={{ marginTop: 0 }}>Key barriers</h3>
        {(report.key_barriers || []).length ? (
          report.key_barriers.map((b) => (
            <FindingCard
              key={nextId("barrier")}
              finding={b}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("barrier")}
            />
          ))
        ) : (
          <Empty text="None identified." />
        )}
        <h3 className="subhead">Pending actions</h3>
        {(report.pending_actions || []).length ? (
          report.pending_actions.map((a) => (
            <FindingCard
              key={nextId("action")}
              finding={a}
              flaggedQuotes={flaggedQuotes}
              onReview={onReview}
              id={nextId("action")}
            />
          ))
        ) : (
          <Empty text="None." />
        )}
      </div>
    );
  }

  if (activeTab === "risks") {
    return (
      <div>
        <h2 className="section-title">Risk / Attention Flags</h2>
        {(report.risk_flags || []).length ? (
          report.risk_flags.map((rf) => {
            const cls = (rf.finding || {}).classification || "missing_information";
            return (
              <div className={`card ${cls}`} key={nextId("risk")}>
                <div className="card-top">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {rf.flag}{" "}
                    <span className={`badge severity_${rf.severity || "low"}`}>
                      {rf.severity || "low"} severity
                    </span>
                  </div>
                </div>
                <FindingCard
                  finding={rf.finding}
                  flaggedQuotes={flaggedQuotes}
                  onReview={onReview}
                  id={nextId("risk-finding")}
                />
              </div>
            );
          })
        ) : (
          <Empty text="No risk flags raised." />
        )}
      </div>
    );
  }

  if (activeTab === "next") {
    const na = report.recommended_next_action || {};
    return (
      <div>
        <h2 className="section-title">Recommended Next Action for Coach</h2>
        <div className={`card ${na.classification || "ai_inference"}`}>
          <div className="card-top">
            <span className={`badge ${na.classification || "ai_inference"}`}>
              {CLASS_DOTS[na.classification]} {CLASS_LABELS[na.classification] || na.classification}
            </span>
            <span className="conf">
              {typeof na.confidence === "number" ? `confidence ${na.confidence.toFixed(2)}` : ""}
            </span>
          </div>
          <div className="value">{na.action || "—"}</div>
          <div className="reason">{na.rationale || ""}</div>
        </div>
      </div>
    );
  }

  return null;
}

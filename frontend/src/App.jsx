import { useState, useRef } from "react";
import "./App.css";
import TranscriptPanel from "./components/TranscriptPanel";
import Tabs from "./components/Tabs";
import StatusBanner from "./components/StatusBanner";
import ReportView from "./components/ReportView";
import { analyzeTranscript } from "./api";
import { SAMPLE_CONVERSATION } from "./data/sampleConversation";

const STATUS_MESSAGES = {
  llm_error: {
    type: "error",
    render: (r) => `<b>Could not reach the model:</b> ${r.error_message}`,
  },
  parse_error: {
    type: "error",
    render: (r) =>
      `<b>Model output could not be parsed as JSON:</b> ${r.error_message} ` +
      `(likely a token-limit truncation — see raw output below)`,
  },
  validation_error: {
    type: "error",
    render: (r) =>
      `<b>Model output failed schema validation:</b><br>` +
      (r.schema_errors || []).map((e) => `• ${e}`).join("<br>"),
  },
  ok: {
    type: "info",
    render: (r) => {
      const parts = [
        "Analysis complete. Every finding below carries a classification, confidence score and evidence — review each before treating it as ground truth.",
      ];
      if (r.grounding_issues?.length) {
        parts.push(
          `<b>${r.grounding_issues.length} evidence quote(s) could not be verified against the transcript</b> — flagged inline below.`
        );
      }
      if (r.plausibility_issues?.length) {
        parts.push(
          `<b>${r.plausibility_issues.length} value(s) fell outside a plausible range</b> (e.g. a unit-confusion error) — flagged inline below.`
        );
      }
      return parts.join(" ");
    },
  },
};

export default function App() {
  const [transcript, setTranscript] = useState(SAMPLE_CONVERSATION);
  const [loading, setLoading] = useState(false);
  const [apiResult, setApiResult] = useState(null); // raw backend response
  const [activeTab, setActiveTab] = useState("summary");
  const reviewLog = useRef(new Map()); // id -> { status, value }

  async function handleAnalyze() {
    setLoading(true);
    setApiResult(null);
    reviewLog.current = new Map();
    try {
      const result = await analyzeTranscript(transcript.trim());
      setApiResult(result);
      setActiveTab("summary");
    } catch (err) {
      setApiResult({ status: "llm_error", error_message: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleReview(id, status, value) {
    reviewLog.current.set(id, { status, value });
  }

  function handleExport() {
    if (!apiResult?.report) return;
    const payload = {
      report: apiResult.report,
      grounding_issues: apiResult.grounding_issues,
      plausibility_issues: apiResult.plausibility_issues,
      human_review_log: Object.fromEntries(reviewLog.current),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "client-intelligence-report.json";
    a.click();
  }

  const status = apiResult?.status;
  const statusConfig = status ? STATUS_MESSAGES[status] : null;

  return (
    <div className="shell">
      <TranscriptPanel
        transcript={transcript}
        setTranscript={setTranscript}
        onAnalyze={handleAnalyze}
        loading={loading}
        onExport={handleExport}
        canExport={status === "ok"}
      />

      <div className="main">
        {statusConfig && (
          <StatusBanner
            type={statusConfig.type}
            message={statusConfig.render(apiResult)}
            rawOutput={apiResult.raw_model_output}
          />
        )}

        {status === "ok" ? (
          <>
            <Tabs active={activeTab} onChange={setActiveTab} />
            <ReportView
              report={apiResult.report}
              groundingIssues={apiResult.grounding_issues}
              plausibilityIssues={apiResult.plausibility_issues}
              activeTab={activeTab}
              onReview={handleReview}
            />
          </>
        ) : (
          <div className="placeholder">
            {loading
              ? "Calling the backend to extract structured findings…"
              : "Paste or edit the transcript on the left, then click Analyze conversation. Nothing has been generated yet — this prototype never shows placeholder data as if it were real output."}
          </div>
        )}
      </div>
    </div>
  );
}

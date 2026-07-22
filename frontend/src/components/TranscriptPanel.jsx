import Legend from "./Legend";

export default function TranscriptPanel({ transcript, setTranscript, onAnalyze, loading, onExport, canExport }) {
  return (
    <div className="side">
      <div className="brand">
        <div className="eyebrow">FUME · GenAI Product Intern Assignment</div>
        <h1>Client Intelligence</h1>
        <p>Evidence-grounded coach dashboard, generated live from the raw conversation below.</p>
      </div>

      <textarea
        className="transcript"
        spellCheck={false}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />

      <button className="primary" onClick={onAnalyze} disabled={loading}>
        {loading ? "Analyzing…" : "Analyze conversation →"}
      </button>

      {canExport && (
        <button className="ghost" onClick={onExport}>
          Export reviewed JSON
        </button>
      )}

      <Legend />
    </div>
  );
}

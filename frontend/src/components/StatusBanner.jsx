import { useState } from "react";

export default function StatusBanner({ type, message, rawOutput }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!message) return null;

  return (
    <div className={`status-banner ${type}`}>
      <div dangerouslySetInnerHTML={{ __html: message }} />
      {rawOutput && (
        <>
          <button className="raw-toggle" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? "Hide" : "Show"} raw model output
          </button>
          {showRaw && <pre className="raw">{rawOutput}</pre>}
        </>
      )}
    </div>
  );
}

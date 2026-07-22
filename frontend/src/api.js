const API_BASE = import.meta.env.VITE_API_URL || "";

export async function analyzeTranscript(transcript) {
  let res;

  try {
    res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript,
      }),
    });
  } catch (networkErr) {
    throw new Error(
      `Could not reach backend at ${API_BASE}: ${networkErr.message}`
    );
  }

  let data;

  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Backend returned invalid JSON (HTTP ${res.status})`
    );
  }

  if (!res.ok && !data.status) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

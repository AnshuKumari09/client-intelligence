const API_BASE = import.meta.env.VITE_API_URL;

export async function analyzeTranscript(transcript) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return await res.json();
}

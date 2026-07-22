const TAB_LIST = [
  { id: "summary", label: "Weekly Summary" },
  { id: "nutrition", label: "Nutrition" },
  { id: "exercise", label: "Exercise / Steps" },
  { id: "sleep", label: "Sleep" },
  { id: "water", label: "Water" },
  { id: "symptoms", label: "Symptoms / Stress" },
  { id: "engagement", label: "Engagement" },
  { id: "barriers", label: "Barriers & Actions" },
  { id: "risks", label: "Risk Flags" },
  { id: "next", label: "Next Action" },
];

export default function Tabs({ active, onChange }) {
  return (
    <div className="tabs">
      {TAB_LIST.map((t) => (
        <div
          key={t.id}
          className={`tab ${active === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}

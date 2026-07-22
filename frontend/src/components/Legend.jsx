const ITEMS = [
  { color: "var(--teal)", label: "Confirmed fact — stated directly" },
  { color: "var(--violet)", label: "Client-reported — subjective, at face value" },
  { color: "var(--amber)", label: "AI inference — pattern the model drew, with reason" },
  { color: "var(--gray)", label: "Missing / unavailable information" },
];

export default function Legend() {
  return (
    <div className="legend">
      {ITEMS.map((item) => (
        <div className="row" key={item.label}>
          <span className="swatch" style={{ background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

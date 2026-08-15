export default function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="text-muted" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{hint}</div>}
    </div>
  );
}

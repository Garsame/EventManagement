export default function EmptyState({ title = "Nothing here", description = "No data available", action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">☁️</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

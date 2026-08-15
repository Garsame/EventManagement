export default function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header" style={{ marginBottom: "0.5rem" }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle && <p className="text-muted" style={{ margin: "0.2rem 0 0" }}>{subtitle}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}

export default function Loading({ label = "Loading..." }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

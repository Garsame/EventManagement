const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * A numbered dot per stage, joined by the line between them. Completed stages
 * show a tick instead of their number, so "done" reads at a glance without
 * having to compare against the current step.
 *
 * `steps` is [{ key, label }]; `current` is the zero-based active index.
 */
export default function Stepper({ steps = [], current = 0, className = "" }) {
  return (
    <div className={`stepper ${className}`} role="list">
      {steps.map((step, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <div key={step.key || i} className="contents">
            <div
              className={`step ${done ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="step-dot">
                {done ? <CheckIcon /> : i + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className={`step-line ${done ? "is-done" : ""}`} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

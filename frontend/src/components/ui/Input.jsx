import { forwardRef, useState } from "react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path
      d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.22 4.53M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Input = forwardRef(function Input(
  { label, error, helper, icon, className = "", inputClassName = "", ...props },
  ref
) {
  // Every password field in the app gets a show/hide toggle for free just by
  // using type="password" here - nothing to opt into at each call site.
  const isPassword = props.type === "password";
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={cx("input-row", className)}>
      {label && (
        <label className="input-label" htmlFor={props.id || props.name}>
          {label}
        </label>
      )}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          ref={ref}
          className={cx(
            "input",
            icon && "with-icon",
            isPassword && "with-icon-right",
            inputClassName,
            error && "input-error"
          )}
          {...props}
          type={isPassword ? (revealed ? "text" : "password") : props.type}
        />
        {isPassword && (
          <button
            type="button"
            className="input-icon-toggle"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            tabIndex={-1}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {helper && <div className="helper-text">{helper}</div>}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
});

export default Input;

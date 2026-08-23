import { forwardRef } from "react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

/** Input's contract again, plus an optional live character count. */
const Textarea = forwardRef(function Textarea(
  { label, error, helper, maxLength, showCount = false, className = "", textareaClassName = "", ...props },
  ref
) {
  const length = String(props.value ?? "").length;

  return (
    <div className={cx("input-row", className)}>
      {label && (
        <label className="input-label" htmlFor={props.id || props.name}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        maxLength={maxLength}
        className={cx("textarea", textareaClassName, error && "input-error")}
        {...props}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {helper && !error && <div className="helper-text">{helper}</div>}
          {error && <div className="error-text">{error}</div>}
        </div>
        {showCount && maxLength && (
          <div className={cx("helper-text shrink-0 tabular-nums", length > maxLength * 0.9 && "text-amber-600")}>
            {length}/{maxLength}
          </div>
        )}
      </div>
    </div>
  );
});

export default Textarea;

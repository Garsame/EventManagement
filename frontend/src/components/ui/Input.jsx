import { forwardRef } from "react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const Input = forwardRef(function Input(
  { label, error, helper, icon, className = "", inputClassName = "", ...props },
  ref
) {
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
          className={cx("input", icon && "with-icon", inputClassName, error && "input-error")}
          {...props}
        />
      </div>
      {helper && <div className="helper-text">{helper}</div>}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
});

export default Input;

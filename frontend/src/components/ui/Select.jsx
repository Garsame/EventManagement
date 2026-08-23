import { forwardRef } from "react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

/**
 * Same label / helper / error contract as Input, so a form can mix the two
 * and every field lines up and reports errors in the same place.
 */
const Select = forwardRef(function Select(
  { label, error, helper, placeholder = "Select…", options = [], className = "", selectClassName = "", ...props },
  ref
) {
  return (
    <div className={cx("input-row", className)}>
      {label && (
        <label className="input-label" htmlFor={props.id || props.name}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cx("select", selectClassName, error && "input-error")}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helper && !error && <div className="helper-text">{helper}</div>}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
});

export default Select;

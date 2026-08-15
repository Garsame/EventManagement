const styles = {
  base: "btn",
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

export default function Button({ children, variant = "primary", className = "", loading = false, ...props }) {
  return (
    <button className={cx(styles.base, styles[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading && <span className="spinner" aria-hidden />} {children}
    </button>
  );
}

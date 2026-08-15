const cx = (...classes) => classes.filter(Boolean).join(" ");

export default function Alert({ children, variant = "info", className = "", ...props }) {
  return (
    <div className={cx("alert", `alert-${variant}`, className)} {...props}>
      {children}
    </div>
  );
}

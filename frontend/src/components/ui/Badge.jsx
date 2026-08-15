const cx = (...classes) => classes.filter(Boolean).join(" ");

export default function Badge({ children, variant = "neutral", className = "" }) {
  return <span className={cx("badge", `badge-${variant}`, className)}>{children}</span>;
}

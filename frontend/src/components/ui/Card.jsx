const cx = (...classes) => classes.filter(Boolean).join(" ");

export default function Card({ children, className = "", ...props }) {
  return (
    <div className={cx("card-surface", className)} {...props}>
      {children}
    </div>
  );
}

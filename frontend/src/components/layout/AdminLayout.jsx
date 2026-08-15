import Navbar from "../Navbar.jsx";

export default function AdminLayout({ sidebar, children, topbar }) {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="admin-shell">
        <aside className="sidebar">
          {sidebar}
        </aside>
        <div className="admin-content">
          {topbar}
          {children}
        </div>
      </div>
    </div>
  );
}

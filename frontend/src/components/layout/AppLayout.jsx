import Navbar from "../Navbar.jsx";

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

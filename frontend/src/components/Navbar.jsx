import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client.js";
import * as tokenStore from "../api/tokenStore.js";
import Button from "./ui/Button.jsx";

const parseUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("ems_user");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
};

function Logo() {
  return (
    <Link to="/" className="nav-brand">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="15" stroke="url(#navLogoGrad)" strokeWidth="2" />
        <path d="M16 6 L23 12 L23 20 L16 26 L9 20 L9 12 Z" stroke="url(#navLogoGrad)" strokeWidth="1.6" fill="none" />
        <circle cx="16" cy="16" r="4.5" fill="url(#navLogoGrad)" />
        <defs>
          <linearGradient id="navLogoGrad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
      </svg>
      <span>EventMedia</span>
    </Link>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(!!tokenStore.getAccessToken());
  const [user, setUser] = useState(parseUser());

  useEffect(() => {
    const update = () => {
      setIsAuthed(!!tokenStore.getAccessToken());
      setUser(parseUser());
    };
    window.addEventListener("authchange", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("authchange", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (refreshToken) {
        await client.post("/api/auth/logout", { refreshToken });
      }
    } catch (err) {
      console.warn("Logout error", err);
    } finally {
      tokenStore.clearTokens();
      window.localStorage.removeItem("ems_user");
      setIsAuthed(false);
      setUser(null);
      navigate("/login");
    }
  };

  const isStaff = user?.role === "admin" || user?.role === "photographer";

  return (
    <div className="navbar">
      <div className="navbar-inner">
        <Logo />

        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/events">Events</Link>
          {isStaff && <Link to="/admin/dashboard">Dashboard</Link>}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <>
              {/* The brand plus this chip plus Logout overflows a 375px
                  viewport, so the chip only appears once there is room. */}
              {user && (
                <span className="nav-user hidden sm:inline-flex">
                  <span className="font-bold text-slate-900 capitalize">{user.role}</span>
                  <span className="text-muted hidden md:inline">{user.email}</span>
                </span>
              )}
              <Button variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-2">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

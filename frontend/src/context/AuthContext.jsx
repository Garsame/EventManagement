import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import * as tokenStore from "../api/tokenStore.js";

// Prefixed for the same reason as tokenStore.js's keys - see the comment
// there. Orphans anything stored under the old "ems_user" key.
const USER_KEY = "ems_public_user";
const AuthContext = createContext(null);

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredUser = (user) => {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(!!tokenStore.getAccessToken());

  // localStorage holds a snapshot from login; re-fetch so profile edits made
  // elsewhere (or fields added since) are reflected on load.
  //
  // This is also the enforcement point for the public/admin/photographer
  // boundary: /api/users/me and /api/auth/refresh are shared by all three
  // realms and don't know which UI is calling them, so a token that somehow
  // ended up in this realm's storage - a leftover from testing, a bug
  // elsewhere - could otherwise authenticate as whatever role it carries.
  // Refusing anything that isn't an attendee here means the public site can
  // never render an admin's or photographer's session, even by accident.
  const refreshUser = useCallback(async () => {
    if (!tokenStore.getAccessToken()) {
      setUser(null);
      writeStoredUser(null);
      return null;
    }
    try {
      const res = await client.get("/api/users/me");
      if (res.data.user.role !== "attendee") {
        tokenStore.clearTokens();
        writeStoredUser(null);
        setUser(null);
        return null;
      }
      setUser(res.data.user);
      writeStoredUser(res.data.user);
      return res.data.user;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tokenStore.getAccessToken()) refreshUser();
    else setLoading(false);
  }, [refreshUser]);

  // Keep in step with token changes from the axios interceptor or other tabs.
  useEffect(() => {
    const onAuthChange = () => {
      if (!tokenStore.getAccessToken()) {
        setUser(null);
        writeStoredUser(null);
      }
    };
    window.addEventListener("authchange", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("authchange", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await client.post("/api/auth/login", { email, password });
    // The backend already restricts this endpoint to attendees; this is a
    // second, defensive check so the same rule holds even if that ever
    // changes without this file being updated to match.
    if (res.data.user.role !== "attendee") {
      throw new Error("This sign-in is for attendees only.");
    }
    tokenStore.setAccessToken(res.data.accessToken);
    tokenStore.setRefreshToken(res.data.refreshToken);
    setUser(res.data.user);
    writeStoredUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (refreshToken) await client.post("/api/auth/logout", { refreshToken });
    } catch {
      // Clearing local state matters more than the server round trip.
    } finally {
      tokenStore.clearTokens();
      setUser(null);
      writeStoredUser(null);
    }
  }, []);

  const applyUser = useCallback((next) => {
    setUser(next);
    writeStoredUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthed: !!user,
      profileComplete: !!user?.profileComplete,
      login,
      logout,
      refreshUser,
      applyUser,
    }),
    [user, loading, login, logout, refreshUser, applyUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export default AuthContext;

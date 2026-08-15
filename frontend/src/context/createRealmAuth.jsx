import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Builds a self-contained auth provider/hook pair for one realm (admin,
 * photographer). Mirrors the shape of the public AuthContext but reads and
 * writes through that realm's own isolated token store and client.
 */
export function createRealmAuth(realm, { loginPath }) {
  const Context = createContext(null);

  function Provider({ children }) {
    const [user, setUser] = useState(() => realm.tokenStore.getUser());
    const [loading, setLoading] = useState(!!realm.tokenStore.getAccessToken());

    const refreshUser = useCallback(async () => {
      if (!realm.tokenStore.getAccessToken()) {
        setUser(null);
        realm.tokenStore.setUser(null);
        return null;
      }
      try {
        const res = await realm.client.get("/api/users/me");
        setUser(res.data.user);
        realm.tokenStore.setUser(res.data.user);
        return res.data.user;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (realm.tokenStore.getAccessToken()) refreshUser();
      else setLoading(false);
    }, [refreshUser]);

    useEffect(() => {
      const onChange = () => {
        if (!realm.tokenStore.getAccessToken()) {
          setUser(null);
          realm.tokenStore.setUser(null);
        }
      };
      window.addEventListener(realm.authEventName, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(realm.authEventName, onChange);
        window.removeEventListener("storage", onChange);
      };
    }, []);

    const login = useCallback(async (email, password) => {
      const res = await realm.client.post(loginPath, { email, password });
      realm.tokenStore.setAccessToken(res.data.accessToken);
      realm.tokenStore.setRefreshToken(res.data.refreshToken);
      setUser(res.data.user);
      realm.tokenStore.setUser(res.data.user);
      return res.data.user;
    }, []);

    const logout = useCallback(async () => {
      try {
        const refreshToken = realm.tokenStore.getRefreshToken();
        if (refreshToken) await realm.client.post("/api/auth/logout", { refreshToken });
      } catch {
        // Local cleanup still happens even if the network call fails.
      } finally {
        realm.tokenStore.clear();
        setUser(null);
      }
    }, []);

    const applyUser = useCallback((next) => {
      setUser(next);
      realm.tokenStore.setUser(next);
    }, []);

    const adoptTokens = useCallback((accessToken, refreshToken, nextUser) => {
      realm.tokenStore.setAccessToken(accessToken);
      realm.tokenStore.setRefreshToken(refreshToken);
      setUser(nextUser);
      realm.tokenStore.setUser(nextUser);
    }, []);

    const value = useMemo(
      () => ({ user, loading, isAuthed: !!user, login, logout, refreshUser, applyUser, adoptTokens, client: realm.client }),
      [user, loading, login, logout, refreshUser, applyUser, adoptTokens]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  const useRealmAuth = () => {
    const ctx = useContext(Context);
    if (!ctx) throw new Error("useRealmAuth used outside its Provider");
    return ctx;
  };

  return { Provider, useRealmAuth, Context };
}

export default createRealmAuth;

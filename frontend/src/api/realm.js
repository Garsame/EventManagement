import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Builds an isolated token store + axios client for one auth realm (public,
 * admin, photographer). Each realm keeps its own localStorage keys so signing
 * into one never touches, reveals, or gets confused with a session in another
 * - opening /maamul in one tab and the public site in another just works.
 */
export function createRealm(prefix) {
  const ACCESS_KEY = `ems_${prefix}_access_token`;
  const REFRESH_KEY = `ems_${prefix}_refresh_token`;
  const USER_KEY = `ems_${prefix}_user`;

  let accessTokenMemory = null;

  const emitAuthChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(`authchange:${prefix}`));
    }
  };

  const tokenStore = {
    getAccessToken() {
      if (accessTokenMemory) return accessTokenMemory;
      if (typeof window === "undefined") return null;
      accessTokenMemory = window.localStorage.getItem(ACCESS_KEY);
      return accessTokenMemory;
    },
    setAccessToken(token) {
      accessTokenMemory = token || null;
      if (typeof window === "undefined") return;
      if (token) window.localStorage.setItem(ACCESS_KEY, token);
      else window.localStorage.removeItem(ACCESS_KEY);
      emitAuthChange();
    },
    getRefreshToken() {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(REFRESH_KEY);
    },
    setRefreshToken(token) {
      if (typeof window === "undefined") return;
      if (token) window.localStorage.setItem(REFRESH_KEY, token);
      else window.localStorage.removeItem(REFRESH_KEY);
    },
    getUser() {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setUser(user) {
      if (typeof window === "undefined") return;
      if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      else window.localStorage.removeItem(USER_KEY);
    },
    clear() {
      tokenStore.setAccessToken(null);
      tokenStore.setRefreshToken(null);
      tokenStore.setUser(null);
    },
  };

  const client = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" } });

  client.interceptors.request.use((config) => {
    const token = tokenStore.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  let isRefreshing = false;
  let refreshPromise = null;

  const refreshTokens = async () => {
    if (isRefreshing && refreshPromise) return refreshPromise;
    isRefreshing = true;
    refreshPromise = (async () => {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );
      tokenStore.setAccessToken(response.data.accessToken);
      tokenStore.setRefreshToken(response.data.refreshToken);
      isRefreshing = false;
      return response.data.accessToken;
    })().catch((err) => {
      isRefreshing = false;
      tokenStore.clear();
      throw err;
    });
    return refreshPromise;
  };

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && !original._retry) {
        original._retry = true;
        try {
          const newAccess = await refreshTokens();
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccess}`;
          return client(original);
        } catch {
          tokenStore.clear();
        }
      }
      return Promise.reject(error);
    }
  );

  return { prefix, tokenStore, client, authEventName: `authchange:${prefix}` };
}

export default createRealm;

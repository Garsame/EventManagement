import axios from "axios";
import * as tokenStore from "./tokenStore.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const accessToken = tokenStore.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
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
    const { accessToken, refreshToken: newRefresh } = response.data;
    tokenStore.setAccessToken(accessToken);
    tokenStore.setRefreshToken(newRefresh);
    isRefreshing = false;
    return accessToken;
  })().catch((err) => {
    isRefreshing = false;
    tokenStore.clearTokens();
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
      } catch (err) {
        tokenStore.clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;

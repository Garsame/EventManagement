const ACCESS_KEY = "ems_access_token";
const REFRESH_KEY = "ems_refresh_token";

let accessTokenMemory = null;

const emitAuthChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("authchange"));
  }
};

export const getAccessToken = () => {
  if (accessTokenMemory) return accessTokenMemory;
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(ACCESS_KEY);
  accessTokenMemory = token;
  return token;
};

export const setAccessToken = (token) => {
  accessTokenMemory = token || null;
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(ACCESS_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_KEY);
  }
  emitAuthChange();
};

export const getRefreshToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
};

export const setRefreshToken = (token) => {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(REFRESH_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_KEY);
  }
};

export const clearTokens = () => {
  setAccessToken(null);
  setRefreshToken(null);
};

export default {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
};

import { createRealm } from "../api/realm.js";
import { createRealmAuth } from "./createRealmAuth.jsx";

export const photographerRealm = createRealm("photographer");
const { Provider, useRealmAuth } = createRealmAuth(photographerRealm, {
  loginPath: "/api/auth/photographer/login",
});

export const PhotographerAuthProvider = Provider;
export const usePhotographerAuth = useRealmAuth;
export const photographerClient = photographerRealm.client;
export const photographerTokenStore = photographerRealm.tokenStore;

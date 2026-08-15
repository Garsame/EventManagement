import { createRealm } from "../api/realm.js";
import { createRealmAuth } from "./createRealmAuth.jsx";

// Isolated from the public site and from the photographer realm: separate
// localStorage keys, separate axios instance, separate login endpoint.
export const adminRealm = createRealm("admin");
const { Provider, useRealmAuth } = createRealmAuth(adminRealm, { loginPath: "/api/auth/admin/login" });

export const AdminAuthProvider = Provider;
export const useAdminAuth = useRealmAuth;
export const adminClient = adminRealm.client;
export const adminTokenStore = adminRealm.tokenStore;

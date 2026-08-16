import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// Mocked before the component imports so AuthContext picks up the mocks.
vi.mock("../../api/client.js", () => ({ default: { get: vi.fn() } }));
vi.mock("../../api/tokenStore.js", () => ({
  getAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearTokens: vi.fn(),
}));

import client from "../../api/client.js";
import * as tokenStore from "../../api/tokenStore.js";
import { AuthProvider, useAuth } from "../AuthContext.jsx";

function Probe() {
  const { user, isAuthed, loading } = useAuth();
  if (loading) return <span>loading</span>;
  return <span>{isAuthed ? `authed:${user.role}` : "signed-out"}</span>;
}

/**
 * This is the actual bug from earlier in the project: an admin token had
 * ended up sitting in the public realm's storage (left over from testing
 * before the realms were split into separately-prefixed keys) and the public
 * navbar rendered a full admin session around it, because nothing checked
 * whose token it actually was. The fix was making the public AuthContext
 * refuse any identity that isn't an attendee. These tests are that fix,
 * pinned down so it can't regress silently.
 */
describe("AuthContext realm boundary", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  test("an admin identity in the public realm's storage is rejected and cleared, not rendered", async () => {
    tokenStore.getAccessToken.mockReturnValue("some-token");
    client.get.mockResolvedValue({ data: { user: { role: "admin", email: "admin@example.com" } } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
    expect(tokenStore.clearTokens).toHaveBeenCalledOnce();
  });

  test("a photographer identity is rejected the same way", async () => {
    tokenStore.getAccessToken.mockReturnValue("some-token");
    client.get.mockResolvedValue({ data: { user: { role: "photographer", email: "p@example.com" } } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
    expect(tokenStore.clearTokens).toHaveBeenCalledOnce();
  });

  test("a genuine attendee identity is accepted and rendered normally", async () => {
    tokenStore.getAccessToken.mockReturnValue("some-token");
    client.get.mockResolvedValue({ data: { user: { role: "attendee", email: "guest@example.com" } } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("authed:attendee")).toBeInTheDocument());
    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
  });

  test("with no token at all, nothing is fetched and the state is signed-out", async () => {
    tokenStore.getAccessToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
    expect(client.get).not.toHaveBeenCalled();
  });
});

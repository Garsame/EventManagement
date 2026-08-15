import { useState } from "react";
import defaultClient from "../api/client.js";
import Card from "./ui/Card.jsx";
import Input from "./ui/Input.jsx";
import Button from "./ui/Button.jsx";
import Alert from "./ui/Alert.jsx";
import * as defaultTokenStore from "../api/tokenStore.js";

/**
 * Password change confirmed by a code emailed to the account address, so
 * knowing a stolen session alone is not enough to take the account over.
 * `client` and `tokenStore` default to the public realm, but any realm
 * (admin, photographer) can pass its own so the refreshed tokens land in the
 * right isolated session rather than the public one.
 */
export default function ChangePasswordCard({ email, client = defaultClient, tokenStore = defaultTokenStore }) {
  const [stage, setStage] = useState("idle"); // idle -> code
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);

  const reset = () => {
    setStage("idle");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const requestCode = async () => {
    setLoading(true);
    setError("");
    setDone(false);
    try {
      const res = await client.post("/api/auth/password/request-otp");
      setNotice(
        res.data.delivered
          ? `We sent a 6-digit code to ${res.data.email}.`
          : `Email is not configured, so the code was logged on the server: ${res.data.devCode}`
      );
      setStage("code");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not send the code");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await client.post("/api/auth/password/change", { code, newPassword });
      tokenStore.setAccessToken(res.data.accessToken);
      tokenStore.setRefreshToken(res.data.refreshToken);
      setDone(true);
      reset();
    } catch (err) {
      const data = err.response?.data?.error;
      setError(
        data?.attemptsLeft !== undefined
          ? `${data.message} ${data.attemptsLeft} attempt(s) left.`
          : data?.message || "Could not change your password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="mt-0 mb-1 text-lg font-bold">Password</h3>
      <p className="text-muted mt-0">
        We email a one-time code to <strong>{email}</strong> before any change.
      </p>

      {done && <Alert variant="success" className="mb-4">Your password has been changed.</Alert>}

      {stage === "idle" && (
        <>
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          <Button type="button" variant="ghost" onClick={requestCode} disabled={loading}>
            {loading ? "Sending…" : "Change password"}
          </Button>
        </>
      )}

      {stage === "code" && (
        <form onSubmit={submit}>
          {notice && <Alert variant="info" className="mb-4">{notice}</Alert>}
          <Input
            label="6-digit code"
            id="pwd-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            inputClassName="text-center text-xl tracking-[0.4em] font-bold"
            required
          />
          <div className="two-col">
            <Input
              label="New password"
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              helper="At least 6 characters."
            />
            <Input
              label="Confirm new password"
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          <div className="flex gap-2 flex-wrap">
            <Button type="submit" disabled={loading || code.length !== 6}>
              {loading ? "Saving…" : "Set new password"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={loading}>Cancel</Button>
            <Button type="button" variant="ghost" onClick={requestCode} disabled={loading}>Resend code</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

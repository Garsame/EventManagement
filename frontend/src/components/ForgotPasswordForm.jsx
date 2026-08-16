import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import Input from "./ui/Input.jsx";
import Button from "./ui/Button.jsx";
import Alert from "./ui/Alert.jsx";

/**
 * Recovery for someone locked out entirely - no session, so it always uses
 * the plain public client regardless of which realm's login page it was
 * opened from. The backend endpoint gives an identical response whether or
 * not the email is registered; this form mirrors that by showing the same
 * notice either way rather than inventing a "delivered" state that would
 * leak the difference.
 */
export default function ForgotPasswordForm({ loginPath }) {
  const [stage, setStage] = useState("email"); // email -> code -> done
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await client.post("/api/auth/forgot-password/request", { email });
      setNotice(res.data.devCode ? `Email is not configured, so the code was logged on the server: ${res.data.devCode}` : res.data.message);
      setStage("code");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not send a reset code");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await client.post("/api/auth/forgot-password/verify", { email, code, newPassword });
      setStage("done");
    } catch (err) {
      const data = err.response?.data?.error;
      setError(
        data?.attemptsLeft !== undefined
          ? `${data.message} ${data.attemptsLeft} attempt(s) left.`
          : data?.message || "Could not reset your password"
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = () => {
    setCode("");
    setError("");
    requestCode({ preventDefault: () => {} });
  };

  if (stage === "done") {
    return (
      <div>
        <Alert variant="success">Your password has been changed.</Alert>
        <p className="text-muted mt-4 mb-0">Any other device you were signed in on has been signed out.</p>
        <Link to={loginPath} className="btn btn-primary mt-4" style={{ width: "100%" }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <form onSubmit={submitReset}>
        {notice && <Alert variant="info" className="mb-4">{notice}</Alert>}
        <Input
          label="6-digit code"
          id="fp-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          inputClassName="text-center text-xl tracking-[0.4em] font-bold"
          required
          autoFocus
        />
        <Input
          label="New password"
          id="fp-new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          required
          helper="At least 6 characters."
        />
        <Input
          label="Confirm new password"
          id="fp-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          required
        />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" disabled={loading || code.length !== 6} style={{ width: "100%", marginTop: "0.5rem" }}>
          {loading ? "Resetting…" : "Set new password"}
        </Button>
        <div className="flex justify-between items-center mt-3">
          <button type="button" className="text-sm font-semibold text-brand-600 dark:text-brand-300" onClick={resend} disabled={loading}>
            Resend code
          </button>
          <Link to={loginPath} className="text-sm text-muted">Back to sign in</Link>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode}>
      <Input
        label="Email"
        id="fp-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
      />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
        {loading ? "Sending…" : "Send reset code"}
      </Button>
      <p className="text-muted mt-3 mb-0 text-center text-sm">
        <Link to={loginPath}>Back to sign in</Link>
      </p>
    </form>
  );
}

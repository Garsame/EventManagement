import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import * as tokenStore from "../api/tokenStore.js";

const STEP = { FORM: "form", CONFIRM: "confirm", OTP: "otp" };

export default function RegisterPage() {
  const navigate = useNavigate();
  const { applyUser } = useAuth();
  const otpRef = useRef(null);

  const [step, setStep] = useState(STEP.FORM);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // Details are captured but nothing is created yet; the confirm step is where
  // the user checks their address before we email anything.
  const handleSubmitForm = (e) => {
    e.preventDefault();
    setError("");
    setStep(STEP.CONFIRM);
  };

  // Cancel: nothing was written, so just return to the form.
  const handleCancel = async () => {
    setError("");
    setNotice("");
    setCode("");
    try {
      await client.post("/api/auth/signup/cancel", { email: form.email });
    } catch {
      // Nothing pending is fine.
    }
    setStep(STEP.FORM);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.post("/api/auth/signup/request", form);
      setNotice(
        res.data.delivered
          ? `We sent a 6-digit code to ${res.data.email}.`
          : `Email is not configured, so the code was logged on the server: ${res.data.devCode}`
      );
      setStep(STEP.OTP);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not send the code");
      setStep(STEP.FORM);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await client.post("/api/auth/signup/verify", { email: form.email, code });
      // Verified accounts are signed in immediately - no separate login step.
      tokenStore.setAccessToken(res.data.accessToken);
      tokenStore.setRefreshToken(res.data.refreshToken);
      applyUser(res.data.user);
      navigate("/dashboard/profile", { replace: true });
    } catch (err) {
      const data = err.response?.data?.error;
      setError(
        data?.attemptsLeft !== undefined
          ? `${data.message} ${data.attemptsLeft} attempt(s) left.`
          : data?.message || "Verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setCode("");
    await handleConfirm();
  };

  useEffect(() => {
    if (step === STEP.OTP) otpRef.current?.focus();
  }, [step]);

  return (
    <PublicLayout>
      <div className="shell-wrap page" style={{ maxWidth: 460 }}>
        <PageHeader title="Join the platform" subtitle="Register to access events and media" />

        <Card>
          {step === STEP.FORM && (
            <form onSubmit={handleSubmitForm}>
              <Input label="Full name" id="fullName" name="fullName" placeholder="Your name"
                value={form.fullName} onChange={handleChange} required icon="👤" />
              <Input label="Email" id="email" name="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={handleChange} required icon="@" />
              <Input label="Password" id="password" name="password" type="password" placeholder="Create a password"
                value={form.password} onChange={handleChange} required minLength={6} icon="🔒"
                helper="At least 6 characters." />
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" style={{ width: "100%", marginTop: "0.5rem" }}>Register</Button>
            </form>
          )}

          {step === STEP.CONFIRM && (
            <div className="text-center">
              <div className="text-4xl mb-3" aria-hidden="true">📧</div>
              <h3 className="m-0 text-lg font-bold">Confirm your email address</h3>
              <p className="text-muted mt-2 mb-1">We will send a one-time code to:</p>
              <p className="font-bold text-base break-all m-0">{form.email}</p>
              <p className="helper-text mt-3">
                Is this correct? Your account is only created once you enter the code.
              </p>
              {error && <Alert variant="error" className="mt-4">{error}</Alert>}
              <div className="flex gap-2 mt-5">
                <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading} style={{ flex: 1 }}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Sending…" : "Confirm"}
                </Button>
              </div>
            </div>
          )}

          {step === STEP.OTP && (
            <form onSubmit={handleVerify}>
              <h3 className="mt-0 mb-1 text-lg font-bold">Enter your code</h3>
              {notice && <Alert variant="info" className="mb-4">{notice}</Alert>}
              <Input
                ref={otpRef}
                label="6-digit code"
                id="code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                inputClassName="text-center text-2xl tracking-[0.5em] font-bold"
                required
              />
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" disabled={loading || code.length !== 6} style={{ width: "100%", marginTop: "0.5rem" }}>
                {loading ? "Verifying…" : "Verify and continue"}
              </Button>
              <div className="flex justify-between items-center mt-3">
                <button type="button" className="text-sm font-semibold text-brand-600 dark:text-brand-300" onClick={handleResend} disabled={loading}>
                  Resend code
                </button>
                <button type="button" className="text-sm text-muted" onClick={handleCancel} disabled={loading}>
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {step === STEP.FORM && (
            <p className="text-muted" style={{ marginTop: "0.75rem", textAlign: "center" }}>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}

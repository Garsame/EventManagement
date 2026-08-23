import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Select from "../components/ui/Select.jsx";
import Textarea from "../components/ui/Textarea.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import * as tokenStore from "../api/tokenStore.js";

const EDUCATION_LEVELS = [
  { value: "high-school", label: "High school" },
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate" },
  { value: "other", label: "Other" },
];

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const STEPS = [
  { key: "details", label: "Your details" },
  { key: "password", label: "Password" },
  { key: "verify", label: "Verify email" },
];

// Mirrors utils/profileValidation.js on the server. Both must agree, so when
// one changes the other does too.
const MIN_AGE_YEARS = 16;
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,19}$/;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

const maxBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().slice(0, 10);
};

const EMPTY = {
  fullName: "", email: "", phone: "", location: "", institution: "",
  educationLevel: "", fieldOfStudy: "", sex: "", dateOfBirth: "", bio: "",
  password: "", confirmPassword: "",
};

/** Step 1: everything an organiser needs on file before the account exists. */
const validateDetails = (form) => {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = "Full name is required";
  else if (form.fullName.trim().length < 2) errors.fullName = "Full name is too short";

  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "That email address looks invalid";

  if (!form.phone.trim()) errors.phone = "Mobile number is required";
  else if (!PHONE_PATTERN.test(form.phone.trim())) errors.phone = "That phone number looks invalid";

  if (!form.location.trim()) errors.location = "Location is required";
  if (!form.institution.trim()) errors.institution = "Institution is required";
  if (!form.educationLevel) errors.educationLevel = "Education level is required";
  if (!form.sex) errors.sex = "Sex is required";

  if (form.dateOfBirth) {
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) errors.dateOfBirth = "That is not a valid date";
    else if (dob > new Date()) errors.dateOfBirth = "Date of birth cannot be in the future";
    else if (form.dateOfBirth > maxBirthDate()) errors.dateOfBirth = `You must be at least ${MIN_AGE_YEARS} years old`;
  }
  if (form.bio.length > 500) errors.bio = "Bio must be 500 characters or fewer";
  return errors;
};

/** Step 2: the password and its confirmation. */
const validatePassword = (form) => {
  const errors = {};
  if (!form.password) errors.password = "Password is required";
  else if (form.password.length < 6) errors.password = "Password must be at least 6 characters";

  if (!form.confirmPassword) errors.confirmPassword = "Please re-enter your password";
  else if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords do not match";
  return errors;
};

const strengthOf = (password) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 2) return { label: "Weak", tone: "text-rose-600 dark:text-rose-400", pct: 33 };
  if (score === 3) return { label: "Fair", tone: "text-amber-600 dark:text-amber-400", pct: 66 };
  return { label: "Strong", tone: "text-emerald-600 dark:text-emerald-400", pct: 100 };
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { applyUser } = useAuth();
  const { showToast } = useToast();
  const otpRef = useRef(null);
  const headingRef = useRef(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const step = STEPS[stepIndex].key;
  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user starts fixing it, rather than
    // making them submit again to find out.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    setFormError("");
  };

  useEffect(() => {
    if (step === "verify") otpRef.current?.focus();
    else headingRef.current?.focus();
  }, [step]);

  /** Applies a server-side field-error map onto the right step. */
  const applyServerErrors = (err, fallback) => {
    const data = err.response?.data?.error;
    if (data?.fields) {
      setErrors(data.fields);
      // Send the user back to the step that actually holds the bad field.
      const detailKeys = ["fullName", "email", "phone", "location", "institution",
        "educationLevel", "sex", "dateOfBirth", "bio", "fieldOfStudy"];
      if (Object.keys(data.fields).some((k) => detailKeys.includes(k))) setStepIndex(0);
      else if (Object.keys(data.fields).some((k) => k === "password")) setStepIndex(1);
    }
    setFormError(data?.message || fallback);
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    const found = validateDetails(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFormError("");
    setStepIndex(1);
  };

  /** Step 2 submit: this is what actually sends the code. */
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const found = validatePassword(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    setFormError("");
    try {
      const { confirmPassword, ...payload } = form;
      const res = await client.post("/api/auth/signup/request", {
        ...payload,
        dateOfBirth: payload.dateOfBirth || null,
      });
      setNotice(
        res.data.delivered
          ? `We sent a 6-digit code to ${res.data.email}. It expires in ${res.data.expiresInMinutes} minutes.`
          : `Email is not configured, so the code was logged on the server: ${res.data.devCode}`
      );
      setStepIndex(2);
    } catch (err) {
      applyServerErrors(err, "Could not send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      const res = await client.post("/api/auth/signup/verify", { email: form.email.trim(), code });
      // Verified accounts are signed in immediately - no separate login step.
      tokenStore.setAccessToken(res.data.accessToken);
      tokenStore.setRefreshToken(res.data.refreshToken);
      applyUser(res.data.user);
      // Raised before navigating; the provider sits above the router, so it
      // is still on screen when the dashboard renders.
      showToast(`Email confirmed. Welcome, ${res.data.user.firstName || res.data.user.fullName}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data?.error;
      setFormError(
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
    setFormError("");
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const res = await client.post("/api/auth/signup/request", {
        ...payload,
        dateOfBirth: payload.dateOfBirth || null,
      });
      setNotice(
        res.data.delivered
          ? `A new code is on its way to ${res.data.email}.`
          : `Email is not configured, so the new code was logged on the server: ${res.data.devCode}`
      );
    } catch (err) {
      applyServerErrors(err, "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  };

  /** Nothing was written until verification, so going back is always safe. */
  const handleUseDifferentEmail = async () => {
    setCode("");
    setNotice("");
    setFormError("");
    try {
      await client.post("/api/auth/signup/cancel", { email: form.email.trim() });
    } catch {
      // Nothing pending is fine.
    }
    setStepIndex(0);
  };

  return (
    <PublicLayout>
      <div className="shell-wrap page" style={{ maxWidth: 640 }}>
        <PageHeader
          title="Create your account"
          subtitle="Three quick steps and you are ready to register for events"
        />

        <Card>
          {/* Progress across the three steps */}
          <div className="stepper mb-6" role="list">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                role="listitem"
                className={`step ${i < stepIndex ? "is-done" : ""} ${i === stepIndex ? "is-current" : ""}`}
                style={{ paddingRight: i < STEPS.length - 1 ? "0.5rem" : 0 }}
              >
                <div className="step-bar" />
                <div className="step-label">
                  {i + 1}. {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ---------- Step 1: profile details ---------- */}
          {step === "details" && (
            <form onSubmit={handleDetailsSubmit} noValidate>
              <h2 ref={headingRef} tabIndex={-1} className="mt-0 mb-1 text-lg font-bold">
                Your details
              </h2>
              <p className="helper-text mb-5">
                Event organisers need these on file, so we collect them once here — you
                will not be asked again after signing in.
              </p>

              <Input
                label="Full name" id="fullName" name="fullName" placeholder="Your full name"
                value={form.fullName} onChange={handleChange} error={errors.fullName} autoComplete="name"
              />
              <Input
                label="Email" id="email" name="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={handleChange} error={errors.email} autoComplete="email"
                helper="We send a confirmation code here."
              />

              <div className="field-grid">
                <Input
                  label="Mobile number" id="phone" name="phone" type="tel" placeholder="+252 61 234 5678"
                  value={form.phone} onChange={handleChange} error={errors.phone} autoComplete="tel"
                />
                <Input
                  label="Location" id="location" name="location" placeholder="City, Country"
                  value={form.location} onChange={handleChange} error={errors.location}
                />
              </div>

              <Input
                label="Institution" id="institution" name="institution"
                placeholder="University, company or organisation"
                value={form.institution} onChange={handleChange} error={errors.institution}
              />

              <div className="field-grid">
                <Select
                  label="Highest education level" id="educationLevel" name="educationLevel"
                  value={form.educationLevel} onChange={handleChange}
                  error={errors.educationLevel} options={EDUCATION_LEVELS}
                />
                <Select
                  label="Sex" id="sex" name="sex" value={form.sex} onChange={handleChange}
                  error={errors.sex} options={SEX_OPTIONS}
                />
              </div>

              <div className="field-grid">
                <Input
                  label="Field of study" id="fieldOfStudy" name="fieldOfStudy" placeholder="Optional"
                  value={form.fieldOfStudy} onChange={handleChange} error={errors.fieldOfStudy}
                  helper="Leave blank if it does not apply to you."
                />
                <Input
                  label="Date of birth" id="dateOfBirth" name="dateOfBirth" type="date"
                  value={form.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth}
                  max={maxBirthDate()} helper={`Optional. You must be at least ${MIN_AGE_YEARS} years old.`}
                />
              </div>

              <Textarea
                label="Short bio" id="bio" name="bio" rows={3}
                placeholder="Optional — a sentence about you."
                value={form.bio} onChange={handleChange} error={errors.bio}
                maxLength={500} showCount
              />

              {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}

              <Button type="submit" style={{ width: "100%" }}>Continue to password</Button>

              <p className="text-muted" style={{ marginTop: "0.75rem", textAlign: "center" }}>
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </form>
          )}

          {/* ---------- Step 2: password ---------- */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <h2 ref={headingRef} tabIndex={-1} className="mt-0 mb-1 text-lg font-bold">
                Choose a password
              </h2>
              <p className="helper-text mb-5">
                This is what you will sign in with, together with{" "}
                <strong className="break-all">{form.email}</strong>.
              </p>

              <Input
                label="Password" id="password" name="password" type="password"
                placeholder="Create a password" value={form.password} onChange={handleChange}
                error={errors.password} autoComplete="new-password"
                helper="At least 6 characters."
              />

              {strength && !errors.password && (
                <div className="-mt-2 mb-4">
                  <div className="progress-track" style={{ height: 6 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${strength.pct}%`,
                        background: strength.pct === 100 ? "#10b981" : strength.pct === 66 ? "#f59e0b" : "#f43f5e",
                      }}
                    />
                  </div>
                  <div className={`helper-text mt-1 font-semibold ${strength.tone}`}>
                    Password strength: {strength.label}
                  </div>
                </div>
              )}

              <Input
                label="Re-enter password" id="confirmPassword" name="confirmPassword" type="password"
                placeholder="Type it once more" value={form.confirmPassword} onChange={handleChange}
                error={errors.confirmPassword} autoComplete="new-password"
              />

              {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}

              <div className="flex gap-2">
                <Button
                  type="button" variant="ghost" style={{ flex: 1 }} disabled={loading}
                  onClick={() => { setFormError(""); setStepIndex(0); }}
                >
                  Back
                </Button>
                <Button type="submit" style={{ flex: 2 }} loading={loading}>
                  {loading ? "Sending code…" : "Create account"}
                </Button>
              </div>
            </form>
          )}

          {/* ---------- Step 3: verify ---------- */}
          {step === "verify" && (
            <form onSubmit={handleVerify} noValidate>
              <h2 ref={headingRef} tabIndex={-1} className="mt-0 mb-1 text-lg font-bold">
                Confirm your email
              </h2>
              <p className="helper-text mb-4">
                Enter the 6-digit code we sent to <strong className="break-all">{form.email}</strong>.
                Your account is created only once the code is correct.
              </p>

              {notice && <Alert variant="info" className="mb-4">{notice}</Alert>}

              <Input
                ref={otpRef} label="6-digit code" id="code" name="code" value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setFormError(""); }}
                inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                inputClassName="text-center text-2xl tracking-[0.5em] font-bold"
                error={formError || undefined}
              />

              <Button type="submit" style={{ width: "100%" }} disabled={code.length !== 6} loading={loading}>
                {loading ? "Verifying…" : "Verify and finish"}
              </Button>

              <div className="flex justify-between items-center mt-3">
                <button
                  type="button" disabled={loading} onClick={handleResend}
                  className="text-sm font-semibold text-brand-600 dark:text-brand-300"
                >
                  Resend code
                </button>
                <button
                  type="button" disabled={loading} onClick={handleUseDifferentEmail}
                  className="text-sm text-muted"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}

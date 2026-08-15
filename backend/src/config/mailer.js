import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;

export const isMailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

let transporter = null;

if (isMailConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    // 587 is STARTTLS, which nodemailer upgrades to; only 465 is implicit TLS.
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
} else {
  console.warn("SMTP is not configured - one-time codes will be logged to the console instead of emailed.");
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const codeEmail = ({ heading, intro, code, note }) => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(heading)}</h1>
    <p style="color:#475569;margin:0 0 24px">${escapeHtml(intro)}</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;
                padding:20px;border-radius:14px;background:#eef2ff;color:#3730a3">
      ${escapeHtml(code)}
    </div>
    <p style="color:#64748b;font-size:13px;margin:24px 0 0">${escapeHtml(note)}</p>
    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">
      If you did not request this, you can ignore this email.
    </p>
  </div>
`;

/**
 * Sends a one-time code. With no SMTP configured the code is logged instead, so
 * the flow stays testable without credentials.
 */
export const sendOtpEmail = async ({ to, code, purpose }) => {
  const isSignup = purpose === "signup";
  const subject = isSignup ? "Confirm your email" : "Your password reset code";
  const html = codeEmail({
    heading: isSignup ? "Confirm your email address" : "Reset your password",
    intro: isSignup
      ? "Enter this code to finish creating your EventMedia account."
      : "Enter this code to set a new password for your EventMedia account.",
    code,
    note: "This code expires in 10 minutes.",
  });

  if (!transporter) {
    console.info(`[dev] OTP for ${to} (${purpose}): ${code}`);
    return { delivered: false, devCode: code };
  }

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    html,
    text: `${subject}: ${code} (expires in 10 minutes)`,
  });

  return { delivered: true };
};

/**
 * Sends a newly created staff member their sign-in details and a link to the
 * right door for their role.
 */
export const sendAccountCredentialsEmail = async ({ to, fullName, password, role, loginUrl }) => {
  const label = role === "photographer" ? "Photographer" : role === "admin" ? "Administrator" : "Attendee";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 8px">Your EventMedia ${escapeHtml(label.toLowerCase())} account</h1>
      <p style="color:#475569;margin:0 0 24px">
        Hello ${escapeHtml(fullName)}, an administrator created an account for you.
      </p>
      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:24px">
        <p style="margin:0 0 10px"><strong>Email:</strong> ${escapeHtml(to)}</p>
        <p style="margin:0"><strong>Temporary password:</strong>
          <code style="background:#eef2ff;padding:3px 8px;border-radius:6px">${escapeHtml(password)}</code>
        </p>
      </div>
      <a href="${escapeHtml(loginUrl)}"
         style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                padding:13px 26px;border-radius:12px;font-weight:700">
        Sign in to EventMedia
      </a>
      <p style="color:#64748b;font-size:13px;margin:24px 0 0">
        Or open this link: ${escapeHtml(loginUrl)}
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">
        Please change your password after signing in.
      </p>
    </div>
  `;

  if (!transporter) {
    console.info(`[dev] credentials for ${to} (${role}): ${password} -> ${loginUrl}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: `Your EventMedia ${label.toLowerCase()} account`,
    html,
    text: `Email: ${to}\nTemporary password: ${password}\nSign in: ${loginUrl}`,
  });

  return { delivered: true };
};

export default { sendOtpEmail, sendAccountCredentialsEmail, isMailConfigured };

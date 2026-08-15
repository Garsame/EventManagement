import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, MANAGEMENT_EMAIL } = process.env;

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

export const isContactNotifyConfigured = Boolean(MANAGEMENT_EMAIL);

/** Notifies the organizer inbox that a new contact message came in. */
export const sendContactNotificationEmail = async ({ name, email, subject, body }) => {
  if (!MANAGEMENT_EMAIL) return { delivered: false };

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 8px">New contact message</h1>
      <p style="color:#475569;margin:0 0 20px">
        From <strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;
      </p>
      ${subject ? `<p style="margin:0 0 12px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;white-space:pre-wrap">${escapeHtml(body)}</div>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Reply from the Messages tab in the admin dashboard.</p>
    </div>
  `;

  if (!transporter) {
    console.info(`[dev] contact message from ${email}: ${body}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to: MANAGEMENT_EMAIL,
    replyTo: email,
    subject: `[EventMedia contact] ${subject || "New message from " + name}`,
    html,
    text: `From: ${name} <${email}>\n\n${body}`,
  });

  return { delivered: true };
};

/**
 * Sends an admin's reply back to whoever originally wrote in. replyTo is set
 * to the organizer inbox, so if the guest hits "reply" in their own email
 * client it lands back in the same place the admin is working from.
 */
export const sendContactReplyEmail = async ({ to, name, originalSubject, originalBody, reply }) => {
  const subject = originalSubject ? `Re: ${originalSubject}` : "Re: your message to EventMedia";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 16px">Reply from EventMedia</h1>
      <p style="color:#475569;margin:0 0 4px">Hello ${escapeHtml(name)},</p>
      <div style="white-space:pre-wrap;margin:16px 0">${escapeHtml(reply)}</div>
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0">
        <p style="color:#94a3b8;font-size:12px;margin:0 0 8px">Your original message:</p>
        <div style="color:#64748b;font-size:13px;white-space:pre-wrap;border-left:3px solid #e2e8f0;padding-left:12px">${escapeHtml(originalBody)}</div>
      </div>
    </div>
  `;

  if (!transporter) {
    console.info(`[dev] reply to ${to}: ${reply}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    replyTo: MANAGEMENT_EMAIL || EMAIL_FROM || SMTP_USER,
    subject,
    html,
    text: `${reply}\n\n---\nYour original message:\n${originalBody}`,
  });

  return { delivered: true };
};

export default {
  sendOtpEmail,
  sendAccountCredentialsEmail,
  sendContactNotificationEmail,
  sendContactReplyEmail,
  isMailConfigured,
};

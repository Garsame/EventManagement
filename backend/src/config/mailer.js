import nodemailer from "nodemailer";
import QRCode from "qrcode";

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

const eventWhen = (event) => {
  if (!event?.startDateTime) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" })
    .format(new Date(event.startDateTime));
};

/**
 * Approval email: this is the only place a guest ever receives their codes.
 * The QR travels as an inline attachment (cid:) rather than a remote image,
 * so it renders in clients that block external content by default.
 */
export const sendRegistrationApprovedEmail = async ({
  to, fullName, event, registrationCode, qrToken, note, statusUrl,
}) => {
  const when = eventWhen(event);
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <p style="display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-size:12px;
                letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin:0 0 16px">
        Registration approved
      </p>
      <h1 style="font-size:21px;margin:0 0 8px">You're going to ${escapeHtml(event?.title || "the event")}</h1>
      <p style="color:#475569;margin:0 0 20px">
        Hello ${escapeHtml(fullName)}, your registration has been approved${when ? ` for <strong>${escapeHtml(when)}</strong>` : ""}${
          event?.location ? ` at <strong>${escapeHtml(event.location)}</strong>` : ""
        }.
      </p>
      ${note ? `<p style="color:#475569;margin:0 0 20px;padding:12px 14px;background:#f8fafc;border-radius:10px">${escapeHtml(note)}</p>` : ""}

      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#64748b;font-size:13px">Show this QR code at the door</p>
        <img src="cid:registration-qr" width="200" height="200" alt="Your check-in QR code"
             style="display:block;margin:12px auto;border-radius:12px" />
        <p style="margin:14px 0 4px;color:#64748b;font-size:13px">Or give this registration code</p>
        <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:.16em;color:#3730a3">
          ${escapeHtml(registrationCode)}
        </p>
      </div>

      ${statusUrl ? `
      <a href="${escapeHtml(statusUrl)}"
         style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                padding:13px 26px;border-radius:12px;font-weight:700">
        Sign in to see your status
      </a>
      <p style="color:#64748b;font-size:13px;margin:18px 0 0">
        You can sign in to the app any time to check your status and open this QR code again:
        ${escapeHtml(statusUrl)}
      </p>` : ""}

      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">
        This code works once. After you are checked in it cannot be used again, so please
        do not share it.
      </p>
    </div>
  `;

  const text = [
    `Your registration for ${event?.title || "the event"} has been approved.`,
    when ? `When: ${when}` : "",
    event?.location ? `Where: ${event.location}` : "",
    note ? `Note: ${note}` : "",
    `Registration code: ${registrationCode}`,
    statusUrl ? `See your status: ${statusUrl}` : "",
    "This code works once and cannot be reused after check-in.",
  ].filter(Boolean).join("\n");

  if (!transporter) {
    console.info(`[dev] approval for ${to}: code ${registrationCode}`);
    return { delivered: false };
  }

  // PNG buffer rather than a data URI: Gmail and Outlook both drop data: URIs
  // in <img>, but render a cid: attachment inline.
  const qrPng = await QRCode.toBuffer(qrToken, { width: 400, margin: 1 });

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: `Approved: ${event?.title || "your event registration"}`,
    html,
    text,
    attachments: [{ filename: "registration-qr.png", content: qrPng, cid: "registration-qr" }],
  });

  return { delivered: true };
};

/**
 * Rejection email. Deliberately says the account stays open and other events
 * are still available, because that is true - a rejection applies to this one
 * event only and nothing about the guest's profile is removed.
 */
export const sendRegistrationRejectedEmail = async ({ to, fullName, event, note, eventsUrl }) => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:21px;margin:0 0 8px">About your registration</h1>
      <p style="color:#475569;margin:0 0 18px">
        Hello ${escapeHtml(fullName)}, thank you for your interest in
        <strong>${escapeHtml(event?.title || "our event")}</strong>. Unfortunately we are not able
        to confirm your place this time.
      </p>
      ${note ? `<p style="color:#475569;margin:0 0 18px;padding:12px 14px;background:#f8fafc;border-radius:10px">${escapeHtml(note)}</p>` : ""}
      <p style="color:#475569;margin:0 0 20px">
        This applies to this event only. <strong>Your account and details are unchanged</strong> —
        you can sign in as usual and register for any other event.
      </p>
      ${eventsUrl ? `
      <a href="${escapeHtml(eventsUrl)}"
         style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                padding:13px 26px;border-radius:12px;font-weight:700">
        Browse other events
      </a>` : ""}
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">
        We hope to see you at a future event.
      </p>
    </div>
  `;

  const text = [
    `We are not able to confirm your place at ${event?.title || "our event"} this time.`,
    note ? `Note: ${note}` : "",
    "This applies to this event only - your account and details are unchanged, and you can register for other events.",
    eventsUrl ? `Browse other events: ${eventsUrl}` : "",
  ].filter(Boolean).join("\n");

  if (!transporter) {
    console.info(`[dev] rejection for ${to} (${event?.title})`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: `Update on your registration for ${event?.title || "our event"}`,
    html,
    text,
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
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendContactNotificationEmail,
  sendContactReplyEmail,
  isMailConfigured,
};

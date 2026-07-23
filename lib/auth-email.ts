export type AuthEmailEnvironment = {
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_EMAIL_REPLY_TO?: string;
};

export type AuthEmailKind = "verify-email" | "reset-password";

type AuthEmailInput = {
  kind: AuthEmailKind;
  to: string;
  name: string;
  url: string;
};

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function emailDeliveryConfigured(runtimeEnv: AuthEmailEnvironment) {
  return Boolean(runtimeEnv.RESEND_API_KEY?.trim() && runtimeEnv.AUTH_EMAIL_FROM?.trim());
}

export function buildAuthEmail(input: AuthEmailInput): EmailTemplate {
  const isVerification = input.kind === "verify-email";
  const subject = isVerification
    ? "Verify your Under the Lights email"
    : "Reset your Under the Lights password";
  const heading = isVerification ? "Confirm your place under the lights." : "Choose a new password.";
  const action = isVerification ? "Verify my email" : "Reset my password";
  const explanation = isVerification
    ? "Verify this address to activate email sign-in and keep every prediction, point and badge attached to you."
    : "We received a request to reset the password for your Under the Lights account.";
  const expiry = "This secure link expires in 60 minutes.";
  const ignored = isVerification
    ? "If you did not create this account, you can safely ignore this email."
    : "If you did not request a password reset, your current password remains unchanged.";
  const safeName = escapeHtml(input.name || "Player");
  const safeUrl = escapeHtml(input.url);

  return {
    subject,
    text: [
      `Hello ${input.name || "Player"},`,
      "",
      heading,
      explanation,
      "",
      input.url,
      "",
      expiry,
      ignored,
      "",
      "Soccerverse Under the Lights",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#090b0b;color:#f2f0e8;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090b0b;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #303431;border-radius:16px;background:#131616;overflow:hidden">
          <tr><td style="padding:34px 36px 24px;border-bottom:1px solid #303431">
            <div style="color:#e6bd5a;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Soccerverse</div>
            <div style="margin-top:8px;font-size:25px;font-weight:900;letter-spacing:-1px;text-transform:uppercase">Under the Lights</div>
          </td></tr>
          <tr><td style="padding:38px 36px">
            <div style="color:#9da19d;font-size:14px">Hello ${safeName},</div>
            <h1 style="margin:18px 0 14px;font-size:34px;line-height:1.05;letter-spacing:-1.5px">${heading}</h1>
            <p style="margin:0 0 28px;color:#b9bcb7;font-size:16px;line-height:1.6">${explanation}</p>
            <a href="${safeUrl}" style="display:inline-block;padding:15px 22px;border-radius:9px;background:#e6bd5a;color:#101111;font-size:14px;font-weight:900;text-decoration:none">${action}</a>
            <p style="margin:28px 0 0;color:#858a85;font-size:13px;line-height:1.55">${expiry}<br>${ignored}</p>
          </td></tr>
          <tr><td style="padding:20px 36px;border-top:1px solid #303431;color:#696e69;font-size:11px">
            One world. One match. Every week.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function sendAuthEmail(
  runtimeEnv: AuthEmailEnvironment,
  input: AuthEmailInput,
  fetcher: typeof fetch = fetch,
) {
  if (!emailDeliveryConfigured(runtimeEnv)) {
    throw new Error("Transactional email is not configured");
  }

  const template = buildAuthEmail(input);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: runtimeEnv.AUTH_EMAIL_FROM,
      to: [input.to],
      reply_to: runtimeEnv.AUTH_EMAIL_REPLY_TO || undefined,
      subject: template.subject,
      html: template.html,
      text: template.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the authentication email (${response.status}): ${detail.slice(0, 300)}`);
  }
}

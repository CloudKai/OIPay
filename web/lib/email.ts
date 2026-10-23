import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character] ?? character
  );
}

function emailLayout(input: {
  preview: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f7;font-family:Arial,sans-serif;color:#122427">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preview)}</div>
    <main style="max-width:560px;margin:32px auto;padding:32px;border:1px solid #dce6e5;border-radius:20px;background:#ffffff">
      <p style="margin:0 0 24px;color:#087b75;font-size:14px;font-weight:700">O<span style="font-family:Courier New,monospace">I</span>Pay</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(input.heading)}</h1>
      <p style="margin:0 0 24px;color:#526467;font-size:16px;line-height:1.6">${escapeHtml(input.body)}</p>
      <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#087b75;color:#ffffff;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a>
      <p style="margin:28px 0 0;color:#7b898b;font-size:12px;line-height:1.5">If you did not request this, you can safely ignore this email.</p>
    </main>
  </body>
</html>`;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  preview: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  idempotencyKey?: string;
}): Promise<"SENT" | "DISABLED"> {
  if (process.env.EMAIL_DELIVERY_MODE === "disabled") return "DISABLED";
  const resend = getResend();
  if (!resend) {
    throw new Error(
      "Email delivery is not configured. Add RESEND_API_KEY or explicitly disable delivery for local smoke tests."
    );
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "OIPay <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: emailLayout(input)
  }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);

  if (error) {
    throw new Error(`Email delivery failed: ${error.message}`);
  }
  return "SENT";
}

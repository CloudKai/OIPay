import { afterEach, beforeEach, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

const email = {
  to: "person@example.com", subject: "Join", preview: "Join", heading: "Join",
  body: "Invitation", actionLabel: "Accept", actionUrl: "https://example.com/invite/token",
  idempotencyKey: "invitation-attempt"
};

beforeEach(() => {
  vi.resetModules();
  send.mockReset();
  vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
});
afterEach(() => vi.unstubAllEnvs());

it("passes the retry key as a Resend API option", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  send.mockResolvedValue({ error: null });
  const { sendTransactionalEmail } = await import("./email");
  await expect(sendTransactionalEmail(email)).resolves.toBe("SENT");
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: email.to }), { idempotencyKey: email.idempotencyKey });
  expect(send.mock.calls[0]?.[0]).not.toHaveProperty("headers");
});

it("reports disabled delivery without pretending an email was sent", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("EMAIL_DELIVERY_MODE", "disabled");
  const { sendTransactionalEmail } = await import("./email");
  await expect(sendTransactionalEmail(email)).resolves.toBe("DISABLED");
  expect(send).not.toHaveBeenCalled();
});

it("propagates provider failure for invitation recovery", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  send.mockResolvedValue({ error: { message: "Unavailable" } });
  const { sendTransactionalEmail } = await import("./email");
  await expect(sendTransactionalEmail(email)).rejects.toThrow("Email delivery failed");
});

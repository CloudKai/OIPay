export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const emailVerificationRequired =
  process.env.NODE_ENV === "production" ||
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";

export const emailDeliveryEnabled =
  process.env.EMAIL_DELIVERY_MODE !== "disabled" &&
  Boolean(process.env.RESEND_API_KEY);

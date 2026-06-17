import { createHmac, timingSafeEqual } from "node:crypto";

export function isTypeformWebhookConfigured(): boolean {
  return Boolean(process.env.TYPEFORM_WEBHOOK_SECRET);
}

export function verifyTypeformSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("base64")}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

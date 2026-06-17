import jwt from "jsonwebtoken";

export type IntercomJwtPayload = {
  user_id: string;
  email?: string;
  name?: string;
  created_at?: number;
};

/**
 * Server-only JWT for Intercom Secure Messenger.
 * Returns undefined when INTERCOM_API_SECRET is unset (dev graceful no-op).
 */
export function createIntercomUserJwt(payload: IntercomJwtPayload): string | undefined {
  const secret = process.env.INTERCOM_API_SECRET;
  if (!secret) return undefined;

  return jwt.sign(
    {
      user_id: payload.user_id,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.created_at ? { created_at: payload.created_at } : {})
    },
    secret,
    { expiresIn: "1h" }
  );
}

export function isIntercomSecureMessengerEnabled(): boolean {
  return Boolean(process.env.INTERCOM_API_SECRET);
}

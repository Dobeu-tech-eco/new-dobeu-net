import { timingSafeEqual } from "node:crypto";

export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("Authorization");
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(authorization, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

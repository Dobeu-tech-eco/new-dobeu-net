import { z } from "zod";

export const otpParamsSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["invite", "magiclink", "email", "signup"]),
});

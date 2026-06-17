import { z } from "zod";

export const LeadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(["book", "form", "email", "typeform", "other"]).default("other"),
  utm: z.record(z.string()).default({}),
  referrer: z.string().optional().nullable()
});

export type LeadInput = z.infer<typeof LeadSchema>;

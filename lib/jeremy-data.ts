/**
 * lib/jeremy-data.ts
 *
 * Static manifest of Jeremy Williams' real work, sub-brands, and GTM positioning.
 * Sourced from GitHub (Dobeu-tech-eco), dobeu.net, and Composio connectors.
 * Update this file when new projects ship — it drives the hero typewriter,
 * sub-brands strip, and the "what I ship" work cards.
 */

// ---------------------------------------------------------------------------
// Availability — controls the green/amber badge across nav + hero
// ---------------------------------------------------------------------------
export const AVAILABILITY = {
  status: "open" as "open" | "limited" | "closed",
  label: "Taking projects",
  color: "green" as const,
} as const;

// ---------------------------------------------------------------------------
// Founder identity
// ---------------------------------------------------------------------------
export const FOUNDER = {
  name: "Jeremy Williams",
  handle: "@dobeutech",
  title: "Founder & Principal Engineer",
  tagline: "One operator. AI agents, full-stack apps, brand systems, and growth engineering — shipped.",
  location: "New York City",
  since: "2019",
  avatar: "/images/jeremy-williams.jpg",
  linkedin: "https://www.linkedin.com/in/jeremy-williams",
  github: "https://github.com/Dobeu-tech-eco",
  twitter: "https://x.com/dobeutech",
} as const;

// ---------------------------------------------------------------------------
// Typewriter rotation — each phrase completes "I ship ___"
// These come directly from real shipped repos + client deliverables.
// ---------------------------------------------------------------------------
export const TYPEWRITER_PHRASES = [
  "autonomous AI coding agents.",
  "full-stack SaaS from zero to live.",
  "brand systems that convert.",
  "AI-powered sales funnels.",
  "contract & quote engines.",
  "restaurant management platforms.",
  "growth engineering pipelines.",
  "custom AI gateways.",
] as const;

// ---------------------------------------------------------------------------
// Real shipped work — sourced from GitHub repos (Dobeu-tech-eco)
// ---------------------------------------------------------------------------
export const SHIPPED_WORK = [
  {
    slug: "monty-ai",
    name: "Monty AI",
    category: "AI Agent",
    description: "Autonomous full-stack developer agent built on Claude SDK — writes, tests, and ships code end-to-end.",
    stack: ["TypeScript", "Anthropic Claude", "Node.js"],
    github: "https://github.com/Dobeu-tech-eco/monty-ai-fullstackdev-coder",
    year: 2025,
  },
  {
    slug: "unified-ai",
    name: "Unified AI v1",
    category: "AI Gateway",
    description: "Multi-model AI gateway with Composio tool integrations, Postgres persistence, and streaming responses.",
    stack: ["Next.js", "Postgres", "Composio"],
    github: "https://github.com/Dobeu-tech-eco/unified-ai-v1",
    year: 2025,
  },
  {
    slug: "statminer",
    name: "StatMiner",
    category: "AI Data",
    description: "Unbiased AI data analysis engine — extracts clean signals from noisy data sets.",
    stack: ["Python", "AI SDK", "TypeScript"],
    github: "https://github.com/Dobeu-tech-eco/statminer",
    year: 2025,
  },
  {
    slug: "dts-contract",
    name: "DTS Contract Engine",
    category: "SaaS",
    description: "End-to-end quote, proposal, and contract generation engine for service businesses.",
    stack: ["Next.js", "Supabase", "Stripe"],
    github: "https://github.com/Dobeu-tech-eco/dts-contract-engine",
    year: 2024,
  },
  {
    slug: "sales-funnel",
    name: "IT Consult Funnel",
    category: "Growth Engineering",
    description: "Automated customer-sourcing and sales funnel for IT consulting — zero-touch lead generation.",
    stack: ["Next.js", "Resend", "Analytics"],
    github: "https://github.com/Dobeu-tech-eco/dobeutech-sales-funnel-itconsult",
    year: 2024,
  },
  {
    slug: "lastplate",
    name: "LastPlate",
    category: "Hospitality SaaS",
    description: "Restaurant management platform with reservations, POS integration, and AI-assisted menu management.",
    stack: ["Next.js", "Supabase", "Stripe"],
    github: "https://github.com/Dobeu-tech-eco/lastplateprod",
    year: 2024,
  },
] as const;

// ---------------------------------------------------------------------------
// Sub-brands — the Dobeu universe
// ---------------------------------------------------------------------------
export const SUB_BRANDS = [
  {
    name: "dobeu.net",
    label: "dobeu.net",
    description: "Principal engineering & AI agent studio",
    href: "https://dobeu.net",
    category: "Studio",
  },
  {
    name: "dobeu.space",
    label: "dobeu.space",
    description: "Experiments, prototypes & demos",
    href: "https://dobeu.space",
    category: "Labs",
  },
  {
    name: "dobeutech",
    label: "dobeutech",
    description: "Open-source tools & GitHub projects",
    href: "https://github.com/Dobeu-tech-eco",
    category: "Open Source",
  },
  {
    name: "dobeu.dev",
    label: "dobeu.dev",
    description: "Developer tools, docs & sandbox",
    href: "https://dobeu.dev",
    category: "Developer",
  },
] as const;

// ---------------------------------------------------------------------------
// GTM — service pillars mapped to buyer pain points
// Used in the new Services section framing
// ---------------------------------------------------------------------------
export const GTM_PILLARS = [
  {
    id: "ai-agents",
    headline: "AI Agents that replace workflows",
    pain: "You're doing manual work a model could own.",
    cta: "Automate it",
    icon: "Bot",
  },
  {
    id: "fullstack",
    headline: "Full-stack apps from idea to live",
    pain: "You have a product idea but no one to ship it fast.",
    cta: "Ship it",
    icon: "Code2",
  },
  {
    id: "brand",
    headline: "Brand systems that convert",
    pain: "Your site looks like a template, not a product.",
    cta: "Build the brand",
    icon: "Palette",
  },
  {
    id: "growth",
    headline: "Growth engineering pipelines",
    pain: "Traffic without conversion is just noise.",
    cta: "Fix the funnel",
    icon: "TrendingUp",
  },
] as const;

/** Hero capability cards — scroll to matching `#service-*` anchor in Services. */
export const HERO_CAPABILITY_CARDS = [
  {
    id: "ai-agents",
    label: "AI agents",
    description: "Autonomous workflows & tool-calling pipelines",
    icon: "Bot" as const,
  },
  {
    id: "fullstack",
    label: "Full-stack apps",
    description: "Next.js, Supabase, Vercel — production from day one",
    icon: "Code2" as const,
  },
  {
    id: "brand",
    label: "Brand systems",
    description: "Design tokens, Figma libraries, Code Connect",
    icon: "Palette" as const,
  },
  {
    id: "growth",
    label: "Growth engineering",
    description: "Attribution, lifecycle automation, paid infra",
    icon: "LineChart" as const,
  },
] as const;

/** Reveal hero → `/labs` CTA once `/labs` satisfies AE2 (Phase B). */
export const SHOW_LABS_HERO_CTA =
  process.env.NEXT_PUBLIC_SHOW_LABS_HERO_CTA !== "false";

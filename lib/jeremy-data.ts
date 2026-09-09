/**
 * lib/jeremy-data.ts
 *
 * Static manifest of Jeremy Williams' real work, sub-brands, and GTM positioning.
 * Sourced from GitHub (Dobeu-tech-eco), dobeu.net, and Composio connectors.
 * Update this file when new projects ship — it drives the hero, commercial
 * pages, case-study chassis, and structured data.
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
  tagline: "One operator. AI that keeps trucks, kitchens, and sites running.",
  location: "New York City",
  since: "2019",
  avatar: "/images/jeremy-williams.jpg",
  linkedin: "https://www.linkedin.com/in/jeremy-williams",
  github: "https://github.com/Dobeu-tech-eco",
  twitter: "https://x.com/dobeutech",
} as const;

/**
 * Published phone. Two shapes because they are consumed differently:
 * `PHONE_E164` is what schema.org/JSON-LD and `tel:` hrefs require;
 * `PHONE_DISPLAY` is what humans read in page chrome. Keep them in sync.
 */
export const PHONE_E164 = "+18483187664";
export const PHONE_DISPLAY = "(848) 318-7664";

/**
 * Single NAP / site identity. Footer, founder line, and root JSON-LD must
 * read from here. No invented street address, no invented phone number.
 */
export const SITE_IDENTITY = {
  legalName: "Dobeu Tech Solutions LLC",
  brandName: "Dobeu Tech Solutions",
  email: "jeremyw@dobeu.net",
  /** E.164 — use for `tel:` hrefs and JSON-LD. Display form: `PHONE_DISPLAY`. */
  phone: PHONE_E164 as string,
  phoneDisplay: PHONE_DISPLAY as string,
  locality: "New York",
  region: "NY",
  areaServed: "NYC & NJ metro",
  url: "https://dobeu.net",
} as const;

export const NAP = SITE_IDENTITY;

/** True only once a real number is filled in. Empty string stays unpublished. */
export function hasPublishablePhone(
  phone: string = SITE_IDENTITY.phone,
): boolean {
  return phone.trim().length > 0;
}

/** Hosts that must never appear in public chrome or JSON-LD sameAs. */
export const DEAD_HOSTS = ["dobeu.cloud", "dobeutech.com", "dobeu.dev"] as const;

export const PERSON_SAME_AS = [FOUNDER.linkedin, FOUNDER.github] as const;

/** Organization sameAs — GitHub org only; do not reuse the personal LinkedIn. */
export const ORGANIZATION_SAME_AS = [FOUNDER.github] as const;

export const PRICE_RANGE = {
  minUsd: 5000,
  maxUsd: 30000,
  display: "$5k–$30k",
  line: "$5k–$30k typical engagement",
} as const;

export const TYPEFORM_PUBLIC_FORM_ID = "wKVKIBe7";
export const TYPEFORM_LIVE_EMBED_ID = "01M18GV8E73N64HYJ21HRDZA0X";

export function resolveTypeformFormId(
  envId: string | undefined = process.env.NEXT_PUBLIC_TYPEFORM_FORM_ID,
): string {
  const trimmed = envId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : TYPEFORM_PUBLIC_FORM_ID;
}

// ---------------------------------------------------------------------------
// Hero copy — SMB Outcome (locked implement direction)
// ---------------------------------------------------------------------------
export const HERO_COPY = {
  greeting: "Hi. I'm Jeremy.",
  outcome: "AI that keeps your trucks, kitchens, and sites running.",
  diagnostic:
    "If ops still live in spreadsheets, you don't have an AI problem. You have a process problem.",
  estimateCta: "Get a price estimate",
  bookCta: "Book a call",
} as const;

/** Typewriter rotation — vertical outcomes, not stack slogans. */
export const TYPEWRITER_PHRASES = [
  "dispatch that actually dispatches.",
  "compliance paperwork that files itself.",
  "inventory that stays reconciled.",
  "invoices that go out on time.",
] as const;

// ---------------------------------------------------------------------------
// Real shipped work — sourced from GitHub repos (Dobeu-tech-eco)
// Metric headlines render only when approved === true.
// ---------------------------------------------------------------------------
export type ShippedMetric = {
  label: string;
  value: string;
  approved: boolean;
};

export const SHIPPED_WORK = [
  {
    slug: "monty-ai",
    name: "Monty AI",
    category: "AI Agent",
    vertical: "Software delivery",
    description:
      "Autonomous full-stack developer agent built on Claude SDK — writes, tests, and ships code end-to-end.",
    stack: ["TypeScript", "Anthropic Claude", "Node.js"],
    github: "https://github.com/Dobeu-tech-eco/monty-ai-fullstackdev-coder",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "unified-ai",
    name: "Unified AI v1",
    category: "AI Gateway",
    vertical: "AI infrastructure",
    description:
      "Multi-model AI gateway with Composio tool integrations, Postgres persistence, and streaming responses.",
    stack: ["Next.js", "Postgres", "Composio"],
    github: "https://github.com/Dobeu-tech-eco/unified-ai-v1",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "statminer",
    name: "StatMiner",
    category: "AI Data",
    vertical: "Analytics",
    description:
      "Unbiased AI data analysis engine — extracts clean signals from noisy data sets.",
    stack: ["Python", "AI SDK", "TypeScript"],
    github: "https://github.com/Dobeu-tech-eco/statminer",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "dts-contract",
    name: "DTS Contract Engine",
    category: "SaaS",
    vertical: "Service businesses",
    description:
      "End-to-end quote, proposal, and contract generation engine for service businesses.",
    stack: ["Next.js", "Supabase", "Stripe"],
    github: "https://github.com/Dobeu-tech-eco/dts-contract-engine",
    year: 2024,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "sales-funnel",
    name: "IT Consult Funnel",
    category: "Growth Engineering",
    vertical: "Lead generation",
    description:
      "Automated customer-sourcing and sales funnel for IT consulting — zero-touch lead generation.",
    stack: ["Next.js", "Resend", "Analytics"],
    github: "https://github.com/Dobeu-tech-eco/dobeutech-sales-funnel-itconsult",
    year: 2024,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "lastplate",
    name: "LastPlate",
    category: "Hospitality SaaS",
    vertical: "Food service",
    description:
      "Restaurant management platform with reservations, POS integration, and AI-assisted menu management.",
    stack: ["Next.js", "Supabase", "Stripe"],
    github: "https://github.com/Dobeu-tech-eco/lastplateprod",
    year: 2024,
    metrics: [] as readonly ShippedMetric[],
  },
] as const;

/**
 * Case-study entry. `anonymizedContext` describes a client by shape rather
 * than by name ("a 40-truck logistics operator") for work covered by an NDA
 * or a handshake. Optional and unpopulated — only ever fill it from a real
 * engagement, never from a plausible-sounding one.
 */
export type ShippedWork = (typeof SHIPPED_WORK)[number] & {
  readonly anonymizedContext?: string;
};

export const HAS_ATTRIBUTABLE_CASE_STUDIES = SHIPPED_WORK.length > 0;

export function getShippedWork(slug: string): ShippedWork | undefined {
  return SHIPPED_WORK.find((item) => item.slug === slug);
}

export function approvedMetrics(item: ShippedWork): readonly ShippedMetric[] {
  return item.metrics.filter((metric) => metric.approved);
}

// ---------------------------------------------------------------------------
// Sub-brands — live properties only
// ---------------------------------------------------------------------------
export const SUB_BRANDS = [
  {
    name: "dobeu.net",
    label: "dobeu.net",
    description: "Principal engineering & AI studio",
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
] as const;

export const PRIMARY_NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/process", label: "Process" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const FOOTER_SITE_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Case studies", href: "/case-studies" },
  { label: "FAQ", href: "/#faq" },
  { label: "Labs", href: "/labs" },
  { label: "Repos", href: "/repos" },
] as const;

// ---------------------------------------------------------------------------
// GTM — service pillars mapped to buyer pain points
// ---------------------------------------------------------------------------
export const GTM_PILLARS = [
  {
    id: "ai-agents",
    slug: "ai-agents",
    headline: "AI agents that replace workflows",
    pain: "Dispatch, paperwork, and follow-ups still live in inboxes.",
    description:
      "Claude + Composio + MCP integrations. Workflows that take work off your plate — from triage to fulfillment.",
    detail: "Autonomous pipelines, tool-calling agents, LLM-powered ops.",
    cta: "Automate it",
    icon: "Bot" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "fullstack",
    slug: "fullstack",
    headline: "Full-stack apps from idea to live",
    pain: "The ops tool you need does not exist yet — and a template will not cut it.",
    description:
      "Next.js, Supabase, Vercel. MVPs, internal tools, client portals. Production-grade from day one.",
    detail: "App Router, auth, billing, CI/CD — the complete stack.",
    cta: "Ship it",
    icon: "Code2" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "brand",
    slug: "brand",
    headline: "Brand systems that convert",
    pain: "Your site looks like a template, not a product operators trust.",
    description:
      "Figma libraries with Code Connect. Design tokens that round-trip through Tailwind, Framer, and Webflow.",
    detail: "Tokens, typography, component libraries that scale.",
    cta: "Build the brand",
    icon: "Palette" as const,
    tag: "Design",
  },
  {
    id: "growth",
    slug: "growth",
    headline: "Growth engineering pipelines",
    pain: "Traffic without conversion is just noise.",
    description:
      "Programmatic SEO, GA4/PostHog/Mixpanel attribution, lifecycle automation, paid-ads infra.",
    detail: "Turn traffic into pipeline — measurably.",
    cta: "Fix the funnel",
    icon: "LineChart" as const,
    tag: undefined as string | undefined,
  },
] as const;

export type GtmPillar = (typeof GTM_PILLARS)[number];

export function getServicePillar(slug: string): GtmPillar | undefined {
  return GTM_PILLARS.find((pillar) => pillar.slug === slug || pillar.id === slug);
}

/** Hero capability cards — pain language, not stack labels. */
export const HERO_CAPABILITY_CARDS = GTM_PILLARS.map((pillar) => ({
  id: pillar.id,
  label: pillar.headline.replace(/ that .+$/i, "").replace(/ pipelines$/i, ""),
  description: pillar.pain,
  icon: pillar.icon,
}));

export const MARKETING_SERVICES = GTM_PILLARS.map((pillar, index) => ({
  id: pillar.id,
  num: String(index + 1).padStart(2, "0"),
  icon: pillar.icon,
  title: pillar.headline,
  description: pillar.description,
  detail: pillar.detail,
  tag: pillar.tag,
}));

export const PROCESS_STEPS = [
  {
    num: "01",
    icon: "CalendarCheck" as const,
    label: "30-min discovery",
    body: "We talk through what you're trying to ship, what's in the way, and whether I'm the right person. No pitch, no slide deck — just an honest conversation.",
  },
  {
    num: "02",
    icon: "FileText" as const,
    label: "Scoped proposal",
    body: "Within 48 hours you get a one-pager: scope, milestones, price, timeline, what I need from you. Approve, decline, or refine — no obligation to that point.",
  },
  {
    num: "03",
    icon: "Rocket" as const,
    label: "Ship in 2–6 weeks",
    body: "Daily Loom updates, your private portal for files and invoices, async-first communication. Most projects ship in a single sprint with zero theater.",
  },
] as const;

export const MARKETING_FAQS = [
  {
    q: "What's the typical engagement size?",
    a: "Most projects land between $5k and $30k. Smaller scoped sprints exist for tight problems; multi-month builds get quoted separately. You get a fixed-scope, fixed-price proposal after the discovery call so you know the number before committing.",
  },
  {
    q: "Does the Ops Teardown fee count toward the build?",
    a: "Yes. Hire me for a custom build within 60 days of delivery and the full $1,500 comes straight off your first invoice: a $15k build invoices at $13.5k. If you take the fixed-price website package instead, $500 comes off it — that package is already scoped and priced tight, so a full credit would eat it. After 60 days the credit expires, because by then the scope I mapped has moved. And if you don't hire me at all, you keep the document and owe nothing else.",
  },
  {
    q: "What's the difference between Book a call and Get a price estimate?",
    a: "Book a call is a 30-minute discovery conversation. Get a price estimate opens a short Typeform so I can review scope, budget band, and fit before we talk — it is not an instant quote or checkout.",
  },
  {
    q: "How fast can you start?",
    a: "Usually within a week of the discovery call. If I'm fully booked I'll say so on the call and recommend someone good — never string you along.",
  },
  {
    q: "Do you do retainers?",
    a: "Occasionally — for ongoing automation work, agent maintenance, or growth engineering. The discovery call is the right place to scope this.",
  },
  {
    q: "Where will the code live?",
    a: "Your GitHub org by default. I work in feature branches with PR review, and you get full admin access on day one. No code held hostage.",
  },
  {
    q: "Do you sign NDAs?",
    a: "Yes — mutual NDA before the proposal step if you need it. Send yours or use mine.",
  },
  {
    q: "Do you take equity?",
    a: "Rarely, and only with a meaningful cash component alongside. Most engagements are cash.",
  },
  {
    q: "Will I be able to maintain what you build?",
    a: "That's the goal. Every deliverable comes with documentation, a Loom walkthrough, and a 2-week support window after handoff. Modern stack means your future hires already know it.",
  },
  {
    q: 'Why "dobeu"?',
    a: 'Two readings at once. Say it out loud — it\'s my last initial W, spelled phonetically ("dub-el-u"). It\'s also "Do Be You": we handle the technical backend so you get to focus on running your business.',
  },
] as const;

export const PRICING_TIERS = [
  {
    id: "diagnostic",
    name: "Ops Teardown",
    price: "$1,500 flat",
    duration: "5 business days",
    summary: "One week, one fixed fee, a written teardown of the loop that is actually costing you.",
    detail:
      "I sit with the people doing the work, map the loop end to end, and hand back a document: where the hours go, what to automate first, the hours and price band to build it, and what to leave alone.",
    excludes:
      "Not a build — no code ships that week. Not a retainer, and not an obligation to hire me. If you do hire me for a custom build, the full fee comes off it.",
  },
  {
    id: "workflow",
    name: "Single workflow",
    price: "Scoped sprint",
    summary: "One painful loop — dispatch, invoicing, intake — automated end to end.",
    detail: "Fixed scope after discovery. Typical for a first engagement.",
  },
  {
    id: "full-build",
    name: "Full build",
    price: PRICE_RANGE.display,
    summary: "The ops app, portal, or agent stack you will keep running.",
    detail: "Most engagements land here. Fixed-scope, fixed-price after the call.",
    featured: true,
  },
  {
    id: "retainer",
    name: "Care plan",
    price: "From $149/mo",
    summary: "Keep the system current once it is in production.",
    detail:
      "Three tiers — Watch, Tune, Extend. Business hours, real hours of work, no lock-in. Only when there is a live system to maintain.",
  },
] as const;

/**
 * Post-build care plans. Sold only once there is a live system to maintain —
 * never as an acquisition offer. Deliberately framed as an escalating bundle
 * of hours and response windows, not a managed-ops SLA: one operator cannot
 * honestly promise 24/7 coverage, so no copy here implies it.
 */
export const CARE_PLAN = {
  name: "Keep It Running",
  eyebrow: "After launch",
  intro:
    "Once a system is live, someone has to keep it live. Month to month, cancel any time, and only sold when there is something of mine in production to look after.",
  honesty:
    "I'm one person, not a 24/7 NOC. Every response window below is business hours, Monday to Friday. If you need overnight coverage, say so on the call and I'll tell you to hire someone else.",
} as const;

export const CARE_PLAN_TIERS = [
  {
    id: "watch",
    name: "Watch",
    price: "$149/mo",
    summary: "Keep the lights on. Updates, monitoring, and someone who picks up when it breaks.",
    includes: [
      "Dependency and security updates",
      "Uptime and error monitoring on what I built",
      "Next business day response when something breaks",
      "A one-paragraph health note each month",
    ],
  },
  {
    id: "tune",
    name: "Tune",
    price: "$219/mo",
    summary: "Watch, plus two hours a month for the small changes that keep piling up.",
    includes: [
      "Everything in Watch",
      "2 hours/month of changes — copy, fields, reports, integrations",
      "Same business day response when something breaks",
      "Unused hours roll over one month, then expire",
    ],
  },
  {
    id: "extend",
    name: "Extend",
    price: "$299/mo",
    summary: "Enough hours to keep shipping improvements instead of just holding the line.",
    includes: [
      "Everything in Tune",
      "4 hours/month of changes",
      "A 30-minute review each quarter of what to automate next",
      "Your work scheduled ahead of new-client work",
    ],
  },
] as const;

export type CarePlanTier = (typeof CARE_PLAN_TIERS)[number];

/**
 * Why this site has no testimonials. Every signal named here is one a visitor
 * can check without taking my word for it — which is the whole point.
 */
export const TRUST_POSITION = {
  heading: "No testimonials. Check the work instead.",
  body: "There are no client logos or five-star quotes on this site, because I won't publish proof I can't back. What I can point at is checkable: the code is public on GitHub, the price bands are published on the pricing page instead of quoted case by case, and every invoice runs through Stripe. Verify any of it before you send me a dollar.",
} as const;

export const FOUNDER_STATS = [
  { value: "2019", label: "Building since" },
  { value: "NYC", label: SITE_IDENTITY.areaServed },
  { value: "4", label: "Service pillars" },
] as const;

export const FOUNDER_REASONS = [
  {
    headline: "You talk to the person doing the work.",
    body: "No account managers between you and the build.",
  },
  {
    headline: "Decisions get made in hours, not weeks.",
    body: "No agency layers, no rebrand committees.",
  },
  {
    headline: "Modern stack from day one.",
    body: "Nothing you'll have to rewrite in 18 months.",
  },
] as const;

/**
 * Per-URL sitemap lastModified. Use these content dates — never `new Date()`
 * at build time — so legal and money pages do not share a build stamp.
 */
export const CONTENT_DATES = {
  home: "2026-08-30",
  services: "2026-08-30",
  pricing: "2026-08-30",
  about: "2026-08-30",
  process: "2026-08-30",
  caseStudies: "2026-08-30",
  labs: "2026-08-29",
  repos: "2026-08-01",
  login: "2026-05-21",
  privacy: "2026-06-20",
  terms: "2026-06-20",
  cookies: "2026-06-20",
  optinSms: "2026-05-21",
  marketingOptOut: "2026-05-21",
} as const;

/** Reveal hero → `/labs` CTA only when explicitly enabled. */
export const SHOW_LABS_HERO_CTA =
  process.env.NEXT_PUBLIC_SHOW_LABS_HERO_CTA === "true";

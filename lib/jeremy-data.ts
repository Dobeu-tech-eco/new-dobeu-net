/**
 * lib/jeremy-data.ts
 *
 * Static manifest of Jeremy Williams' real work and public-site positioning.
 * Update this file when the offer changes — it drives the hero, commercial
 * pages, case-study chassis, and structured data.
 */

// ---------------------------------------------------------------------------
// Availability — controls the green/amber badge across nav + hero
// ---------------------------------------------------------------------------
export const AVAILABILITY = {
  status: "open" as "open" | "limited" | "closed",
  label: "Taking fleet work",
  color: "green" as const,
} as const;

// ---------------------------------------------------------------------------
// Founder identity
// ---------------------------------------------------------------------------
export const FOUNDER = {
  name: "Jeremy Williams",
  handle: "@dobeutech",
  title: "Founder & Principal Engineer",
  tagline: "One operator. Not a ticket mill.",
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
// Hero copy — fleet partnership
// ---------------------------------------------------------------------------
export const HERO_COPY = {
  greeting: "Hi. I'm Jeremy.",
  outcome: "Partnership on the fleet job.",
  diagnostic: "This is not a form-filling dev shop.",
  estimateCta: "Send the job",
  estimateHint: "Tell me the job. I reply if I can take it — not an instant quote.",
  bookCta: "Book a call",
  promise:
    "I sit with the people who run the trucks. A product only if that work earns it.",
  proof: "The ranges are published. Invoices go through Stripe. The code lands in your repo.",
} as const;

/** Shared clause for the lead-form success toast and the submitted state. */
export const LEAD_REPLY_SLA = "reply about the job within 24 hours";

/** Exported for tests. The hero shows HERO_COPY.promise and no longer rotates these. */
export const TYPEWRITER_PHRASES = [
  "the yard, with the people on the shift.",
  "dispatch the crew already trusts.",
  "a system that fits this fleet.",
  "a product only if the work earns it.",
] as const;

/**
 * RouteReady tease. Name only — no URL, no domain, no "visit" link.
 * It is not generally launched from this site.
 */
export const PIPELINE = {
  eyebrow: "What's in the pipeline",
  name: "RouteReady",
  lede:
    "Fleet owners I already knew, and had already worked with, asked for a way to run the job. I spent countless hours inside small fleets — yards, dispatch, the people on the shift — and solved it with them.",
  body:
    "RouteReady is that partnership turning into a product. It is not generally launched here. This page is not a signup, and there is no site to visit.",
  aside:
    "If you wanted a ticket number and a five-page brochure, there is a whole industry for that. This is the other thing.",
} as const;

// ---------------------------------------------------------------------------
// Real shipped work — older public repos. Not the commercial offer.
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
    name: "Monty",
    category: "Past experiment",
    vertical: "Not offered",
    description:
      "An old internal experiment. Not a service, and not the fleet work I take.",
    stack: ["TypeScript", "Node.js"],
    github: "https://github.com/Dobeu-tech-eco/monty-ai-fullstackdev-coder",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "unified-ai",
    name: "Unified v1",
    category: "Past experiment",
    vertical: "Not offered",
    description:
      "An old internal experiment. Not offered from this site.",
    stack: ["Next.js", "Postgres"],
    github: "https://github.com/Dobeu-tech-eco/unified-ai-v1",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "statminer",
    name: "StatMiner",
    category: "Past experiment",
    vertical: "Not offered",
    description:
      "A data-cleanup experiment. Not a service I sell.",
    stack: ["Python", "TypeScript"],
    github: "https://github.com/Dobeu-tech-eco/statminer",
    year: 2025,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "dts-contract",
    name: "DTS Contract Engine",
    category: "Operations",
    vertical: "Service businesses",
    description:
      "Quote, proposal, and contract paperwork for service businesses.",
    stack: ["Next.js", "Supabase", "Stripe"],
    github: "https://github.com/Dobeu-tech-eco/dts-contract-engine",
    year: 2024,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "sales-funnel",
    name: "IT Consult Funnel",
    category: "Past experiment",
    vertical: "Not offered",
    description:
      "An old experiment for finding leads. Not the offer.",
    stack: ["Next.js", "Resend"],
    github: "https://github.com/Dobeu-tech-eco/dobeutech-sales-funnel-itconsult",
    year: 2024,
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "lastplate",
    name: "LastPlate",
    category: "Hospitality",
    vertical: "Food service",
    description:
      "Restaurant floor software — reservations and the service. Not the fleet work, and not a template I resell.",
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
    description: "Fleet partnerships, not a ticket mill",
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
  { label: "Pipeline", href: "/#pipeline" },
  { label: "Process", href: "/process" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Case studies", href: "/case-studies" },
  { label: "FAQ", href: "/#faq" },
  { label: "Labs", href: "/labs" },
  { label: "Repos", href: "/repos" },
] as const;

// ---------------------------------------------------------------------------
// GTM — partnership on the fleet job, not a service menu of products
// ---------------------------------------------------------------------------
export const GTM_PILLARS = [
  {
    id: "on-the-shift",
    slug: "on-the-shift",
    buyerTitle: "On the shift",
    headline: "I sit with the people who run the trucks",
    pain: "The board, the yard, and the exceptions are not a form. If nobody has stood there, the software will miss the job.",
    description:
      "Partnership starts with the owners and the crew already doing the work. I learn the job before I propose a build.",
    detail: "Yards, dispatch, and the people on the shift.",
    cta: "Start with the job",
    icon: "Truck" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "the-job",
    slug: "the-job",
    buyerTitle: "The actual job",
    headline: "Tailored to this fleet, not a template",
    pain: "A rented portal and a brochure site do not dispatch trucks.",
    description:
      "The system is built around how this operation already runs. It lives in your repo. It is larger work than a webpage.",
    detail: "Routes, exceptions, and the paperwork the shift actually touches.",
    cta: "Talk about the job",
    icon: "ClipboardList" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "one-person",
    slug: "one-person",
    buyerTitle: "One person, not a queue",
    headline: "You talk to the person doing the work",
    pain: "A faceless ticket mill will hand you a number and a status update. That is not this.",
    description:
      "No account bench, and no form that prices the job for you. If I take it, I stay on it.",
    detail: "A small number of fleets at a time.",
    cta: "Talk to me",
    icon: "Handshake" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "earned-product",
    slug: "earned-product",
    buyerTitle: "A product, if it earns it",
    headline: "A product only after the partnership earns it",
    pain: "I don't show up with a product looking for a problem.",
    description:
      "Sometimes the work is specific enough, and repeated enough, that it becomes its own product. That happens after the job is solved with you.",
    detail: "Not launched from this page. Named in the pipeline so the claim has a receipt.",
    cta: "See the pipeline",
    icon: "Package" as const,
    tag: undefined as string | undefined,
  },
] as const;

export type GtmPillar = (typeof GTM_PILLARS)[number];

export function getServicePillar(slug: string): GtmPillar | undefined {
  return GTM_PILLARS.find((pillar) => pillar.slug === slug || pillar.id === slug);
}

/** Hero capability cards — buyer titles and pains, not stripped headlines. */
export const HERO_CAPABILITY_CARDS = GTM_PILLARS.map((pillar) => ({
  id: pillar.id,
  label: pillar.buyerTitle,
  description: pillar.pain,
  icon: pillar.icon,
}));

export const MARKETING_SERVICES = GTM_PILLARS.map((pillar, index) => ({
  id: pillar.id,
  num: String(index + 1).padStart(2, "0"),
  icon: pillar.icon,
  title: pillar.buyerTitle,
  description: pillar.description,
  detail: pillar.detail,
  tag: pillar.tag,
}));

export const PROCESS_STEPS = [
  {
    num: "01",
    icon: "CalendarCheck" as const,
    label: "Talk through the job",
    body: "Thirty minutes on the fleet, the yard, and what's stuck. No pitch deck. If I'm the wrong person, I'll say so.",
  },
  {
    num: "02",
    icon: "FileText" as const,
    label: "A written scope",
    body: "You get a one-pager: the job, what I will not take on, a number, and what I need from you. Approve, decline, or change it.",
  },
  {
    num: "03",
    icon: "Rocket" as const,
    label: "Do the work together",
    body: "I stay on the job with the people who run it. A product is a later conversation, and only if the work earns it.",
  },
] as const;

export const MARKETING_FAQS = [
  {
    q: "What's the typical engagement size?",
    a: "Most tailored fleet work lands between $5k and $30k, once the job is clear. A week with the fleet is $1,500 and comes off the build if we continue. I don't sell a brochure site.",
  },
  {
    q: "Does the week with the fleet count toward the work?",
    a: "Yes. Continue into the build within 60 days and the full $1,500 comes off the first invoice. After 60 days the credit expires, because the job I wrote down has moved. If you don't continue, you keep the document and owe nothing else.",
  },
  {
    q: "What's the difference between Book a call and Send the job?",
    a: "Book a call is a 30-minute conversation about the job. Send the job is a short note so I can read the work and reply about whether I can take it. It does not quote you instantly and it does not start a checkout.",
  },
  {
    q: "How fast can you start?",
    a: "Usually within a week of the call, if the job is a fit. If I'm fully booked I'll say so and recommend someone good — never string you along.",
  },
  {
    q: "Do you do retainers?",
    a: "Sometimes, once a system is live and someone has to keep it current. That is care for work already in production, not a queue of tickets. The call is where we see if it fits.",
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
    a: "That's the goal. You get the repo, a walkthrough, and two weeks after handoff to ask the questions that come up.",
  },
  {
    q: 'Why "dobeu"?',
    a: 'Two readings at once. Say it out loud — it\'s my last initial W, spelled phonetically ("dub-el-u"). It\'s also "Do Be You": I handle the technical work so you can run the operation.',
  },
] as const;

export const PRICING_TIERS = [
  {
    id: "diagnostic",
    name: "A week with the fleet",
    price: "$1,500 flat",
    duration: "5 business days",
    summary: "Five days with the people doing the work, and a written account of the job.",
    detail:
      "Where the hours go, what the shift actually needs, what to build, and what to leave alone. You keep the document either way.",
    excludes:
      "Not a build that week, and not a brochure site. Not an obligation to continue. If we do continue, the fee comes off the work.",
  },
  {
    id: "partnership",
    name: "The partnership",
    price: "Scoped to the job",
    summary: "Tailored work for one small fleet, priced after the job is clear.",
    detail:
      "Send the job or book a call. I reply about whether I can take it. The number follows the work, not a menu.",
  },
  {
    id: "full-build",
    name: "The system",
    price: PRICE_RANGE.display,
    summary: "The tool the yard will keep using.",
    detail: "Fixed scope once the job is clear. It stays in your repo. Most of this work lands here.",
    featured: true,
  },
  {
    id: "retainer",
    name: "Care plan",
    price: "From $149/mo",
    summary: "Keep a live system current after the work is in production.",
    detail:
      "Three tiers — Watch, Tune, Extend. Business hours, real hours, no lock-in. Only when there is something live to look after.",
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
    "I'm one person, not a 24/7 desk. Every response window below is business hours, Monday to Friday. If you need overnight coverage, say so on the call and I'll tell you to hire someone else.",
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
    summary: "Enough hours to keep improving the job instead of just holding the line.",
    includes: [
      "Everything in Tune",
      "4 hours/month of changes",
      "A 30-minute review each quarter of what the shift still needs",
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
  body: "There are no client logos or five-star quotes on this site, because I won't publish proof I can't back. What I can point at is checkable: the code is public on GitHub, the ranges are on the pricing page, and every invoice runs through Stripe. Verify any of it before you send me a dollar.",
} as const;

export const FOUNDER_STATS = [
  { value: "2019", label: "Building since" },
  { value: "NYC", label: SITE_IDENTITY.areaServed },
  { value: "Stripe", label: "Invoices" },
] as const;

export const FOUNDER_REASONS = [
  {
    headline: "You talk to the person doing the work.",
    body: "No ticket queue between you and the job.",
  },
  {
    headline: "The work is learned on the shift.",
    body: "Not from a form, and not from a template.",
  },
  {
    headline: "A product only if the partnership earns it.",
    body: "Otherwise you keep a system that fits this fleet.",
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

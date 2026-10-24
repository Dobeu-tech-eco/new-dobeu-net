/**
 * lib/jeremy-data.ts
 *
 * Static manifest of Jeremy Williams' public work and site positioning.
 * Update this file when new projects ship — it drives the hero, commercial
 * pages, case-study chassis, and structured data.
 */

// ---------------------------------------------------------------------------
// Availability — controls the green/amber badge across nav + hero
// ---------------------------------------------------------------------------
export const AVAILABILITY = {
  status: "open" as "open" | "limited" | "closed",
  label: "Open to collaboration",
  color: "green" as const,
} as const;

// ---------------------------------------------------------------------------
// Founder identity
// ---------------------------------------------------------------------------
export const FOUNDER = {
  name: "Jeremy Williams",
  handle: "@dobeutech",
  title: "Founder and builder",
  tagline: "We build usable business technology.",
  bio: "I’m Jeremy. I like exploring ideas, making useful things, and seeing where curiosity leads. Dobeu is the home for my passion projects and collaborations with like-minded people.",
  location: "New York City",
  avatar: "/images/jeremy-williams.jpg",
  linkedin: "https://www.linkedin.com/in/jswilliamstu",
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
export const DEAD_HOSTS = [
  "dobeu.cloud",
  "dobeutech.com",
  "dobeu.dev",
] as const;

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
// Hero copy
// ---------------------------------------------------------------------------
export const HERO_COPY = {
  greeting: "Hi. I'm Jeremy.",
  outcome: "We build usable business technology.",
  diagnostic:
    "Have an idea worth building together, or see a connection with something here?",
  estimateCta: "Explore a collaboration",
  estimateHint: "Tell me what you're working on and where our interests meet.",
  bookCta: "Meet Jeremy",
  promise:
    "Dobeu is where I build products I care about and connect with people who want to make useful technology together.",
  proof: "Explore what I'm building, then get in touch if our interests overlap.",
} as const;

/** Exported for tests. The hero shows HERO_COPY.promise and no longer rotates these. */
export const TYPEWRITER_PHRASES = [
  "dispatch that actually dispatches.",
  "compliance paperwork that files itself.",
  "inventory that stays reconciled.",
  "invoices that go out on time.",
] as const;

// ---------------------------------------------------------------------------
// Public products named by the owner. Add details only when verified.
// Metric headlines render only when approved === true.
// ---------------------------------------------------------------------------
export type ShippedMetric = {
  label: string;
  value: string;
  approved: boolean;
};

export const SHIPPED_WORK = [
  {
    slug: "routeready",
    name: "RouteReady",
    category: "Business software",
    vertical: "Driver training",
    description:
      "A beta driver-training platform for trucking companies, trainers, and trainees.",
    href: "https://routereadyhq.com",
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "chima-comics",
    name: "Chima Comics",
    category: "Online store",
    vertical: "Comics",
    description:
      "Read free chapters, play a browser puzzle, and explore Chima Comics merchandise.",
    href: "https://chimacomics.shop",
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "dobeu-space",
    name: "Dobeu.space",
    category: "Publication",
    vertical: "Supply chain technology",
    description: "A journal about supply chain technology.",
    href: "https://dobeu.space",
    metrics: [] as readonly ShippedMetric[],
  },
  {
    slug: "ikram-and-co",
    name: "Ikram & Co.",
    category: "Art storefront",
    vertical: "Art and commerce",
    description:
      "An online store for original art, limited editions, and stickers from Arab artists.",
    href: "https://www.dobeu.store/en",
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
    description: "Usable business technology",
    href: "https://dobeu.net",
    category: "Studio",
  },
  {
    name: "dobeu.space",
    label: "dobeu.space",
    description: "Supply chain technology journal",
    href: "https://dobeu.space",
    category: "Publication",
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
  { href: "/faq", label: "FAQ" },
] as const;

export const FOOTER_SITE_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Case studies", href: "/case-studies" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Labs", href: "/labs" },
  { label: "Repos", href: "/repos" },
] as const;

// ---------------------------------------------------------------------------
// GTM — service pillars mapped to buyer pain points
// ---------------------------------------------------------------------------
export const GTM_PILLARS = [
  {
    id: "business-systems",
    slug: "business-systems",
    buyerTitle: "Work that flows",
    headline: "Business systems people can use",
    pain: "Routes, tickets, and follow-ups still live in inboxes. The same problem shows up in a truck, a store, or an office.",
    description:
      "We build the system around the work: clear steps, useful screens, and reliable handoffs.",
    detail:
      "Forms, approvals, notifications, and records in one usable system.",
    cta: "Build the system",
    icon: "Code2" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "fullstack",
    slug: "fullstack",
    buyerTitle: "The tool you don't have",
    headline: "The app the crew actually opens",
    pain: "The job runs in a spreadsheet because the tool you need does not exist, and a template will not cut it.",
    description:
      "Internal tools, portals, and the one app your people will open on a shift. Built to stay in your repo.",
    detail:
      "Next.js, Supabase, and Vercel. Auth, billing, and a path to production.",
    cta: "Ship it",
    icon: "Code2" as const,
    tag: undefined as string | undefined,
  },
  {
    id: "brand",
    slug: "brand",
    buyerTitle: "A front door people trust",
    headline: "A site that looks like the operation",
    pain: "The site looks rented. Operators and their customers can tell.",
    description:
      "The public site and the documents match the work, whether that work is trucks, kitchens, or a desk.",
    detail:
      "Design tokens, type, and a component library. Figma when you want the source.",
    cta: "Build the brand",
    icon: "Palette" as const,
    tag: "Design",
  },
  {
    id: "growth",
    slug: "growth",
    buyerTitle: "Invoices that go out",
    headline: "Billing and the numbers that matter",
    pain: "Work gets done and the invoice, the follow-up, or the margin is still a guess.",
    description:
      "Get paid on time and see which jobs actually pay. This is not a traffic dashboard.",
    detail: "Lifecycle email, attribution, and the reporting you can check.",
    cta: "Fix the funnel",
    icon: "LineChart" as const,
    tag: undefined as string | undefined,
  },
] as const;

export type GtmPillar = (typeof GTM_PILLARS)[number];

export function getServicePillar(slug: string): GtmPillar | undefined {
  return GTM_PILLARS.find(
    (pillar) => pillar.slug === slug || pillar.id === slug,
  );
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
    label: "Share your idea",
    body: "Tell me what you're working on, what interests you about it, and where you see a connection with my projects.",
  },
  {
    num: "02",
    icon: "FileText" as const,
    label: "Find common ground",
    body: "We'll talk through the idea and see whether our goals and ways of working fit. A good collaboration starts with shared interest.",
  },
  {
    num: "03",
    icon: "Rocket" as const,
    label: "Make something useful",
    body: "If we decide to work together, we'll agree on what to build, who does what, and how we'll know it helps the people using it.",
  },
] as const;

export const MARKETING_FAQS = [
  {
    q: "What is Dobeu?",
    a: "Dobeu is the home for Jeremy Williams's passion projects and the people he builds them with. The projects span practical business software, comics, art, and publishing.",
  },
  {
    q: "What kinds of collaboration are you open to?",
    a: "I'm interested in people with a shared problem to solve, a useful product idea, or a connection to something I'm already building. Tell me what you care about and what you hope to make together.",
  },
  {
    q: "Can I explore a new idea with you?",
    a: "Yes. Send a short note about the idea, who it could help, and why it matters to you. We'll see whether there's a fit before discussing any formal arrangement.",
  },
  {
    q: "Where can I see what you're building?",
    a: "Start with RouteReady, Chima Comics, Dobeu.space, and Ikram & Co. The links on this site take you to the projects themselves.",
  },
  {
    q: "How do we get started?",
    a: "Use the collaboration form or book time to meet Jeremy. Share a little about your interests and what you would like to make. We'll decide together whether it makes sense to continue.",
  },
  {
    q: 'Why "dobeu"?',
    a: 'Two readings at once. Say it out loud — it\'s my last initial W, spelled phonetically ("dub-el-u"). It\'s also "Do Be You": a name for following ideas that feel personal and making them real.',
  },
] as const;

export const PRICING_TIERS = [
  {
    id: "workflow",
    name: "Single workflow",
    price: "Band before the call",
    summary:
      "One painful loop — dispatch, invoicing, intake — automated end to end.",
    detail:
      "One loop, fixed price once the scope is real. Send the job and I reply with a band before we talk numbers.",
  },
  {
    id: "full-build",
    name: "Full build",
    price: PRICE_RANGE.display,
    summary: "The app or portal your business will keep using.",
    detail:
      "Most engagements land here. Fixed-scope, fixed-price after the call.",
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
    summary:
      "Keep the lights on. Updates, monitoring, and someone who picks up when it breaks.",
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
    summary:
      "Watch, plus two hours a month for the small changes that keep piling up.",
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
    summary:
      "Enough hours to keep shipping improvements instead of just holding the line.",
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
  heading: "Meet the projects.",
  body: "RouteReady, Chima Comics, Dobeu.space, and Ikram & Co. show the range of ideas I care about. Visit them to see what is taking shape and where we might find common ground.",
} as const;

export const FOUNDER_STATS = [
  { value: "RouteReady", label: "Driver training" },
  { value: "Chima Comics", label: "Comics and creative commerce" },
  { value: "NYC", label: SITE_IDENTITY.areaServed },
] as const;

export const FOUNDER_REASONS = [
  {
    headline: "A person behind every project.",
    body: "I'm Jeremy. The ideas and the conversations here are personal to me.",
  },
  {
    headline: "Different interests, shared purpose.",
    body: "Business software, stories, and creative commerce all start with people and a useful idea.",
  },
  {
    headline: "Room to build together.",
    body: "If one of these projects speaks to you, or you're working on something related, let's talk.",
  },
] as const;

/**
 * Per-URL sitemap lastModified. Use these content dates — never `new Date()`
 * at build time — so legal and money pages do not share a build stamp.
 */
export const CONTENT_DATES = {
  contact: "2026-10-23",
  faq: "2026-10-23",
  home: "2026-10-22",
  services: "2026-10-22",
  pricing: "2026-10-22",
  about: "2026-10-22",
  process: "2026-08-30",
  caseStudies: "2026-10-22",
  labs: "2026-10-22",
  repos: "2026-10-22",
  login: "2026-05-21",
  privacy: "2026-06-20",
  terms: "2026-10-22",
  cookies: "2026-06-20",
  optinSms: "2026-05-21",
  marketingOptOut: "2026-05-21",
} as const;

/** Reveal hero → `/labs` CTA only when explicitly enabled. */
export const SHOW_LABS_HERO_CTA =
  process.env.NEXT_PUBLIC_SHOW_LABS_HERO_CTA === "true";

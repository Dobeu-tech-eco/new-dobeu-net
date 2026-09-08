# Website Audit: dobeu.net

**Audited:** August 29, 2026 · **Property:** https://dobeu.net (Dobeu Tech Solutions LLC) · **Operator:** Jeremy Williams
**Scope:** Competitor analysis, brand positioning, performance, content strategy, SEO & GEO, accessibility, plus Reddit / X / Hacker News go-to-market.
**Stated goal:** identify best-in-class benchmarks in this market, and position to win small-to-medium business (SMB) clients.

---

## Executive Summary

dobeu.net is an unusually well-built *engineering artifact* and an unusually weak *sales asset*. The craft is genuinely top-decile — a full Content-Security-Policy, HSTS preload, valid FAQ and Organization JSON-LD, a 62–78 ms TTFB, a global `prefers-reduced-motion` override, and a robots.txt that explicitly welcomes GPTBot, ClaudeBot and PerplexityBot. Almost no small studio ships that. But the site sells a stack to an audience that buys outcomes, offers zero third-party proof, and consists of exactly one indexable commercial page. For the SMB goal specifically, it is currently mispositioned at the level of the headline.

The single most important finding: **the best-performing operator in your exact niche wins on named case studies with hard numbers, not on craft.** Business Mechanic, a one-person NYC AI consultancy targeting SMBs, publishes three case studies with specific metrics — "2 days → 2–3 hours," "90-day retention 40% → 85%," "30+ hrs/week saved" — and even one case study where they *rejected* AI and fixed data plumbing instead ([Business Mechanic](https://www.biz-mech.com/)). dobeu.net publishes zero client outcomes and its only "proof" page, /labs, is explicitly labelled as mocked demos. You are losing to weaker engineers with better evidence.

### Top 3 strengths

1. **Technical and security execution is best-in-class for a solo shop.** Full CSP, `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, opt-in cookie gating. Measured TTFB across three runs: 0.078 s / 0.069 s / 0.062 s on a Vercel edge cache HIT.
2. **AI-crawler readiness is already ahead of the market.** robots.txt explicitly allows `GPTBot`, `ClaudeBot`, `PerplexityBot` and `Google-Extended`, and the page ships `FAQPage` JSON-LD with eight real Q&As including the price band — exactly the shape generative engines quote.
3. **The offer mechanics are genuinely differentiated and de-risked.** Fixed-scope fixed-price proposal in 48 hours, code in the client's GitHub org with day-one admin ("No code held hostage"), daily Loom updates, referral out when booked. That beats most agencies on buyer risk, and it is buried in an FAQ accordion.

### Top 3 critical issues

1. **The site is aimed at "founders," not SMBs — starting with the H1.** "I ship autonomous AI coding agents" is a phrase a restaurant group, distributor or clinic owner cannot parse or price. Real SMB buyers say so out loud: the highest-engagement thread found in this audit (179 upvotes, 87 comments) is a retail owner writing "all I see online is the vague advice of 'utilize AI to enhance your business'," with the #2 objection at 17 upvotes being that AI proposals should "demonstrate reduced time or costs rather than rely on unnecessary technical language" ([r/automation](https://www.reddit.com/r/automation/comments/1krm7i7/im_a_retail_business_owner_200kyr_here_are_what/)).
2. **Zero external proof, and one live contradiction.** No named clients, no testimonials, no ratings, no directory listings. The site claims "50+ Projects shipped" and "Building since 2019," but the public GitHub identity it points to — `dobeutech` — was created 2025-05-18, has 0 followers, and its 86 public repos are dominated by forks and single-purpose Shell scaffolds at 0 stars ([GitHub API](https://api.github.com/users/dobeutech)). A technical buyer who clicks through finds less than the homepage promised.
3. **Brand architecture is actively leaking, including a dead domain in the footer.** Every page footer prints "dobeu.net · dobeu.cloud · dobeutech.com". `dobeutech.com` does not resolve at all (DNS failure), `dobeu.cloud` returns 404, and `dobeu.dev` — linked from the "Universe" nav and from the sister blog — fails TLS handshake outright.

### Key growth opportunities

- **Your real wedge is unused.** You have operating experience in transportation safety, fleet/logistics and restaurant multi-unit management. That is a defensible vertical AI-ops position no generic "AI agency" can claim, and it maps precisely to where SMB automation money is. Nothing on dobeu.net says it.
- **dobeu.tech already contains the correct SMB positioning — and it is orphaned.** It leads with "Personalized 1-on-1 AI coaching," "no experience needed," and outcome chips "Hours saved weekly / Lower running costs / Workflows that stick." That is exactly right for SMBs. It is not in dobeu.net's Universe nav.
- **Price transparency is an open lane.** Your $5k–$30k band is real and competitive; it is hidden in JSON-LD and an accordion while direct competitors put tiers on the page.

---

## Product Overview

| | |
|---|---|
| **Entity** | Dobeu Tech Solutions LLC — solo-operator "principal engineering & AI studio" |
| **Operator** | Jeremy Williams, Founder & Principal Engineer |
| **Location signal** | Homepage: "New York City". Sister site footer: "Neptune City, NJ" |
| **Positioning** | "Ship the agent. Ship the app. Ship the brand." / "One operator. Modern stack." |
| **H1** | "Hi. I'm Jeremy. / I ship autonomous AI coding agents." |
| **Stated audience** | "founders who need it shipped, not pitched" |
| **Pricing** | "Most projects land between $5k and $30k" (in FAQ + JSON-LD only) |
| **Timeline** | Ship in 2–6 weeks; scoped proposal within 48 h of a 30-min discovery call |
| **Stack** | Next.js App Router / Supabase / Vercel; Claude + Composio + MCP for agents |
| **Trust chips** | Building since 2019 · NYC-based · Stripe-verified · No agency overhead |
| **Claimed stats** | 2019 · 50+ projects shipped · 4 service pillars |

**Four service pillars:** (1) AI agents & automation — Claude + Composio + MCP, tool-calling pipelines; (2) Full-stack web apps — Next.js/Supabase/Vercel, MVPs, internal tools, client portals; (3) Brand & design systems — Figma libraries with Code Connect, tokens round-tripping to Tailwind/Framer/Webflow; (4) Marketing & growth engineering — programmatic SEO, GA4/PostHog/Mixpanel attribution, lifecycle automation, paid-ads infra.

**Site inventory — the whole property is 9 URLs** ([sitemap.xml](https://dobeu.net/sitemap.xml)): `/`, `/labs`, `/repos`, `/login`, `/privacy`, `/terms`, `/cookies`, `/optin/sms`, `/marketing-opt-out`. The nav items Work / Process / About / FAQ are same-page anchors, not pages. `/labs` hosts four interactive demos described on the page itself as "mocked" and "sandboxed, mocked fan-out events." `/repos` is a GitHub Repo Viewer utility that renders an empty state until a visitor pastes a URL.

**Adjacent properties:** `dobeu.space/blog` ("The dobeu Supply Journal," 6 supply-chain articles, Mar–May 2026), `dobeu.tech` (Dobeu AI Coaching, SMB-focused), `dobeu.cloud` (404), `dobeu.dev` (TLS failure), `dobeutech.com` (no DNS), GitHub `dobeutech`.

---

## Competitor Analysis

### The market you are actually in

Demand is real and growing fast. Gartner forecasts worldwide AI spending will total **$2.59 trillion in 2026, up 47% year over year**, with the **AI Services** line alone moving from $436.4 bn (2025) to $585.5 bn (2026) to $759.4 bn (2027) ([Gartner via Business Wire](https://www.businesswire.com/news/home/20260519405832/en/Gartner-Forecasts-Worldwide-AI-Spending-to-Grow-47-in-2026)).

Your target segment is already committed, but it is committed to *tools*, not *builders* — which is the whole opportunity. In a March 2026 survey of 517 US small-business owners with 2–99 employees (±4.4 pts), **82% report using at least one AI tool**, the median owner uses **5** of them, **81%** say AI is important to competitiveness and growth, and **90%** are confident in their ability to adopt AI and digital tools ([SBE Council / TechnoMetrica](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf)). Yet stated uses skew shallow — 37% general research, 30% content creation, 25% marketing automation. **The gap between "owns 5 AI tools" and "has one workflow actually automated end-to-end" is your market.**

The niche is crowded but shallow: Clutch lists **213 companies** under AI consulting in New York City alone, of which it designates only 15 Leaders and 15 Contenders ([Clutch](https://clutch.co/consulting/ai/new-york)). Being findable and *evidenced* is the constraint, not being good.

### Competitive set

| Competitor | Positioning (verbatim) | Target | Published pricing | Proof mechanism | vs. dobeu.net |
|---|---|---|---|---|---|
| **[Business Mechanic](https://www.biz-mech.com/)** (Brooklyn, solo) | "AI Adoption Specialist" / "Human-first AI integration for SMBs" / "People, Process, Technology — in that order." | SMBs, NYC + remote | None published | **3 case studies with hard metrics**: "2 days → 2–3 hours," "90-day retention 40% → 85%," "30+ hrs/week saved," "Tax prep 4h → 15min." Named principal testimonial. | **This is your closest and strongest rival.** Same solo model, same city, SMB-native language, and it wins purely on evidence. |
| **[AI Consultant NYC](https://aiconsultantnyc.com/)** | "Revenue-Generating AI Automation for Businesses" / "save 20–40 hours per week — without long contracts or pointless pilots" | NYC finance, healthcare, real estate, professional services; "anyone paying talented people $80K+ to do work software should handle" | **Published tiers**: Discovery & Process Mapping **$3–6K fixed**; Build **$8–50K**; ongoing support month-to-month; free 30-min call | "Trusted by NYC finance, healthcare, and real estate firms"; "30-day AI automation delivery"; 24-h personal reply promise; anti-story about a firm that "wasted $120K on an 'AI roadmap'" | Prices on the page, geography and industry named, ROI framed in salary terms. dobeu.net does none of these above the fold. |
| **[NeuralEdge Consulting](https://www.neuraledge-consulting.ai/)** | "AI that actually moves your business forward." / "built for small businesses that want results, not slide decks. Real AI. Real outcomes." | Small businesses | **Radical risk reversal**: Strategy Sprint and Implementation Partner at **$0 upfront, % of realized gains**; Tools subscription **$499/mo**; single session **$150/hr**; coaching bundle **$500 / 4 sessions** | Weak — no named case studies, no logos, no testimonials | Beats you on offer structure and SMB language; you beat them badly on delivery credibility and craft. |
| **[AI Agency NY](https://www.aiagencyny.com/ai-consulting-new-york-ai-agency)** | "AI Consulting Services in New York, NY to Plan, Implement, and Scale Your AI Automation Strategy" | "Small and medium-sized businesses in NYC"; finance, healthcare admin, retail, real estate | "Pricing depends on scope"; fixed-fee pilots for small businesses | Thin — unnamed examples, "double-digit improvements in cycle time" | Wins on SEO surface area (long location+service pages) despite weaker substance. A pure content-volume threat. |
| **[CTO Fraction](https://ctofraction.com/)** | "Fractional CTO Help for SaaS Startups and SMBs" | "SMBs that do not have the resources or need for a full-time CTO" | "**$2,000 and $25,000 per month**" | "more than 2 decades of experience"; no case studies, logos or testimonials | Occupies the retainer/advisory framing your FAQ mentions only in passing. Your "long-term IT advisor well past launch" line is this offer, unpackaged. |
| **[Designjoy](https://www.designjoy.co/)** (solo, since 2017) | "Designjoy replaces unreliable freelancers and expensive agencies for one flat monthly fee" / "One subscription to rule them all." | "everyone" | **$4,995/mo** on the page (from $5,995), one request at a time, ~48 h delivery, pause or cancel anytime, **75% back within a week** | Kevin O'Leary / Shark Tank testimonial; named clients Buy Me A Coffee and Switchboard with "Product of the Year" awards; "run entirely by Brett" | The canonical proof that a *one-person* studio can out-position agencies — by productizing, pricing publicly, and guaranteeing. |
| **[thoughtbot](https://thoughtbot.com/)** | "building and modernizing software where reliability, compliance, and long-term maintainability matter as much as speed" | Every stage; US healthcare vertical focus | None published | Named case studies **CloseKnit Health ("release speeds by 10x") and Harvard Business Review**; a 2026 Healthcare Software research report; public Playbook, blog, podcast | The content-authority model: they rank and get cited because they publish. Direct template for what dobeu.net is missing. |
| **[84EM](https://84em.com/blog/hiring-solo-developer-vs-agency/)** | "Hiring a Solo Developer vs. an Agency: The Honest Tradeoffs" | Buyers weighing solo vs agency | None | A blog that ranks for the exact objection solo operators face | Has already captured the search demand for your central objection. Note their honesty play: "I can refer you to a larger agency partner… that I've worked with and trust" — you have the same line, in an FAQ. |
| **[Clutch NYC AI directory](https://clutch.co/consulting/ai/new-york)** | Directory / ranking | Buyers shortlisting vendors | Publishes the market's benchmark bands: strategy & discovery **$15,000–$60,000**; PoCs **$40,000–$150,000**; end-to-end MVPs **$120,000–$400,000+**; hourly **$150–$350+**; managed AI/ML support **$10,000–$50,000/mo** | Verified reviews with counts and star ratings (e.g. DataRoot Labs 4.9 / 23 reviews, "Premier Verified") | You are absent. This is a distribution channel with buyer intent and a ratings moat you can start building this month. |
| **Productized AI automation shops** | — | Small business / mid-market | Market rate card: retainers **$500–$8,000/mo**; project **$1,500–$20,000+**; productized **$997–$4,500/mo**; single-workflow setup fee **$1,500–$5,000**; multi-system integration **$5,000–$20,000**; SMB tier **$500–$1,500/mo** | — | Establishes that SMBs expect a **sub-$5k entry point**. Your floor of "$5k–$30k" prices you out of first contact. ([Taskip pricing survey](https://taskip.net/ai-automation-agency-pricing/)) |
| **No-code substitutes** (Lovable, v0, Replit Agent, Bubble, Zapier/Make) | DIY | SMB owners | Low monthly | — | The real competitor for a $5k decision. SMB owners in community threads describe building tools in-house and staying hands-on. You must argue against DIY explicitly. ([r/smallbusinessUS](https://www.reddit.com/r/smallbusinessUS/comments/1snnq0t/starting_an_automation_service_for_small/)) |

### Best-in-class benchmark: what the top 3 do that dobeu.net does not

1. **Business Mechanic publishes case studies as the primary hero content, with before/after numbers and the technology named** — including one where the honest answer was "no AI": "Rejected AI predictions due to hallucination risk—instead fixed the data plumbing… Delivered deterministic, trusted accuracy without a single LLM call" ([Business Mechanic](https://www.biz-mech.com/)). dobeu.net's equivalent slot holds four self-described mocked demos on /labs.
2. **Designjoy puts one number above the fold and reverses all risk** — "$4,995/month," "PAUSE OR CANCEL ANYTIME," and "Not loving it after a week? Get 75% back, no questions asked," plus a Shark Tank testimonial and two award-winning named clients ([Designjoy](https://www.designjoy.co/)). dobeu.net's price band is only discoverable inside FAQ JSON-LD, and there is no guarantee of any kind.
3. **thoughtbot converts publishing into authority** — named case studies with a quantified outcome ("accelerating release speeds by 10x"), Harvard Business Review as a client, plus a Playbook, blog, podcast and a proprietary 2026 research report ([thoughtbot](https://thoughtbot.com/)). dobeu.net has no blog on its own domain at all; its only writing lives on `dobeu.space`.

### Differentiation opportunities

| # | Opportunity | Why it is defensible for you |
|---|---|---|
| 1 | **Vertical AI ops for logistics, distribution, fleet and food service** | Genuine operator background in transportation safety, fleet technology and multi-unit restaurant management. None of the 213 Clutch NYC AI firms can claim they have run a safety program or a restaurant P&L. It also matches the pain in the audited Reddit threads (inventory discrepancies, reconciliation, onboarding). |
| 2 | **"Honest diagnostic" positioning — sometimes the answer is not AI** | The 179-upvote retail-owner thread and Business Mechanic's most striking case study both prove this converts. You already have the raw material ("If I'm booked, I'll tell you," "no pitch"). |
| 3 | **Publish the price and the guarantee** | Your $5k–$30k band sits *below* Clutch's $15k–$60k discovery benchmark. That is a genuine value story you are hiding. Add a sub-$5k paid diagnostic to match the SMB entry-point expectation. |
| 4 | **"You own everything" as a headline claim, not an FAQ answer** | "Your GitHub org by default… full admin access on day one. No code held hostage" directly answers the #1 SMB fear of vendor lock-in. Competitors audited here say nothing comparable. |
| 5 | **Productize dobeu.tech coaching as the top-of-funnel** | A $150–$500 coaching/diagnostic session is the natural first step for an owner who owns 5 AI tools and has automated nothing — and it feeds the $5k–$30k build. NeuralEdge charges exactly this ($150/hr, $500/4 sessions). |
| 6 | **The technical rigor itself, expressed as risk language** | Your CSP, HSTS preload and consent gating are objectively better than every competitor site audited. Translate that into buyer language: "your customer data, handled properly." |

---

## Brand Voice & Positioning

### Current voice

The register is confident, terse, dev-insider, anti-agency. It runs on negation — "shipped, not pitched," "No theater," "No agency overhead," "No kickoff theater," "No code held hostage," "no slide deck." Sentence fragments dominate. The signature is "Ship the agent. Ship the app. Ship the brand."

**What works:** it is distinctive, unusually honest, and completely free of the "transform your business with cutting-edge AI" mush that saturates this category. The three-step process section ("Three steps. No theater.") and the FAQ are the strongest sales copy on the site because they are concrete and specific.

**What it costs you:** the voice is calibrated for a technical founder peer, and it defines itself by what an agency is not — which only lands on a buyer who has been burned by an agency. Most SMB owners have never hired one. To them, "No agency overhead" is not a benefit, it is a category they do not recognize.

### The core mismatch

The site states its audience twice — "for founders who need it shipped, not pitched" — and your stated commercial goal is SMBs. These are different buyers with opposite purchase logic.

| | Founder buyer | SMB owner buyer |
|---|---|---|
| Buys | velocity, technical judgment, a peer | hours back, cost out, less chaos |
| Understands | "Next.js, Supabase, Vercel," "MCP" | "your invoices reconcile themselves" |
| Fears | slow builds, bad architecture | being sold something they can't maintain |
| Decides via | a technical conversation | proof another business like theirs got a result |

The copy is stack-led throughout. "Claude + Composio + MCP integrations," "App Router, auth, billing, CI/CD," "Design tokens that round-trip through Tailwind, Framer, and Webflow," "GA4/PostHog/Mixpanel attribution." For a founder that is credentialing. For an SMB owner it is the exact failure mode buyers described at 17 upvotes: proposals should "demonstrate reduced time or costs rather than rely on unnecessary technical language," and "small businesses prefer straightforward, functional tools over 'AI magic'" ([r/automation](https://www.reddit.com/r/automation/comments/1krm7i7/im_a_retail_business_owner_200kyr_here_are_what/)).

The H1 is where it is most acute. **"I ship autonomous AI coding agents"** describes agents that write code — a service sold to engineering teams. An SMB owner who lands here cannot tell whether you can help with their scheduling, their invoices or their dispatch. Compare the two best SMB-native heroes in the set: "AI that actually moves your business forward… built for small businesses that want results, not slide decks" ([NeuralEdge](https://www.neuraledge-consulting.ai/)) and "We replace manual workflows with AI systems that save 20–40 hours per week — without long contracts or pointless pilots" ([AI Consultant NYC](https://aiconsultantnyc.com/)).

**Rewrites, same voice, outcome-led:**

| Current | SMB rewrite |
|---|---|
| "I ship autonomous AI coding agents." | "I take the busywork out of your business — permanently." |
| "Claude + Composio + MCP integrations." | "The quote-to-invoice chase, the dispatch spreadsheet, the inbox triage — automated, and you own it." |
| "Next.js, Supabase, Vercel. Production-grade from day one." | "The internal tool your team keeps asking for. Live in weeks, built to last a decade." |
| "Attribution, lifecycle automation, paid infra." | "Finally know which marketing dollars actually brought in a customer." |
| "No agency overhead." | "You talk to the person building it. No account managers, no markup." |

### Three positioning angles

#### Angle 1 — Vertical AI operations for logistics, distribution and food service (recommended primary)

> **Positioning statement:** For distribution, logistics, fleet and multi-unit food-service operators with 10–200 employees who are drowning in manual coordination, Dobeu is the AI operations partner that has actually run these operations — unlike generic AI agencies, we start from a working knowledge of dispatch, DOT compliance, inventory and multi-unit P&L, and we ship one automated workflow at a time that you own outright.

- **Segment:** NJ/NY metro distributors, 3PLs, fleet operators, restaurant groups, food-service suppliers.
- **Proof required:** two named case studies in these verticals with hours-saved or error-reduction numbers; one "how dispatch coordination actually breaks" article that only an operator could write.
- **Hierarchy:** operator credibility → named vertical outcome → the one-workflow-at-a-time method → you own the code → price band.
- **Hero:**
  > **H1:** Automation built by someone who has run the operation.
  > **Sub:** I spent years inside fleet safety and multi-unit restaurant operations before I started building software for them. I automate the coordination work that eats your week — dispatch, compliance paperwork, inventory reconciliation, invoicing — and hand you the keys.
  > **Chips:** Fleet & food-service operator background · One workflow live in 2–4 weeks · You own the code from day one
- **Why this wins:** it is the only claim in this competitive set that cannot be copied by a generalist, and it converts your background from résumé trivia into the moat.

#### Angle 2 — The fractional technology partner for owners with no CTO

> **Positioning statement:** For owner-operated businesses with 10–100 employees that have accumulated a dozen disconnected tools and nobody accountable for the technology, Dobeu is the fractional technology partner who fixes the stack, builds what is missing, and stays on afterward — unlike project-shop developers who disappear at launch, or fractional CTOs who only advise.

- **Segment:** non-technical SMB owners; professional services, clinics, trades, local multi-location businesses.
- **Proof required:** a published diagnostic deliverable, a retainer price, one client on record about the post-launch relationship.
- **Hierarchy:** the "nobody owns our tech" problem → diagnostic-first → build → stay on → transparent monthly.
- **Hero:**
  > **H1:** Your business has 12 tools and no one running them.
  > **Sub:** I audit what you're paying for, connect what should be connected, build the piece that's missing, and stay on as the person you call. Fixed price. No retainer lock-in.
  > **Chips:** Paid diagnostic in week one · Fixed-scope proposal in 48 hours · Month-to-month after launch
- **Why this wins:** the market band is validated at "$2,000 and $25,000 per month" ([CTO Fraction](https://ctofraction.com/)), the incumbents in it publish no proof at all, and it is a recurring-revenue shape rather than a project treadmill.

#### Angle 3 — Ship-fast product partner for funded founders (keep, but demote)

> **Positioning statement:** For pre-seed and seed founders who need a production application in weeks, Dobeu is the single senior operator who designs, builds and instruments it end to end — unlike agencies that staff juniors behind an account manager, you work directly with the person writing the code, on a fixed scope and a fixed price.

- **Segment:** technical and semi-technical founders, $5k–$30k budgets. This is your current site, essentially unchanged.
- **Keep it** as a secondary page — it is real revenue and it is where your craft signals land hardest. It should not be the homepage if the goal is SMB.

### Trust and credibility gaps

| Gap | Evidence | Conversion cost | Fix |
|---|---|---|---|
| **No named clients or logos** | Nothing on any page | Buyers cannot pattern-match to themselves; the strongest rival leads with three | 2–3 case studies with before/after numbers; anonymize the client, never the metric |
| **No testimonials** | Zero on the site | Designjoy uses one Shark Tank quote to carry an entire page | 3 named quotes; ask past clients this week |
| **Proof page is explicitly mocked** | /labs: "mocked plan → act → verify cycle," "sandboxed, mocked fan-out events" | A sophisticated visitor reads "no real work to show." Honest, but self-defeating in the portfolio slot | Rename to "Experiments," and put real (even redacted) client work in the portfolio slot |
| **"50+ Projects shipped" is unverifiable and contradicted** | GitHub `dobeutech` created **2025-05-18**, 0 followers, 86 repos mostly forks/0-star Shell scaffolds ([GitHub API](https://api.github.com/users/dobeutech)) | An unverifiable claim next to a thin public trail damages more than no claim | Either substantiate it (project list, redacted logos) or replace with something checkable |
| **No third-party ratings anywhere** | Absent from Clutch's 213 NYC AI companies | Competitors carry "4.9 / 23 reviews / Premier Verified" ([Clutch](https://clutch.co/consulting/ai/new-york)) | Claim Clutch and G2 profiles; get 3 reviews |
| **No guarantee or risk reversal** | None on site | Rivals offer 75% back in week one, $0 upfront on % of gains, and 30-day proof windows | Add one: paid diagnostic credited toward the build, or a 30-day "it works or you don't pay the final milestone" |
| **Identity inconsistency in structured data** | `Person.sameAs` = `https://www.linkedin.com/in/jeremy-williams`, while the profile surfacing in search for you and listed on your GitHub is `linkedin.com/in/jswilliamstu` ([search result](https://www.linkedin.com/in/jswilliamstu)) | Breaks entity resolution for Google and AI engines — see GEO below | Correct `sameAs` to the real profile URLs |
| **Location conflict** | dobeu.net says "New York City"; `dobeu.space` footer says "Neptune City, NJ" | Kills local-pack eligibility and confuses AI answers | Pick one NAP; use `areaServed` for the rest |

### Brand architecture risk

Five domains split whatever equity you build: `dobeu.net` (studio), `dobeu.space` (Supply Journal blog), `dobeu.tech` (AI coaching), `dobeu.cloud` (**404**), `dobeu.dev` (**TLS handshake failure**), plus `dobeutech.com` (**no DNS**) printed in every footer, and a GitHub account branded as an "org" that is actually a personal user account.

Three consequences: (1) you are publicly advertising broken and non-existent properties; (2) your only real content — six supply-chain articles on `dobeu.space` — sends zero ranking or citation benefit to dobeu.net; (3) your best SMB-facing asset, `dobeu.tech`, is invisible from the site you are trying to sell from.

Also telling: "Why 'dobeu'?" is an FAQ question. A brand name that requires an FAQ entry is spending attention you should be spending on the offer. Keep the name, stop explaining it, and add a plain-English descriptor beside the logo — "Dobeu · AI operations for growing businesses."

---

## Performance & Technical

### Measured

| Metric | Measured value | Assessment |
|---|---|---|
| TTFB (3 runs, edge cache HIT) | **0.078 s / 0.069 s / 0.062 s** | Excellent — well inside Google's recommended TTFB budget of under 0.8 s ([web.dev](https://web.dev/articles/ttfb)) |
| Homepage HTML | **99,086 bytes raw / 17,094 bytes gzipped** | Raw is heavy for one landing page; compressed is fine |
| Inline Next.js RSC flight payload | **20,024 bytes across 14 `__next_f.push` chunks** | ~20% of raw HTML is serialized React payload — normal for App Router, but it is why the document is 99 KB |
| Inline `<script>` blocks | **18 blocks, 24,145 bytes** | Requires `'unsafe-inline'` in CSP; see security note |
| JS requests / transfer | **20 script files, 287,754 bytes (281 KB) compressed** | Above the ~170 KB compressed JS guideline for a content page ([web.dev performance budgets](https://web.dev/articles/performance-budgets-101)) |
| Largest chunks | 55.6 KB, 47.2 KB, 46.4 KB, plus **41.3 KB of polyfills** | The polyfill bundle is 14% of your JS for browsers your buyers do not use |
| CSS | **11,145 bytes transferred / 58,277 bytes raw**, one render-blocking stylesheet | Good — single file, well compressed |
| Fonts | Self-hosted `.woff2`, preloaded, **zero Google Fonts requests** | Best practice, correctly done |
| Images | **0 `<img>` tags** on the homepage; 48 inline SVGs, 31 with `aria-hidden` | No image-weight problem at all |
| Motion | Global `@media (prefers-reduced-motion:reduce)` override zeroing all animation and transition durations | Correct and better than most sites |

### Findings

| # | Issue | Severity | Evidence | Fix | Expected impact |
|---|---|---|---|---|---|
| P1 | **Analytics and third-party stack is over-provisioned** — the CSP allowlists PostHog, Mixpanel, Google Tag Manager, Google Analytics, Amplitude, Datadog RUM, Intercom, Stripe, Typeform, Calendly and Apollo.io | **High** | `content-security-policy` header on https://dobeu.net/ | Four product-analytics tools plus session RUM plus a chat widget is redundant. Keep one analytics tool (PostHog), keep Stripe and the scheduler, drop the rest or defer them to post-consent interaction | Each of Intercom, GTM and Datadog RUM typically adds 100–300 KB and meaningful main-thread work; consolidating is the single biggest available performance win. Third-party JS is a leading cause of poor Interaction to Next Paint ([web.dev third-party JS](https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript)) |
| P2 | **281 KB of compressed JS for a brochure page** | High | 20 measured script requests | Trim the 41 KB polyfill chunk via a modern browserslist target; audit the three 45–56 KB vendor chunks; the shader/canvas hero is a likely contributor | Directly improves INP and LCP on mid-range mobile, where SMB owners will open your site |
| P3 | **Animated shader/grain hero plus a typewriter effect run on the critical path** | Medium | `animate-pulse` cursor inside the H1; /labs describes tuning "grain gradient parameters" for "the hero background" | Render a static gradient image as the initial paint and hydrate the animation after LCP; already correctly disabled under reduced-motion | Improves LCP and battery/thermals on low-end devices |
| P4 | **CSP allows `'unsafe-inline'` and `'unsafe-eval'` on `script-src`** | Medium | `script-src 'self' 'unsafe-inline' 'unsafe-eval' …` | Move to a nonce or hash-based CSP; Next.js supports nonces natively. `'unsafe-eval'` should be removable outright | Removes the one real weakness in an otherwise exemplary header set — and it is a credible thing for a security-conscious buyer to check |
| P5 | **Cookie banner overlays the primary CTA cluster on first paint** | Medium | Screenshot: the consent card covers the region containing "Tell me about your project" and crowds "Book a call" | Reposition to a bottom bar, or a compact corner card that does not overlap CTAs | Direct conversion effect on the only conversion action on the site |
| P6 | Sitemap `lastmod` is identical (`2026-08-29T20:34:34.905Z`) across all nine URLs | Low | [sitemap.xml](https://dobeu.net/sitemap.xml) | Emit true per-page modification dates | Marginal crawl-efficiency gain; matters once you publish real content |
| P7 | `<meta name="keywords">` is present | Low | Homepage `<head>` | Remove. Google has not used the keywords meta tag for ranking for well over a decade ([Google Search Central](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)) | Cosmetic; signals dated SEO practice to anyone reading source |
| P8 | robots.txt stacks four `User-Agent:` lines before one `Allow: /`, and includes a non-standard `Host:` directive | Low | [robots.txt](https://dobeu.net/robots.txt) | Grouping consecutive user-agent lines is valid per the [Robots Exclusion Protocol (RFC 9309)](https://www.rfc-editor.org/rfc/rfc9309.html), so this works — but the block is redundant since `User-Agent: *` already allows everything. `Host:` is ignored by Google. Simplify for clarity | No ranking effect; reduces the chance of a future editing mistake that blocks AI crawlers |

**Credit where due:** `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=()`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, plus opt-in consent gating. This header set is stronger than every competitor site examined in this audit.

---

## SEO & GEO

### Prioritized SEO fixes

| # | Issue | Severity | Fix | Expected impact |
|---|---|---|---|---|
| S1 | **The entire property has one commercially indexable page.** The sitemap contains 9 URLs; 6 are legal/consent pages, `/login` is a gate, `/repos` is an empty-state tool, `/labs` is a demo page. Work / Process / About / FAQ are same-page anchors, so no service page exists to rank | **Critical** | Convert each anchor section into a real URL: `/services/ai-agents-automation`, `/services/web-apps`, `/services/design-systems`, `/services/growth-engineering`, plus `/about`, `/process`, `/pricing`, `/case-studies` | Takes you from 1 to ~10 ranking-eligible commercial pages. Nothing else in this section matters until this is done |
| S2 | **No case-study pages** | **Critical** | One indexed page per engagement: problem, approach, measurable outcome, stack, timeline, price band. Follow the Business Mechanic pattern — metric in the heading | Highest-converting page type in services SEO, and the raw material AI engines quote |
| S3 | **No local/geo pages despite a location-led claim and a location conflict** — homepage says "New York City," sister site says "Neptune City, NJ" | **Critical** | Pick one canonical NAP. Add `/ai-automation-consultant-nyc` and `/ai-automation-new-jersey`, and `ProfessionalService` schema with `areaServed` | Competitors rank on exactly this pattern; AI Agency NY names Manhattan, Brooklyn, Queens, Financial District explicitly |
| S4 | **No pricing page**, despite having a competitive published band | High | `/pricing` with tiers: diagnostic, single-workflow build, full build, ongoing. Add `Service` + `Offer` schema with the $5k–$30k `priceRange` | Captures high-intent "cost of…" queries — the query class most often surfaced in AI answers |
| S5 | **No blog on dobeu.net**; the only content sits on `dobeu.space` with `canonical: https://dobeu.space/blog` | High | Move or cross-publish the Supply Journal to `dobeu.net/insights` with correct canonicals, and 301 the rest of `dobeu.space` | Consolidates topical authority onto the domain you are selling from |
| S6 | **Broken and non-existent domains advertised site-wide** — `dobeutech.com` fails DNS, `dobeu.cloud` returns 404, `dobeu.dev` fails TLS, all three linked or printed in the footer/nav | High | Remove or fix. `dobeu.dev`'s TLS failure is the worst — a security error page on a link from an engineering brand | Removes broken external links and an active credibility hazard |
| S7 | **`Person.sameAs` points to a LinkedIn URL that is likely not yours** (`/in/jeremy-williams` vs the `/in/jswilliamstu` profile that surfaces in search and is listed on your GitHub) | High | Correct `sameAs` to the real LinkedIn, the GitHub account, and any Clutch/Crunchbase profile | This is the mechanism Google and AI engines use to resolve you as an entity. Pointing at the wrong person is worse than pointing nowhere |
| S8 | **Missing `ProfessionalService`/`LocalBusiness`, `Service`, `Offer`, `BreadcrumbList`, `Review`/`aggregateRating` schema** | High | Add all of the above as real content justifies. Follow [Google's structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) | Local and service-provider eligibility, plus richer entity data for AI answers |
| S9 | **`/repos` is a thin utility page with no keyword target** and renders "No repos added yet" | Medium | Either enrich into a genuinely useful indexable tool with explanatory content, or `noindex` it | Removes a thin-content signal from a 9-URL site where it is 11% of the index |
| S10 | **`/labs` self-describes as mocked** | Medium | Reframe as `/experiments` and give the portfolio slot to real work | Stops the strongest-titled non-home page from advertising the absence of client work |
| S11 | **Anchor-only navigation creates an internal-linking dead end** — the homepage links out to only `/labs`, `/repos`, `/login` and legal pages | Medium | Build a real nav and cross-link services ↔ case studies ↔ pricing ↔ insights | Distributes authority; currently there is nothing to distribute it to |
| S12 | **`<title>` leads with a personal name** — "Jeremy Williams — AI Agents, Full-Stack Apps & Brand Systems \| Dobeu" (72 chars) | Medium | Lead with the service and geography: "AI Automation & Custom Software for Small Business \| NYC & NJ \| Dobeu" | The name has no search volume; the service plus location does |
| S13 | **H1 renders without a space between sentences** — the DOM yields "Hi. I'm Jeremy.I ship autonomous AI coding agents." because two `<span class="block">` elements are concatenated with no whitespace | Low | Insert a space or restructure so extracted text reads correctly | Text extractors, SERP snippets and screen readers all consume the broken string |
| S14 | `<meta name="keywords">` present, `lastmod` uniform | Low | See P7, P6 | Housekeeping |

### GEO — Generative Engine Optimization

You sell AI services, so your absence from AI answers is both a revenue problem and a credibility problem.

**Live visibility test.** I ran the queries an SMB buyer would actually use. Results:

| Query | Does dobeu.net appear? |
|---|---|
| "Dobeu Tech Solutions" | **Yes — position 1** ([dobeu.net](https://dobeu.net/)), with your LinkedIn company page, `dobeu.tech`, your `/terms` page, a `dev.to` profile and `dobeu.space/blog` also surfacing. Note a same-name competitor also appears: [DOB Tech Solutions](https://dobtechsolutions.com/) |
| "Jeremy Williams Dobeu AI agent developer" | **Yes — position 1**, but crowded by at least four other Jeremy Williamses in tech, including one branded "Fractional CTO & AI Strategy" and one "AI Automation & Infrastructure Engineer" |
| "hire developer build AI agent for small business" | **No.** Results are 75way, Layer3Labs, Wayfind Labs, Aalpha, Upwork, Cognio |
| "best AI automation consultant NYC small business" | **No.** Results are Lotus Brains Studio's comparison listicle, [Business Mechanic](https://www.biz-mech.com/), [AI Consultant NYC](https://aiconsultantnyc.com/), Clear AI NYC, [NeuralEdge](https://www.neuraledge-consulting.ai/), Longi Engineering, AI Agency NY, Colorless Studio |

**Diagnosis:** you have **branded** visibility only. Anyone who already knows your name finds you instantly. Nobody discovers you. Worse, "Jeremy Williams" is a high-collision name, so even branded queries dilute — which makes entity disambiguation urgent, not cosmetic.

**Why you are not cited: no third-party corroboration.** Generative engines synthesize what independent sources say about you. Your entire footprint is self-published. Your competitors appear inside listicles ("AI Automation Agency New York: Best 15 Providers Compared"), Clutch profiles with star ratings and review counts, and directory pages — the exact document types that get retrieved and quoted. You are on none of them.

**What is already right — keep it:** robots.txt explicitly permits `GPTBot`, `ClaudeBot`, `PerplexityBot` and `Google-Extended`, which is the necessary precondition and something many sites get wrong. Your `FAQPage` JSON-LD with eight direct Q&As — including the price answer — is precisely the extractable format engines favor. Clean semantic HTML (one `<h1>`, `<main>`, `<nav>`, `<section>`, `<article>`) helps too.

**On `llms.txt`:** the honest answer is that it is cheap and harmless but there is no public evidence that any major engine consumes it for retrieval or ranking. Add it if you like — it takes ten minutes — but do not count it as a strategy. Structured data, entity consistency and third-party citations are what actually move AI visibility.

#### 90-day GEO and authority plan

| Weeks | Action | Why it moves AI citations |
|---|---|---|
| 1 | Fix `Person.sameAs` to the correct LinkedIn; add GitHub and any Crunchbase URL. Choose one canonical NAP (NYC or Neptune City) and use it identically everywhere | Entity resolution is the gate. Conflicting identity data means engines cannot confidently attribute claims to you |
| 1 | Remove `dobeutech.com` from the footer; fix or remove `dobeu.cloud` and `dobeu.dev` | Broken properties on a brand that sells reliability |
| 1–2 | Add `ProfessionalService` schema with `areaServed` (NYC + NJ metro), and `Service` + `Offer` with the $5k–$30k `priceRange` | Makes your prices and service area machine-readable — directly quotable in "how much does X cost" answers |
| 2–3 | Claim and complete Clutch and G2 profiles; ask 3 past clients for reviews | Clutch NYC AI is a retrieval-heavy page listing 213 companies with ratings ([Clutch](https://clutch.co/consulting/ai/new-york)); competitors carry "4.9 / 23 reviews" |
| 3–4 | Publish 2 case studies with hard metrics on dobeu.net | The most citable content type you can own |
| 4–6 | Publish `/pricing` with real tiers, and one "What AI automation actually costs a small business in 2026" article citing the market bands | Cost queries are disproportionately answered by AI rather than clicked |
| 5–8 | Migrate or cross-publish `dobeu.space` content to `dobeu.net/insights` with correct canonicals | Consolidates topical authority onto the selling domain |
| 6–10 | Earn 3–5 genuine third-party mentions: guest post in a logistics/food-service trade publication, one podcast appearance, one relevant local business directory, a substantive answer trail on Reddit and Hacker News | This is the actual lever. Engines cite what others say about you |
| 8–12 | Get included in at least one "best AI automation agencies in NYC/NJ" roundup by pitching the authors of existing listicles | Those listicles are literally what surfaced instead of you for your target query |
| Ongoing | Track branded and non-branded AI answer visibility monthly across ChatGPT, Perplexity, Claude and Google AI Overviews | You cannot manage what you do not measure |

---

## Accessibility (WCAG 2.1 AA)

Measured by sampling rendered pixels from the live homepage and computing contrast ratios using the [WCAG relative luminance formula](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) (AA requires 4.5:1 for normal text, 3:1 for large text).

| # | Issue | Severity | Measured evidence | Fix |
|---|---|---|---|---|
| A1 | **Trust chip "No agency overhead" is effectively invisible** — orange text on the orange section of the hero gradient | **Critical** | Measured **1.60:1** across the trust-chip row (foreground ≈ rgb(236,180,153) on rgb(249,239,235)). Visibly unreadable in the rendered screenshot | Move chips off the gradient onto a solid band, or use a high-contrast foreground token. Needs ≥4.5:1 |
| A2 | **"Tell me about your project" text link fails badly** — light text over the orange gradient | **Critical** | Measured **1.25:1** — the worst element on the page, and it is a conversion CTA | Re-color, or place on a solid surface |
| A3 | **A live region inside the `<h1>`** — the typewriter span carries `aria-live="polite" aria-atomic="true"`, so every character change re-announces the entire phrase | **Critical** | `<span class="text-primary" aria-live="polite" aria-atomic="true" data-testid="hero-typewriter">` | Remove `aria-live` from the heading. Render the final text in the DOM and mark the animated layer `aria-hidden="true"`. A screen-reader user currently hears the page title repeat dozens of times |
| A4 | **"Hi. I'm Jeremy." fails contrast** — `text-muted-foreground/45` applies 45% opacity to muted text | **High** | Measured **2.08:1** (≈ rgb(179,179,188) on white). Fails even the 3:1 large-text threshold | Raise to at least 3:1 for large text; 4.5:1 is safer |
| A5 | **Capability card body copy fails** | **High** | Measured **2.91:1** on the "Autonomous workflows & tool-calling pipelines" card text | Darken the muted-foreground token |
| A6 | **H1 text is concatenated without whitespace** — screen readers announce "Jeremy.I ship…" | Medium | Two adjacent `<span class="block">` elements with no separating space | Add a space or an `aria-label` on the `<h1>` |
| A7 | **One icon-only button has no accessible name** | Medium | A `<button>` containing only a 24×24 `<svg>` and no text; 26 buttons total, 33 `aria-label` attributes present, so this one was missed | Add `aria-label` (this appears to be the theme toggle) |
| A8 | **FAQ accordion is custom, not `<details>`/`<summary>`** | Medium | 0 `<details>` and 0 `<summary>` elements despite 8 collapsible Q&As | Verify each trigger is a `<button>` with `aria-expanded` and `aria-controls`, and that keyboard focus order is correct. Native `<details>` is the lower-risk option |
| A9 | **Hero subhead is borderline** | Low | Measured **5.53:1** — passes AA for normal text but sits on a moving gradient, so effective contrast varies with animation frame | Ensure the worst-case frame still clears 4.5:1 |

**Done well:** `<html lang="en">` is set; a "Skip to main content" link is present; one `<h1>` with a logical H2/H3 hierarchy; proper landmarks (`<header>`, 2× `<nav>`, `<main id="main">`, 8× `<section>`, `<footer>`, 4× `<article>`); 113 `aria-*` attributes with 31 of 48 decorative SVGs correctly `aria-hidden`; viewport allows zoom to `maximum-scale=5`; and a global `prefers-reduced-motion: reduce` rule that zeroes all 5 animations and 7 keyframe sets. The failures are concentrated entirely in the low-contrast muted-color palette over the gradient hero — one design-token pass fixes most of them.

**Also on `dobeu.space/blog`:** article card titles are marked up as `<h6>` under a single `<h1>`, skipping H2–H5 entirely. That breaks heading-order requirements and weakens the SEO signal on your only real content.

---

## Content & Article Strategy

### What your competitors publish

thoughtbot's authority rests on a public Playbook, blog, podcast, a 2026 Healthcare Software research report, and case studies headlined with outcomes ([thoughtbot](https://thoughtbot.com/)). AI Agency NY ranks with long service+location pages despite having no named case studies ([AI Agency NY](https://www.aiagencyny.com/ai-consulting-new-york-ai-agency)). 84EM captured the "solo developer vs agency" objection query outright ([84EM](https://84em.com/blog/hiring-solo-developer-vs-agency/)). Lotus Brains Studio ranks for your target query with a comparison listicle — "AI Automation Agency New York: Best 15 Providers Compared."

The pattern is unambiguous: **in this niche, comparison content, cost content and case studies do the ranking.** Your six articles on `dobeu.space` are competent thought leadership on supply-chain software — but they target no commercial query, and they live on a domain you are not selling from.

### Gaps and opportunities

1. **Cost/pricing content** — nothing exists. Highest commercial intent, and disproportionately surfaced in AI answers.
2. **Comparison content** — "solo developer vs agency," "custom build vs Zapier," "AI agent vs chatbot." These are the decisions your buyers are stuck on, verbatim, in the community threads audited below.
3. **Vertical operator content** — your unique advantage. Nobody in the competitive set can write credibly about DOT compliance workflows or multi-unit restaurant inventory reconciliation.
4. **Case studies** — zero. Blocking everything.
5. **Objection content** — "will I be able to maintain what you build" is your best FAQ answer and deserves a full page; vendor lock-in is a top SMB fear.

### Article roadmap

| # | Title | Target keyword | Volume | Outline |
|---|---|---|---|---|
| 1 | What AI Automation Actually Costs a Small Business in 2026 | ai automation cost small business | **High** | Real market bands (setup $1,500–$5,000 single workflow; $5,000–$20,000 multi-system; retainers $500–$8,000/mo per [Taskip](https://taskip.net/ai-automation-agency-pricing/)) vs enterprise consulting bands ($15k–$60k discovery per [Clutch](https://clutch.co/consulting/ai/new-york)); what drives price; three worked examples; when not to spend |
| 2 | Solo Developer vs Agency vs Offshore: An Honest Comparison for SMB Owners | hire solo developer vs agency | **High** | Cost, speed, bus-factor, communication, what happens at handoff; when an agency genuinely is the right call; your referral-out policy as proof of honesty |
| 3 | You Own 5 AI Tools and Have Automated Nothing. Here's Why. | why ai tools not working small business | **High** | Anchored on the finding that 82% of SMBs use at least one AI tool and the median owner uses 5, yet usage is shallow ([SBE Council](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf)); tools vs workflows; the SOP prerequisite; pick-one-workflow method |
| 4 | Before You Automate: The 5 Processes Worth Documenting First | document processes before automation | Medium | Directly answers the top community objection that automation on undocumented processes "actually made things worse" ([r/smallbusinessUS](https://www.reddit.com/r/smallbusinessUS/comments/1snnq0t/starting_an_automation_service_for_small/)); includes a free downloadable worksheet as a lead magnet |
| 5 | When the Answer Isn't AI: Three Problems Better Solved by Fixing Your Data | when not to use ai business | Medium | Your credibility play, and the thing the best rival in your niche does best; inventory reconciliation, reporting, integration plumbing |
| 6 | Dispatch, Compliance, Invoicing: What Automating a 40-Truck Fleet Actually Looks Like | fleet operations automation | Medium | Your unrepeatable vertical content; hour-by-hour workflow teardown |
| 7 | Restaurant Group Back-Office Automation: A Multi-Unit Operator's Guide | restaurant automation multi location | Medium | Second vertical proof piece; scheduling, inventory variance, vendor invoices, daily P&L |
| 8 | Who Owns the Code? A Small Business Guide to Not Getting Locked In | who owns code developer builds | Low–Med | Turns your FAQ answer into a differentiator page; GitHub org ownership, credentials, docs, exit checklist |

### Draft article — priority #1

> **What AI Automation Actually Costs a Small Business in 2026**
>
> Nobody will tell you the price. That is not an accident.
>
> Ask ten "AI automation agencies" what a project costs and you will get ten variations of "it depends on scope." Sometimes that is honest — scope really does drive price. Mostly it is a negotiating position: if they do not name a number, they can size the number to how much they think you can pay.
>
> So here are the numbers, from published market data, with the ranges you should actually expect.
>
> **The three price tiers that exist**
>
> There are effectively three markets selling AI automation, and they are separated by roughly an order of magnitude.
>
> The **enterprise consulting tier** is what you find if you search for "AI consultants." Clutch, which lists 213 AI consulting companies in New York City alone, publishes the going bands: strategy and discovery engagements run $15,000–$60,000, proofs of concept $40,000–$150,000, end-to-end MVPs $120,000–$400,000 and up, with hourly rates of $150–$350+ and managed AI support at $10,000–$50,000 per month. These firms are competent. They are also priced for companies with a procurement department.
>
> The **SMB automation tier** is an order of magnitude lower. Market surveys of automation agency pricing put a single-workflow setup at $1,500–$5,000, multi-system integration at $5,000–$20,000, and ongoing retainers at $500–$8,000 per month, with productized packages between roughly $1,000 and $4,500 monthly. A small business retainer typically lands between $500 and $1,500 a month.
>
> The **DIY tier** is $20–$300 a month for Zapier, Make, an LLM subscription and your own evenings. For a genuinely simple workflow, this is the correct answer and anyone who tells you otherwise is selling.
>
> **What actually drives the number**
>
> Four things, in order of impact.
>
> *How many systems have to talk to each other.* One system is a script. Two systems with a clean API is a small project. Five systems, one of which is a 2011 on-premise database with no API, is a real project. The database is the price, not the AI.
>
> *Whether your process is written down.* This is the one nobody warns you about. If your team does the task five different ways depending on who is working, there is nothing to automate yet — and the first phase of the project becomes discovery you are paying for. Business owners who have been through this are blunt about it: automating an undocumented process tends to make the chaos faster, not smaller.
>
> *What happens when it is wrong.* An automation that drafts an internal summary can be wrong occasionally. One that sends a customer invoice cannot. Error handling, human review steps, logging and rollback are frequently more work than the happy path.
>
> *Whether AI is even required.* A meaningful share of what gets sold as "AI automation" is ordinary integration work with a language model bolted on for marketing purposes. One retail owner's widely-read critique of the category put it plainly: many small businesses need workflow automation, dashboards or plain software — not AI. If a vendor's first answer is a model rather than a question about your process, be careful.
>
> **Three worked examples**
>
> *Inbox and quote triage — roughly $2,000–$5,000, two to three weeks.* Inbound email is classified, urgent items are routed, routine quotes are drafted for human approval. One system, one clear decision, human in the loop. Typical return: five to ten hours a week for whoever currently reads the inbox first.
>
> *Order-to-invoice reconciliation — roughly $6,000–$15,000, three to six weeks.* Orders, delivery confirmations and invoices are matched across two or three systems, with exceptions escalated. Often the highest-return automation a distribution or food-service business can buy, because the current process is a person with two browser tabs and a spreadsheet. Frequently needs no AI at all — event-driven syncing and a single source of truth beats a prediction every time.
>
> *An internal tool your team keeps asking for — roughly $10,000–$30,000, four to eight weeks.* A real application: scheduling, compliance tracking, a customer portal. Priced like software because it is software, and it should be built to run for a decade.
>
> **How to buy without getting burned**
>
> Ask for a fixed-scope, fixed-price proposal before you commit to the build. Ask who owns the code and the accounts when it ships — the correct answer is you, in your own repository, with admin access on day one. Ask what happens if it does not work. Insist on one workflow first: a small, boring, high-frequency task, shipped and measured, before anyone proposes a platform.
>
> And ask the vendor to tell you when the answer is not AI. Anyone who cannot name a situation where they would talk you out of buying is not giving you advice.
>
> ---
> *At Dobeu, most projects land between $5,000 and $30,000, quoted as fixed scope and fixed price after a 30-minute call. The code lives in your GitHub organization with your admin access from day one. If your problem does not need AI, I will say so on the call.*
>
> **Sources:** [Clutch — Top AI Consultants in New York City](https://clutch.co/consulting/ai/new-york); [AI automation agency pricing survey](https://taskip.net/ai-automation-agency-pricing/); [SBE Council / TechnoMetrica Small Business Technology Use Survey, March 2026](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf); [r/automation — retail owner critique of AI automation agencies](https://www.reddit.com/r/automation/comments/1krm7i7/im_a_retail_business_owner_200kyr_here_are_what/).

---

## Reddit Growth

Reddit is your highest-value channel right now, because your buyers are asking for exactly your service in public, and the top-voted complaints are complaints you can credibly answer. Read the rules before posting: most of these subreddits ban promotion outright, so the play is genuine help with a profile link, not pitching.

### Target subreddits

`r/smallbusiness`, `r/automation`, `r/AI_Agents`, `r/smallbusinessUS`, `r/EntrepreneurRideAlong`, `r/nocode`, `r/msp`, plus `r/logistics` and `r/restaurateur` for your verticals.

### Specific threads and drafted replies

| Thread | Signal | Why it matters | Draft reply |
|---|---|---|---|
| **"Im a retail business owner (200k/yr) here are what 'ai automation agencies' are doing wrong"** — [r/automation](https://www.reddit.com/r/automation/comments/1krm7i7/im_a_retail_business_owner_200kyr_here_are_what/) | **179 upvotes, 87 comments — the highest-engagement thread found** | Top comments: orgs can't articulate what to automate (21 upvotes); proposals should show time/cost saved not jargon (17); most SMBs need RPA/dashboards/plain software not AI (11), and ~75% of "AI agencies" are white-label rebrands (8) | "The jargon point is the one that stings, because it's a self-inflicted wound. I've had discovery calls where the honest recommendation was 'your inventory numbers disagree because two systems sync on different schedules — fix the sync, no model needed.' That's a worse sale and a better outcome. My filter now: if I can't state the automation as 'X hours a week back, here's the before and after,' I don't propose it. What would you actually want to see in a proposal? A specific workflow with a measured baseline, or a menu?" |
| **"SMB Owner Seeking Automation Help"** — [r/automation](https://www.reddit.com/r/automation/comments/1lg6341/smb_owner_seeking_automation_help/) | 11 upvotes, 23 comments | OP wants someone to "evaluate our existing tasks and workflows to pinpoint areas that can be automated" — literally your discovery offer. Top objections: AI gets costly and messy if misused; it's not set-and-forget; document SOPs first | "Before hiring anyone, do this free: for one week, have each person log tasks they do more than three times a day and roughly how long each takes. You'll usually find two or three that account for most of the pain, and it makes any quote you get far more accurate. The 'not set-and-forget' warning above is right — budget for maintenance from day one, or you'll have an automation nobody trusts in six months. Happy to look at your list and tell you which items are genuinely worth paying for, no pitch." |
| **"Has anyone actually used AI agents to automate real work in their business - or is it still overhyped?"** — [r/smallbusiness](https://www.reddit.com/r/smallbusiness/comments/1r6r9fg/has_anyone_actually_used_ai_agents_to_automate/) | 37 comments | Top objections: setup is technical, not instant (3 upvotes); vendor astroturfing suspicion (2); wasted time and money without oversight (2). **Note the astroturf sensitivity — arrive with a real history or don't arrive** | "Both, depending on the task. Works: classification and routing where a wrong answer is cheap and a human sees it anyway — inbox triage, ticket tagging, first-draft quotes. Doesn't work: anything where a wrong answer goes straight to a customer or a ledger without review. The overhyped part is the word 'agent.' Most of the value in the projects I've done is boring integration plumbing with a model doing one small judgment step in the middle." |
| **"Starting an automation service for small businesses — do owners want done-for-you or DIY?"** — [r/smallbusinessUS](https://www.reddit.com/r/smallbusinessUS/comments/1snnq0t/starting_an_automation_service_for_small/) | Peer/positioning thread | Top comment (3 upvotes): owners are "more budget-conscious" and want to stay hands-on and collaborative. Another: without organized workflows and SOPs, automation "actually made things worse" | "The pattern I see: done-for-you build, DIY operation. Owners don't want to maintain a Make scenario, but they absolutely want to understand it and change a threshold without calling anyone. So I hand over documentation and a walkthrough as a deliverable, not an afterthought. The budget point is real — a sub-$5k entry engagement that ships one workflow beats a $20k proposal nobody signs." |
| **"Small business owners who hired a developer, how did you find them?"** — [r/smallbusiness](https://www.reddit.com/r/smallbusiness/comments/1qq86kc/small_business_owners_who_hired_a_developer_how/) | 25 comments | Complaints: off-the-shelf tools "prohibitively priced or lacked essential features"; time-zone friction with remote devs; generic inventory tools can't meet specific needs | "Two things buyers under-weight: local/overlapping-hours matters more than people expect for the first project, and the build-vs-buy math flips faster than you'd think. If off-the-shelf covers 80% of what you need, buy it and automate the gap. Custom is worth it when the missing 20% is the part that actually costs you money." |
| **"Business Owner Looking to Implement AI Solutions"** — [r/AI_Agents](https://www.reddit.com/r/AI_Agents/comments/1ixtp07/business_owner_looking_to_implement_ai_solutions/) | Direct buying intent | High-intent owners asking where to start | Lead with the one-week task-log exercise; offer a specific first workflow recommendation |
| **"Anyone here actually make money doing AI automation for..."** — [r/automation](https://www.reddit.com/r/automation/comments/1vk3aig/anyone_here_actually_make_money_doing_ai/) | Peer thread | Where practitioners compare notes; useful for building comment history before you post anything commercial | Share real pricing and what didn't work — earns standing fast |

**Method:** spend two to three weeks answering only, with no links, building a visible history. Put your site in your Reddit profile, not in comments. Post the cost article as a text post (full content inline, link at the bottom) only in subreddits that permit it. Never post the same content to multiple subreddits the same day.

---

## X / Twitter Growth

Be realistic: X is a **credibility mirror**, not a lead source, for a $5k–$30k local services business. SMB owners in New Jersey are not on X looking for automation help. Its value is that a founder or peer who is evaluating you will check whether you exist. Right now no X account is linked anywhere on dobeu.net, and `twitter:site` / `twitter:creator` are both absent from the meta tags — so your Twitter cards render without attribution.

If you invest here, invest small and consistently. The build-in-public motion for AI/dev audiences is well documented ([Ciela — getting AI agency clients on X](https://ciela.ai/blogs/how-to-get-ai-agency-clients-on-twitter-x), [Marketing Skills — X strategy for developer audiences](https://www.marketingskills.sh/jonathimer/devmarketing-skills/x-devs)) but it rewards technical-audience content, which points at Angle 3 (founders), not at SMBs.

### Accounts and communities to engage

- **Tool ecosystems you actually build on:** Anthropic/Claude developer accounts, Vercel, Supabase, Composio, and the MCP developer community. Reply with real implementation detail — this is where your craft is legible.
- **Solo-operator and productized-service voices:** the Designjoy-style one-person-studio cohort. Adjacent audience, generous with amplification, and directly relevant to your "one operator" positioning.
- **Build-in-public communities:** the [Build in Public community on X](https://x.com/i/communities/1493446837214187523) is the standing venue for shipping updates.
- **NJ/NYC small-business and local-operator accounts:** low follower counts, high relevance. This is the only genuinely SMB-adjacent slice of X.

### Drafted content

**Launch post:**
> Rebuilt dobeu.net around a harder question: what would a small business actually pay me for?
>
> Not "AI agents." Fewer hours spent chasing invoices, matching orders, retyping the same data between two systems.
>
> Fixed scope. Fixed price. $5k–$30k. Code ships to your GitHub, your admin, day one.
>
> First two case studies going up this month. 🧵

**Reply templates:**

1. *On an "AI is overhyped for SMBs" post:* "Mostly agreed, with one carve-out. The overhyped part is 'agent.' The unhyped part is that most SMBs have two systems that don't talk, and a person whose job is being the API between them. Fixing that pays for itself and often needs no model at all."
2. *On someone shipping an agent build:* offer a specific technical note from your own stack — tool-call retry handling, verification loops, cost control. Concrete detail, no pitch.
3. *On a "hire an agency vs a freelancer" post:* "Third option people skip: one senior operator on fixed scope. You lose bench depth and gain a bus-factor risk — worth being upfront about. What you get is that the person on the call is the person writing the code, and decisions happen in hours. I turn work down and refer out when I'm booked, which is the tradeoff being honest about it requires."

**Keywords and hashtags:** hashtags do little on X now; optimize for keywords in the post body instead — `AI automation`, `MCP`, `Claude`, `Supabase`, `internal tools`, `small business automation`, `fractional CTO`, `NJ small business`. Follow the searches, not the tags.

**Fix first:** add `twitter:site` and `twitter:creator` meta tags once the account exists, and add the profile to `Person.sameAs`.

---

## Hacker News Strategy

HN is the wrong channel for SMB lead generation and the right channel for one specific thing: **technical credibility that everyone else can then cite.** Set expectations accordingly.

### What the research shows

A recent "Show HN: AI agents run my one-person company" post drew exactly the reception you would want to avoid: commenters questioned authenticity ("In a six-minute time period, you posted 10 different comments here… I don't believe you are being truthful"), the ROI of the automation itself ("You're spending 7% of your free tier limit just to keep an 'audience' of 27 accounts on life support"), and — most damning — the absence of a clear product: "So you made 4 agents, a website for a company that says the make agents - but what's the product/service?" ([Hacker News](https://news.ycombinator.com/item?id=47296664)).

The lesson is direct: **HN punishes a consultancy launch and rewards a working artifact.** Do not "Show HN" your studio. Show HN something people can run.

### Recommended approach

**Do not post a Show HN for dobeu.net.** A one-person consultancy landing page with mocked demos and no case studies is precisely the shape that thread's commenters tore apart.

**Instead, ship one genuinely useful open-source tool and Show HN that.** You already have the raw material — 86 public repos, an MCP integration practice, and a design-token round-tripping workflow — but it currently reads as forks and scaffolds at 0 stars. Pick one, make it excellent, document it properly, and lead with the tool. The consultancy is then a line in your profile, which is exactly how this channel is supposed to work.

**Title variations for that launch:**

- *Concise:* "Show HN: A CLI that turns Figma design tokens into Tailwind, Framer and Webflow"
- *Technical:* "Show HN: MCP server for [specific integration], with verification loops and cost caps"
- *Value-oriented:* "Show HN: I open-sourced the agent scaffolding I use on client work"

**Post body pattern:**
> I build automation and internal tools for small operators — distribution, logistics, food service — and I kept rewriting the same [X] on every project, so I extracted it.
>
> It does [specific capability]. The parts I think are actually interesting: [technical decision one, and why the obvious approach fails], and [technical decision two]. Here's what it does not do, and why: [honest limitations].
>
> Built with [stack]. MIT. I'd particularly like feedback on [specific design question] — I went back and forth on it and I'm not sure I chose right.

Name the real constraint, admit what is unfinished, and ask a genuine question. Vague launches get flagged.

**Timing:** weekday mornings US Eastern, roughly 8–10 am ET, is the conventional window for Show HN visibility. Post once, do not resubmit, and stay in the thread answering substantively — but do not flood it, which is exactly what commenters called out above.

**Existing threads worth participating in:** the monthly **"Ask HN: Who wants to be hired?"** threads ([March 2026](https://news.ycombinator.com/item?id=47219667), [May 2026](https://news.ycombinator.com/item?id=47975570)) are legitimate, expected places to list yourself. Post a tight entry — Location / Remote / Technologies / Résumé / Email — and mention the vertical specialization, since that is what makes an entry memorable among hundreds.

---

## Priority Action Items

Ranked by severity against effort. Do the top block this week.

| Action Item | Category | Severity | Effort | Priority |
|---|---|---|---|---|
| Fix contrast on "No agency overhead" chip (1.60:1) and "Tell me about your project" link (1.25:1) | Accessibility | Critical | Low | **1** |
| Remove `aria-live` from inside the `<h1>` typewriter; render final text, `aria-hidden` the animation | Accessibility | Critical | Low | **2** |
| Remove `dobeutech.com` from the footer; fix or remove `dobeu.cloud` (404) and `dobeu.dev` (TLS failure) | SEO / Brand | Critical | Low | **3** |
| Correct `Person.sameAs` to your real LinkedIn and GitHub URLs | SEO / GEO | High | Low | **4** |
| Pick one canonical location (NYC vs Neptune City) and apply it identically across all properties | SEO / GEO | Critical | Low | **5** |
| Rewrite the H1 and hero subhead to be outcome-led for SMBs | Brand | Critical | Low | **6** |
| Publish 2 case studies with hard before/after metrics | Content / Brand | Critical | Medium | **7** |
| Add 3 named testimonials to the homepage | Brand | Critical | Low | **8** |
| Split the anchor sections into real indexable pages (4 service pages, about, process, pricing, case studies) | SEO | Critical | Medium | **9** |
| Publish `/pricing` with visible tiers and add a sub-$5k paid diagnostic entry offer | Brand / SEO | Critical | Medium | **10** |
| Move the cookie banner off the primary CTA cluster | Performance / CRO | High | Low | **11** |
| Consolidate analytics: keep one product-analytics tool, drop the redundant three plus session RUM | Performance | High | Low | **12** |
| Fix the missing space in the H1 DOM ("Jeremy.I ship") and add `aria-label` to the icon-only button | Accessibility / SEO | Medium | Low | **13** |
| Raise `text-muted-foreground` contrast tokens (2.08:1 and 2.91:1 failures) | Accessibility | High | Low | **14** |
| Add `ProfessionalService` + `Service` + `Offer` schema with `areaServed` and the $5k–$30k `priceRange` | SEO / GEO | High | Low | **15** |
| Link `dobeu.tech` from the main nav, or fold the coaching offer into dobeu.net as the SMB entry point | Brand / Growth | High | Low | **16** |
| Claim Clutch and G2 profiles; secure 3 reviews | GEO / Brand | High | Medium | **17** |
| Publish the AI-automation-cost article and the solo-vs-agency comparison | Content | High | Medium | **18** |
| Migrate or cross-publish `dobeu.space` content to `dobeu.net/insights` with correct canonicals | SEO | High | Medium | **19** |
| Trim the 41 KB polyfill chunk and audit the three 45–56 KB vendor chunks (281 KB total JS) | Performance | Medium | Medium | **20** |
| Defer the shader hero animation until after LCP | Performance | Medium | Medium | **21** |
| Begin Reddit participation in `r/smallbusiness`, `r/automation`, `r/AI_Agents` — answer only for 2–3 weeks | Reddit | High | Medium | **22** |
| Rename `/labs` to `/experiments`; give the portfolio slot to real work | SEO / Brand | Medium | Low | **23** |
| Replace CSP `'unsafe-inline'`/`'unsafe-eval'` with nonce-based script policy | Performance / Security | Medium | Medium | **24** |
| Substantiate or retire the "50+ projects shipped" claim | Brand | Medium | Low | **25** |
| Fix `<h6>` article titles on `dobeu.space/blog` | Accessibility / SEO | Medium | Low | **26** |
| `noindex` or enrich the thin `/repos` page | SEO | Medium | Low | **27** |
| Ship one polished open-source tool, then Show HN it | Hacker News | Medium | High | **28** |
| Create an X account; add `twitter:site`/`twitter:creator`; begin build-in-public cadence | X / Twitter | Low | Medium | **29** |
| Remove `<meta name="keywords">`; emit true per-page `lastmod` | SEO | Low | Low | **30** |

---

## Conclusion

### Assessment

dobeu.net is a well-engineered site with a marketing problem, not a marketing site with an engineering problem — which is the better problem to have, because the expensive part is already done. The security posture, performance foundations, structured data hygiene and AI-crawler configuration are ahead of every competitor examined here. What is missing is entirely on the commercial layer: proof, plain-English positioning, indexable pages, a published price, and any evidence that exists outside your own domain.

### Key themes

**One. You are selling the ingredients, not the meal.** "Claude + Composio + MCP" is a supplier list. SMB owners buy hours back and errors gone. The market told you this explicitly at 17 upvotes: show reduced time or cost, not technical language. Every competitor beating you in search leads with an outcome in the headline.

**Two. Proof is the binding constraint, and it is not a hard one.** Your closest rival — also one person, also NYC, also SMB-focused — wins on three case studies with numbers. You have shipped work; you have simply not written it down. Two case studies and three testimonials would move you further than a month of engineering.

**Three. Your moat is the background you are not mentioning.** Transportation safety, fleet operations, multi-unit restaurant management. Of the 213 AI consulting firms Clutch lists in NYC, none can say they have run a safety program or closed a restaurant month. That is a vertical wedge, it is unrepeatable, and dobeu.net does not mention it once.

**Four. Consolidate or keep leaking.** Five domains, one of them non-existent and advertised in your footer, another failing TLS, your only real content on a sister site, your best SMB offer orphaned on a third domain, and a "GitHub org" that is a personal account. Every one of these splits authority and gives a careful buyer a reason to hesitate.

**Five. GEO is your natural advantage — you are one layer of evidence away.** You already let the AI crawlers in and ship extractable FAQ schema. You surface at position 1 for your own name and nowhere for the queries that matter, because generative engines cite what third parties say about you and no third party has said anything yet. Clutch, a review profile, a listicle inclusion and two guest mentions would change that measurably.

### Next steps

**This week (all low-effort):** fix the two critical contrast failures and the `aria-live` heading; remove the dead domains from the footer; correct the LinkedIn `sameAs`; pick one location; rewrite the H1.

**This month:** publish two case studies and three testimonials; split the anchors into real pages; publish `/pricing` with a sub-$5k diagnostic tier; move the cookie banner; consolidate analytics; link or absorb `dobeu.tech`.

**This quarter:** commit to one primary position — the vertical operations angle is the strongest — and rewrite the site around it; publish the cost and comparison articles; claim Clutch and G2 and earn three reviews; begin genuine Reddit participation; migrate the Supply Journal onto dobeu.net.

**A note on sequencing:** do not start the performance work before the positioning and proof work. Shaving 100 KB of JavaScript from a page that does not convert changes nothing. Fix what the page says, add the evidence that makes it believable, then optimize how fast it loads.

---

### Sources

[Gartner AI spending forecast 2026 (Business Wire)](https://www.businesswire.com/news/home/20260519405832/en/Gartner-Forecasts-Worldwide-AI-Spending-to-Grow-47-in-2026) · [SBE Council / TechnoMetrica Small Business Technology Use Survey, March 2026](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf) · [Clutch — Top AI Consultants in New York City](https://clutch.co/consulting/ai/new-york) · [AI automation agency pricing survey](https://taskip.net/ai-automation-agency-pricing/) · [Business Mechanic](https://www.biz-mech.com/) · [AI Consultant NYC](https://aiconsultantnyc.com/) · [NeuralEdge Consulting](https://www.neuraledge-consulting.ai/) · [AI Agency NY](https://www.aiagencyny.com/ai-consulting-new-york-ai-agency) · [CTO Fraction](https://ctofraction.com/) · [Designjoy](https://www.designjoy.co/) · [thoughtbot](https://thoughtbot.com/) · [84EM — solo developer vs agency](https://84em.com/blog/hiring-solo-developer-vs-agency/) · [r/automation — retail owner critique](https://www.reddit.com/r/automation/comments/1krm7i7/im_a_retail_business_owner_200kyr_here_are_what/) · [r/automation — SMB owner seeking automation help](https://www.reddit.com/r/automation/comments/1lg6341/smb_owner_seeking_automation_help/) · [r/smallbusiness — AI agents overhyped?](https://www.reddit.com/r/smallbusiness/comments/1r6r9fg/has_anyone_actually_used_ai_agents_to_automate/) · [r/smallbusinessUS — done-for-you vs DIY](https://www.reddit.com/r/smallbusinessUS/comments/1snnq0t/starting_an_automation_service_for_small/) · [r/smallbusiness — how owners find developers](https://www.reddit.com/r/smallbusiness/comments/1qq86kc/small_business_owners_who_hired_a_developer_how/) · [r/AI_Agents — business owner implementing AI](https://www.reddit.com/r/AI_Agents/comments/1ixtp07/business_owner_looking_to_implement_ai_solutions/) · [Hacker News — Show HN one-person company](https://news.ycombinator.com/item?id=47296664) · [Ask HN: Who wants to be hired (March 2026)](https://news.ycombinator.com/item?id=47219667) · [Ask HN: Who wants to be hired (May 2026)](https://news.ycombinator.com/item?id=47975570) · [WCAG 2.1 contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) · [Google — keywords meta tag not used](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag) · [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) · [RFC 9309 Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html) · [web.dev — TTFB](https://web.dev/articles/ttfb) · [web.dev — performance budgets](https://web.dev/articles/performance-budgets-101) · [web.dev — third-party JavaScript](https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript) · [Ciela — AI agency clients on X](https://ciela.ai/blogs/how-to-get-ai-agency-clients-on-twitter-x) · [X strategy for developer audiences](https://www.marketingskills.sh/jonathimer/devmarketing-skills/x-devs) · [Build in Public community on X](https://x.com/i/communities/1493446837214187523) · Direct measurements of https://dobeu.net (HTTP headers, [robots.txt](https://dobeu.net/robots.txt), [sitemap.xml](https://dobeu.net/sitemap.xml), rendered screenshot pixel sampling, [GitHub API](https://api.github.com/users/dobeutech)), August 29–30, 2026.

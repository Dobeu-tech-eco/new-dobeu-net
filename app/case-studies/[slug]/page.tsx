import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { approvedMetrics, getShippedWork, SHIPPED_WORK } from "@/lib/jeremy-data";
import { breadcrumbListJsonLd } from "@/lib/marketing-schema";

export function generateStaticParams() {
  return SHIPPED_WORK.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getShippedWork(slug);
  if (!item) return { title: "Case study not found" };
  return {
    title: `${item.name} — case study`,
    description: item.description,
    alternates: { canonical: `/case-studies/${item.slug}` },
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getShippedWork(slug);
  if (!item) notFound();

  const metrics = approvedMetrics(item);

  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", path: "/" },
          { name: "Case studies", path: "/case-studies" },
          { name: item.name, path: `/case-studies/${item.slug}` },
        ])}
      />
      <MarketingPageHeader
        eyebrow={item.vertical}
        title={item.name}
        description={item.description}
      />
      <article className="container max-w-6xl pb-16 space-y-8">
        {metrics.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <li key={metric.label} className="rounded-2xl border border-border/40 p-6">
                <p className="font-display text-4xl font-extrabold tracking-tight">{metric.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{metric.label}</p>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Vertical</dt>
            <dd className="font-medium text-foreground">{item.vertical}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Year</dt>
            <dd className="font-medium text-foreground">{item.year}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stack</dt>
            <dd className="font-medium text-foreground">{item.stack.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Public repo</dt>
            <dd>
              <a
                href={item.github}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                {item.github.replace("https://github.com/", "")}
              </a>
            </dd>
          </div>
        </dl>

        <EstimateCtas location={`case-studies/${item.slug}`} />
        <p className="text-sm text-muted-foreground">
          <Link href="/case-studies" className="underline underline-offset-4 hover:text-foreground">
            All case studies
          </Link>
        </p>
      </article>
    </MarketingShell>
  );
}

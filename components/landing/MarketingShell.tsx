import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";

export function MarketingShell({
  children,
  stickyCta = false,
}: {
  children: React.ReactNode;
  stickyCta?: boolean;
}) {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="flex flex-col">
        {children}
      </main>
      <SiteFooter />
      {stickyCta ? <StickyMobileCTA /> : null}
    </LightboxProvider>
  );
}

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="container max-w-6xl pt-16 pb-4 md:pt-20 md:pb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        {eyebrow}
      </p>
      <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
        {description}
      </p>
    </header>
  );
}

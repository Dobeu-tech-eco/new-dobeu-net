import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { ConfirmLeadButton } from "./ConfirmLeadButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your message",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: raw } = await searchParams;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="container max-w-xl py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Confirm your message</h1>
        {token ? (
          <>
            <p className="mt-4 text-muted-foreground">
              Press the button to confirm your email address and send your message.
              Nothing is sent until you do.
            </p>
            <ConfirmLeadButton token={token} />
          </>
        ) : (
          <p className="mt-4 text-muted-foreground">
            This confirmation link is missing its token. Open the link from your
            email again, or{" "}
            <Link href="/" className="underline underline-offset-4">
              head back home
            </Link>
            .
          </p>
        )}
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}

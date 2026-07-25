"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the console for local debugging; production digest links the
    // server-side log entry without leaking internals to the user.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground px-6 text-center">
      <p className="text-sm font-mono text-muted-foreground tracking-widest">500</p>
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred. You can try again, or come back later.
        {error.digest ? (
          <span className="block mt-2 font-mono text-xs">Ref: {error.digest}</span>
        ) : null}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}

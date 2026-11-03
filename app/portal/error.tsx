"use client";

export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
    >
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground mt-1">
        We couldn&apos;t load this page. Try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

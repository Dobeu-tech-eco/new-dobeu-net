"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-bold">
        Unable to load this admin page
      </h1>
      <p role="alert" className="text-sm text-muted-foreground">
        Something went wrong. Try loading the page again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

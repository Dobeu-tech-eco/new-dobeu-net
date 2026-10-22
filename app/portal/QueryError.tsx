export function QueryError({ what }: { what: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <p className="font-semibold text-sm text-destructive">
        Couldn&apos;t load {what}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        This is a problem on our side, not an empty list. Refresh to try again.
      </p>
    </div>
  );
}

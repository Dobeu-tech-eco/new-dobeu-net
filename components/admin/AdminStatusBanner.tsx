export type AdminStatusParams = { error?: string; ok?: string };

export function AdminStatusBanner({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }

  if (success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm"
      >
        {success}
      </p>
    );
  }

  return null;
}

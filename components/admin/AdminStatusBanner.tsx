import { adminErrorMessage } from "@/lib/admin-status";

export type AdminStatusParams = { error?: string; ok?: string };

export function AdminStatusBanner({
  error,
  loadError,
  success,
}: {
  error?: string | null;
  // Fixed page-owned copy for a real read failure, independent of URL feedback.
  loadError?: string | null;
  success?: string | null;
}) {
  const hasError = error != null;
  return (
    <>
      {hasError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {adminErrorMessage(error)}
        </p>
      )}
      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}
      {!hasError && !loadError && success && (
        <p
          role="status"
          className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm"
        >
          {success}
        </p>
      )}
    </>
  );
}

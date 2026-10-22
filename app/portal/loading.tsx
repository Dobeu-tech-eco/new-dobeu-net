export default function PortalLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

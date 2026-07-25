import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground px-6 text-center">
      <p className="text-sm font-mono text-muted-foreground tracking-widest">404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/portal">Client portal</Link>
        </Button>
      </div>
    </main>
  );
}

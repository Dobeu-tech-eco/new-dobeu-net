import Link from "next/link";
import { DobeuMark } from "@/components/brand/DobeuMark";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border py-12 mt-12">
      <div className="container max-w-6xl">
        <div className="flex flex-col md:flex-row gap-8 md:items-start md:justify-between">
          <div className="flex items-start gap-3 max-w-sm">
            <DobeuMark className="h-10 w-10 shrink-0" />
            <div>
              <p className="font-display text-lg font-bold lowercase">dobeu tech solutions</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ship the agent. Ship the app. Ship the brand. One operator, modern stack.
              </p>
            </div>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm" aria-label="Footer">
            <div>
              <p className="font-semibold mb-2">Site</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><Link href="/#work" className="hover:text-foreground">Work</Link></li>
                <li><Link href="/#how" className="hover:text-foreground">How it works</Link></li>
                <li><Link href="/#about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/#faq" className="hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">Account</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Log in</Link></li>
                <li><Link href="/portal" className="hover:text-foreground">Client portal</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">Contact</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><a href="mailto:jeremyw@dobeu.net" className="hover:text-foreground">jeremyw@dobeu.net</a></li>
                <li><a href="https://www.linkedin.com/in/jeremy-williams" className="hover:text-foreground" target="_blank" rel="noreferrer">LinkedIn</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p>© {year} Dobeu Tech Solutions LLC. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <a href="https://status.dobeu.net" target="_blank" rel="noreferrer" className="hover:text-foreground">
              Status
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

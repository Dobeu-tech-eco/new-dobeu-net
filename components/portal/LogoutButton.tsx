"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetAnalyticsUser } from "@/lib/analytics";
import { shutdownIntercom } from "@/lib/intercom";

export function LogoutButton() {
  const router = useRouter();
  async function handle() {
    // Clear the Messenger session before the auth session so the next person
    // on this device cannot read the previous user's conversations.
    shutdownIntercom();
    const supabase = createClient();
    await supabase.auth.signOut();
    // Detach analytics identity so the next visitor on this device is anonymous.
    resetAnalyticsUser();
    router.push("/");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}

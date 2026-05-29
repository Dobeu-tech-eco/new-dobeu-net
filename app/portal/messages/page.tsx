import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("id,thread_id,from_user_id,to_user_id,body,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Messages
        </h1>
        <p className="text-muted-foreground mt-1">
          Async messages to and from Jeremy. Replies usually within 24 hours.
        </p>
      </header>

      {!messages || messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Once we start a project, this thread becomes your direct line.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground mb-1">
                {new Date(m.created_at).toLocaleString()}
                {!m.read_at && " · unread"}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

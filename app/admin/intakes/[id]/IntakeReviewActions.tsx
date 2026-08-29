"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveIntake, markIntakeReviewed } from "@/lib/actions/intakes";

type IntakeStatus = "new" | "reviewed" | "archived";

const ACTION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  not_authenticated: "Sign in again before updating this intake.",
  forbidden: "Your account is not allowed to update this intake.",
  mfa_required: "Complete MFA verification before updating this intake.",
  "invalid id": "This intake link is invalid.",
  "notes too long": "Review notes must be 4,000 characters or fewer.",
  intake_not_found_or_invalid_transition:
    "This intake changed or is no longer available for that action. Refresh and try again.",
  intake_update_failed: "Unable to update intake. Try again.",
};

function actionErrorMessage(code: string): string {
  return ACTION_ERROR_MESSAGES[code] ?? "Unable to update intake. Try again.";
}

export function IntakeReviewActions({
  intakeId,
  status,
  initialNotes,
}: {
  intakeId: string;
  status: IntakeStatus;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: "review" | "archive") {
    if (
      action === "archive" &&
      !window.confirm(
        "Archive this intake? It will remain available in the archived queue.",
      )
    ) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const result =
          action === "review"
            ? await markIntakeReviewed({ id: intakeId, notes })
            : await archiveIntake({ id: intakeId, notes });

        if (!result.ok) {
          setFeedback({
            kind: "error",
            text: actionErrorMessage(result.error),
          });
          return;
        }

        setFeedback({
          kind: "success",
          text:
            action === "review"
              ? "Intake marked reviewed."
              : "Intake archived.",
        });
        router.refresh();
      } catch {
        setFeedback({
          kind: "error",
          text: "Unable to update intake. Try again.",
        });
      }
    });
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run("review");
  }

  return (
    <form onSubmit={submitReview} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="review-notes" className="text-sm font-medium">
          Review notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="review-notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={4000}
          rows={5}
          disabled={pending || status === "archived"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Document mapping decisions, missing details, or follow-up needed."
        />
        <p className="text-xs text-muted-foreground">
          {notes.length.toLocaleString()} / 4,000
        </p>
      </div>

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            feedback.kind === "error"
              ? "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              : "rounded-md border border-accent/30 bg-accent/5 p-3 text-sm"
          }
        >
          {feedback.text}
        </p>
      )}

      {status === "archived" ? (
        <p className="text-sm font-medium">
          This intake is archived and cannot be reopened.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : status === "reviewed"
                ? "Save review"
                : "Mark reviewed"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => run("archive")}
          >
            Archive intake
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        These controls only update the internal review state and audit log. They
        do not calculate pricing or notify the submitter.
      </p>
    </form>
  );
}

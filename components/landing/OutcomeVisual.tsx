import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";

export function OutcomeVisual({ index }: { index: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-muted p-6 text-dobeu-indigo-500"
    >
      {index === 0 && (
        <div className="flex w-full max-w-56 flex-col gap-3 rounded-md border border-current/30 bg-background p-5">
          {["w-4/5", "w-3/5", "w-full", "w-2/5"].map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="size-3 shrink-0 rounded-sm border border-current/50" />
              <span className={`h-2 rounded-pill bg-current/30 ${width}`} />
            </div>
          ))}
        </div>
      )}
      {index === 1 && (
        <div className="flex items-center gap-4">
          <Users className="size-12 stroke-1" />
          <ArrowRight className="size-8 stroke-1" />
          <div className="flex size-20 items-center justify-center rounded-md border border-current/30 bg-background">
            <FileText className="size-10 stroke-1" />
          </div>
        </div>
      )}
      {index === 2 && (
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="flex size-14 items-center justify-center rounded-pill border border-current/40 bg-background"
            >
              <Check className="size-6" />
            </div>
          ))}
        </div>
      )}
      {index === 3 && (
        <div className="flex items-center gap-5">
          <div className="flex flex-col gap-2 rounded-md border border-current/30 bg-background p-4">
            <FileText className="size-10 stroke-1" />
            <span className="h-1 w-10 rounded-pill bg-current/30" />
          </div>
          <ClipboardCheck className="size-14 stroke-1" />
        </div>
      )}
    </div>
  );
}

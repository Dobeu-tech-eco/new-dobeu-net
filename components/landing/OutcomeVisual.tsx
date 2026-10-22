"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";
import { useExperience } from "./ExperienceProvider";
import {
  clamp01,
  elementViewpointProgress,
  itemCheckProgress,
  readViewportHeight,
} from "./viewpoint";

const brandSignal = "hsl(var(--dobeu-violet-500))";
const quietBorder = "hsl(var(--dobeu-violet-500) / 0.35)";
const panelBackground = "hsl(var(--background))";
const successSignal = "hsl(122 39% 49%)";
const successBackground = "hsl(122 39% 49% / 0.12)";
const successBorder = "hsl(122 39% 49% / 0.55)";

const driverTasks = [
  "Licence verified",
  "Vehicle check complete",
  "Hazard module passed",
  "Trainer sign-off logged",
];

function percent(progress: number) {
  return (clamp01(progress) * 100).toFixed(1);
}

function lerp(from: number, to: number, progress: number) {
  const t = clamp01(progress);
  return from + (to - from) * t;
}

function tone(progress: number): CSSProperties {
  const checked = percent(progress);
  const info = percent(1 - progress);
  return {
    color: `color-mix(in srgb, ${successSignal} ${checked}%, ${brandSignal} ${info}%)`,
    borderColor: `color-mix(in srgb, ${successBorder} ${checked}%, ${quietBorder} ${info}%)`,
    backgroundColor: `color-mix(in srgb, ${successBackground} ${checked}%, ${panelBackground} ${info}%)`,
  };
}

function phaseFor(progress: number) {
  if (progress <= 0.02) return "info";
  if (progress >= 0.98) return "checked";
  return "checking";
}

function useIllustrationProgress(ref: RefObject<HTMLDivElement | null>) {
  const { stopped } = useExperience();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (stopped) return;
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let last = -1;
    const update = () => {
      const next = elementViewpointProgress(
        node.getBoundingClientRect().top,
        readViewportHeight(),
      );
      const settled = next === 0 || next === 1;
      if (!settled && Math.abs(next - last) < 0.008) return;
      last = next;
      setProgress(next);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [ref, stopped]);

  return stopped ? 1 : progress;
}

function DriverTasks({ progress }: { progress: number }) {
  return (
    <div
      className="flex w-full max-w-64 flex-col gap-3 rounded-md border p-4 text-xs"
      style={tone(progress)}
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-current/70">
        <span>Driver tasks</span>
        <span>Live</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {driverTasks.map((task, taskIndex) => {
          const checked = itemCheckProgress(
            progress,
            taskIndex,
            driverTasks.length,
          );
          return (
            <li
              key={task}
              className="flex min-w-0 items-center gap-2 text-current"
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-current">
                <Check
                  className="size-2.5"
                  style={{
                    opacity: checked,
                    transform: `scale(${lerp(0.6, 1, checked)})`,
                  }}
                />
              </span>
              <span className="relative min-w-0 flex-1 text-left leading-tight">
                <span className="block truncate">{task}</span>
                <span
                  className="absolute left-0 top-1/2 h-px w-full origin-left bg-current"
                  style={{ transform: `scaleX(${checked})` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Handoff({ progress }: { progress: number }) {
  const people = itemCheckProgress(progress, 0, 3);
  const arrow = itemCheckProgress(progress, 1, 3);
  const document = itemCheckProgress(progress, 2, 3);
  return (
    <div className="flex items-center gap-4">
      <Users
        className="size-12 stroke-1"
        style={{
          color: tone(people).color,
          opacity: lerp(0.72, 1, people),
          transform: `translateX(${lerp(-10, 0, people)}px)`,
        }}
      />
      <ArrowRight
        className="size-8 stroke-1"
        style={{
          color: tone(arrow).color,
          opacity: lerp(0.45, 1, arrow),
          transform: `scaleX(${lerp(0.7, 1, arrow)})`,
        }}
      />
      <div
        className="flex size-20 items-center justify-center rounded-md border"
        style={{
          ...tone(document),
          opacity: lerp(0.78, 1, document),
          transform: `translateX(${lerp(10, 0, document)}px)`,
        }}
      >
        <FileText className="size-10 stroke-1" />
      </div>
    </div>
  );
}

function ApprovalChecks({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-3">
      {[0, 1, 2].map((item) => {
        const checked = itemCheckProgress(progress, item, 3);
        return (
          <div
            key={item}
            className="flex size-14 items-center justify-center rounded-pill border"
            style={{
              ...tone(checked),
              transform: `scale(${lerp(0.95, 1, checked)})`,
            }}
          >
            <Check
              className="size-6"
              style={{
                opacity: checked,
                transform: `scale(${lerp(0.6, 1, checked)})`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Handover({ progress }: { progress: number }) {
  const signed = itemCheckProgress(progress, 1, 2);
  return (
    <div className="flex items-center gap-5">
      <div
        className="flex flex-col gap-2 rounded-md border p-4"
        style={{
          ...tone(progress),
          transform: `translate(${lerp(-34, 0, progress)}px, ${lerp(-12, 0, progress)}px) rotate(${lerp(-4, 0, progress)}deg)`,
        }}
      >
        <FileText className="size-10 stroke-1" />
        <span className="h-1 w-10 rounded-pill bg-current/40" />
      </div>
      <ClipboardCheck
        className="size-14 stroke-1"
        style={{
          color: tone(signed).color,
          opacity: lerp(0.45, 1, signed),
          transform: `scale(${lerp(0.92, 1, signed)})`,
        }}
      />
    </div>
  );
}

function Illustration({
  index,
  progress,
}: {
  index: number;
  progress: number;
}) {
  if (index === 0) return <DriverTasks progress={progress} />;
  if (index === 1) return <Handoff progress={progress} />;
  if (index === 2) return <ApprovalChecks progress={progress} />;
  return <Handover progress={progress} />;
}

export function OutcomeVisual({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useIllustrationProgress(ref);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-viewpoint={progress.toFixed(2)}
      data-phase={phaseFor(progress)}
      className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-muted p-5 text-dobeu-indigo-500 sm:p-6"
    >
      <Illustration index={index} progress={progress} />
    </div>
  );
}

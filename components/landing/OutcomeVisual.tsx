"use client";

import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useExperience } from "./ExperienceProvider";

const viewport = { once: true, amount: 0.6 } as const;
const brandSignal = "hsl(var(--dobeu-violet-500))";
const quietSignal = "hsl(var(--dobeu-violet-500) / 0.3)";
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

function scrollProps(
  stopped: boolean,
  hidden: Record<string, string | number>,
  visible: Record<string, string | number>,
  delay = 0,
) {
  if (stopped) {
    return {
      initial: false as const,
      animate: visible,
      transition: { duration: 0 },
    };
  }

  return {
    initial: hidden,
    whileInView: visible,
    viewport,
    transition: { duration: 0.22, ease: "easeOut" as const, delay },
  };
}

export function OutcomeVisual({ index }: { index: number }) {
  const { stopped } = useExperience();

  return (
    <div
      aria-hidden="true"
      className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-muted p-5 text-dobeu-indigo-500 sm:p-6"
    >
      {index === 0 && (
        <motion.div
          className="flex w-full max-w-64 flex-col gap-3 rounded-md border p-4 text-xs"
          {...scrollProps(
            stopped,
            {
              opacity: 0.88,
              y: 10,
              color: brandSignal,
              borderColor: quietBorder,
              backgroundColor: panelBackground,
            },
            {
              opacity: 1,
              y: 0,
              color: successSignal,
              borderColor: successBorder,
              backgroundColor: successBackground,
            },
          )}
        >
          <div className="flex items-center justify-between gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-current/70">
            <span>Driver tasks</span>
            <span>Live</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {driverTasks.map((task, taskIndex) => (
              <motion.li
                key={task}
                className="flex min-w-0 items-center gap-2 text-current"
                {...scrollProps(
                  stopped,
                  { opacity: 0, x: -8 },
                  { opacity: 1, x: 0 },
                  0.08 + taskIndex * 0.1,
                )}
              >
                <motion.span
                  className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border"
                  {...scrollProps(
                    stopped,
                    {
                      color: brandSignal,
                      borderColor: "hsl(var(--dobeu-violet-500) / 0.45)",
                      backgroundColor: panelBackground,
                    },
                    {
                      color: successSignal,
                      borderColor: successBorder,
                      backgroundColor: successBackground,
                    },
                    0.18 + taskIndex * 0.1,
                  )}
                >
                  <Check className="size-2.5" />
                </motion.span>
                <span className="relative min-w-0 flex-1 text-left leading-tight">
                  <span className="block truncate">{task}</span>
                  <motion.span
                    className="absolute left-0 top-1/2 h-px bg-current"
                    {...scrollProps(
                      stopped,
                      { width: "0%" },
                      { width: "100%" },
                      0.32 + taskIndex * 0.1,
                    )}
                  />
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
      {index === 1 && (
        <div className="flex items-center gap-4">
          <motion.div
            {...scrollProps(
              stopped,
              { opacity: 0.72, x: -10, color: brandSignal },
              { opacity: 1, x: 0, color: successSignal },
            )}
          >
            <Users className="size-12 stroke-1" />
          </motion.div>
          <motion.div
            {...scrollProps(
              stopped,
              { opacity: 0.45, scaleX: 0.7, color: brandSignal },
              { opacity: 1, scaleX: 1, color: successSignal },
              0.12,
            )}
          >
            <ArrowRight className="size-8 stroke-1" />
          </motion.div>
          <motion.div
            className="flex size-20 items-center justify-center rounded-md border"
            {...scrollProps(
              stopped,
              {
                opacity: 0.78,
                x: 10,
                color: brandSignal,
                borderColor: quietBorder,
                backgroundColor: panelBackground,
              },
              {
                opacity: 1,
                x: 0,
                color: successSignal,
                borderColor: successBorder,
                backgroundColor: successBackground,
              },
              0.22,
            )}
          >
            <FileText className="size-10 stroke-1" />
          </motion.div>
        </div>
      )}
      {index === 2 && (
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((item) => (
            <motion.div
              key={item}
              className="flex size-14 items-center justify-center rounded-pill border"
              {...scrollProps(
                stopped,
                {
                  scale: 0.95,
                  color: brandSignal,
                  borderColor: quietBorder,
                  backgroundColor: panelBackground,
                },
                {
                  scale: 1,
                  color: successSignal,
                  borderColor: successBorder,
                  backgroundColor: successBackground,
                },
                item * 0.14,
              )}
            >
              <Check className="size-6" />
            </motion.div>
          ))}
        </div>
      )}
      {index === 3 && (
        <div className="flex items-center gap-5">
          <motion.div
            className="flex flex-col gap-2 rounded-md border p-4"
            {...scrollProps(
              stopped,
              {
                x: -34,
                y: -12,
                rotate: -4,
                color: brandSignal,
                borderColor: quietBorder,
                backgroundColor: panelBackground,
              },
              {
                x: 0,
                y: 0,
                rotate: 0,
                color: successSignal,
                borderColor: successBorder,
                backgroundColor: successBackground,
              },
              0.04,
            )}
          >
            <FileText className="size-10 stroke-1" />
            <span className="h-1 w-10 rounded-pill bg-current/40" />
          </motion.div>
          <motion.div
            {...scrollProps(
              stopped,
              {
                scale: 0.92,
                color: quietSignal,
              },
              {
                scale: 1,
                color: successSignal,
              },
              0.2,
            )}
          >
            <ClipboardCheck className="size-14 stroke-1" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

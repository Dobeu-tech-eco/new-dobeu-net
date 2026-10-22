"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { FADE_UP, useMotionProps } from "@/hooks/use-motion-props";
import { clampStep, getViewportStep } from "./viewpoint";

const ExperienceContext = createContext({
  stopped: true,
  reduced: false,
  toggleMotion: () => {},
});

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const preference = useReducedMotion();
  // Match server markup during hydration before applying the browser preference.
  const reduced = hydrated && Boolean(preference);
  // Respect the OS default until the visitor explicitly chooses playback.
  const [paused, setPaused] = useState<boolean | null>(null);
  const stopped = paused ?? reduced;
  return (
    <ExperienceContext.Provider
      value={{
        stopped,
        reduced,
        toggleMotion: () => setPaused((value) => !(value ?? reduced)),
      }}
    >
      <div
        className="marketing-shell"
        data-motion={stopped ? "paused" : "running"}
      >
        {children}
      </div>
    </ExperienceContext.Provider>
  );
}

export const useExperience = () => useContext(ExperienceContext);

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.68,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const props = useMotionProps(FADE_UP, "-32px");
  const { stopped } = useExperience();
  return (
    <motion.div
      className={className}
      initial={stopped ? false : props.initial}
      animate={stopped ? props.animate : undefined}
      whileInView={props.whileInView}
      viewport={props.viewport}
      transition={{
        duration: stopped ? 0 : duration,
        delay: stopped ? 0 : delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}

export function useAutoStep(count: number) {
  const { stopped } = useExperience();
  const ref = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const playing = !stopped;

  const commit = useCallback(
    (index: number) => {
      const next = clampStep(index, count);
      if (next === stepRef.current) return;
      setDirection(next > stepRef.current ? 1 : -1);
      stepRef.current = next;
      setActive(next);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2 || stopped) return;

    let frame = 0;
    const update = () => {
      const element = ref.current;
      if (!element || document.hidden) return;
      commit(getViewportStep(element, count));
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
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [commit, count, stopped]);

  return {
    ref,
    active,
    direction,
    playing,
    select: commit,
    interactionProps: {},
  };
}

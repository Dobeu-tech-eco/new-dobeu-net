"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { FADE_UP, useMotionProps } from "@/hooks/use-motion-props";

const ExperienceContext = createContext({
  stopped: true,
  reduced: false,
  toggleMotion: () => {},
});

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const preference = useReducedMotion();
  // Match server markup during hydration before applying the browser preference.
  const reduced = hydrated && Boolean(preference);
  const [paused, setPaused] = useState(false);
  const stopped = Boolean(reduced) || paused;
  return (
    <ExperienceContext.Provider
      value={{ stopped, reduced, toggleMotion: () => setPaused((value) => !value) }}
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
}: {
  children: ReactNode;
  className?: string;
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
      transition={{ duration: stopped ? 0 : 0.5 }}
    >
      {children}
    </motion.div>
  );
}

export function useAutoStep(count: number, duration = 6000) {
  const { stopped } = useExperience();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [selected, setSelected] = useState(false);
  const [visible, setVisible] = useState(true);
  const playing = inView && !stopped && !interacting && !selected && visible;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % count),
      duration,
    );
    return () => window.clearInterval(timer);
  }, [count, duration, playing]);

  return {
    ref,
    active,
    playing,
    select: (index: number) => {
      setActive(index);
      setSelected(true);
    },
    interactionProps: {
      onMouseEnter: () => setInteracting(true),
      onMouseLeave: () => setInteracting(false),
      onFocusCapture: () => setInteracting(true),
      onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setInteracting(false);
      },
    },
  };
}

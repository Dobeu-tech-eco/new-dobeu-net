"use client";

/**
 * useMotionProps
 *
 * Returns Framer Motion `initial` / `animate` / `whileInView` / `transition`
 * props that respect the user's `prefers-reduced-motion: reduce` media query.
 *
 * When reduced motion is preferred every animated element starts fully visible
 * (opacity: 1, no translate, no scale) and transitions are instant (duration 0).
 * This fixes the WCAG 2.1 SC 2.3.3 gap where Framer's `initial={{ opacity:0 }}`
 * leaves content invisible because CSS `animation-duration: 0.01ms` does not
 * flush inline styles set by the JS animation engine.
 *
 * Usage:
 *   const mp = useMotionProps({ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } });
 *   <motion.div {...mp} transition={{ duration: 0.4 }} />
 *
 * For `whileInView` call sites:
 *   const mp = useMotionProps({ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } });
 *   <motion.div initial={mp.initial} whileInView={mp.whileInView} animate={mp.animate} />
 */

import { useReducedMotion } from "motion/react";

interface MotionVariants {
  hidden: Record<string, number | string>;
  visible: Record<string, number | string>;
}

interface MotionProps {
  /** Always set — the starting state. */
  initial: Record<string, number | string>;
  /** For elements that animate on mount (Hero, etc.) */
  animate: Record<string, number | string>;
  /** For elements that animate on scroll entry */
  whileInView: Record<string, number | string>;
  /** viewport config — pass once={true} per site convention */
  viewport: { once: boolean; margin?: string };
}

export function useMotionProps(
  variants: MotionVariants,
  viewportMargin = "-100px"
): MotionProps {
  const reduce = useReducedMotion();

  if (reduce) {
    const visible = variants.visible;
    return {
      initial: visible,
      animate: visible,
      whileInView: visible,
      viewport: { once: true, margin: viewportMargin },
    };
  }

  return {
    initial: variants.hidden,
    animate: variants.visible,
    whileInView: variants.visible,
    viewport: { once: true, margin: viewportMargin },
  };
}

/** Convenience preset: fade + slight rise (most common pattern on this site) */
export const FADE_UP: MotionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

/** Convenience preset: fade + larger rise */
export const FADE_UP_LG: MotionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/** Convenience preset: fade only (no translate) */
export const FADE: MotionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Convenience preset: scale + fade (Founder mark) */
export const SCALE_IN: MotionVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

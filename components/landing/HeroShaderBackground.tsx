"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const GrainGradient = dynamic(
  () =>
    import("@paper-design/shaders-react").then(
      (module) => module.GrainGradient,
    ),
  { ssr: false },
);

type ShaderPalette = {
  background: string;
  violet: string;
  violetSoft: string;
  amber: string;
};

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function HeroShaderBackground() {
  const reduceMotion = useReducedMotion();
  const paletteRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<ShaderPalette | null>(null);
  const [canRenderShader, setCanRenderShader] = useState(false);

  useEffect(() => {
    const paletteElement = paletteRef.current;
    if (!paletteElement || reduceMotion !== false || !supportsWebGl()) return;

    const readPalette = () => {
      const swatches = paletteElement.children;
      setPalette({
        background: getComputedStyle(swatches[0]).color,
        violet: getComputedStyle(swatches[1]).color,
        violetSoft: getComputedStyle(swatches[2]).color,
        amber: getComputedStyle(swatches[3]).color,
      });
      setCanRenderShader(true);
    };

    readPalette();
    const observer = new MutationObserver(readPalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
      data-testid="hero-shader-background"
    >
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-dobeu-violet-500/15 blur-3xl dark:bg-dobeu-violet-500/20" />
      <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-dobeu-amber-500/10 blur-3xl dark:bg-dobeu-amber-500/15" />

      <div ref={paletteRef} className="sr-only">
        <span className="text-background" />
        <span className="text-dobeu-violet-500" />
        <span className="text-dobeu-violet-300 dark:text-dobeu-violet-700" />
        <span className="text-dobeu-amber-500" />
      </div>

      {canRenderShader && palette && (
        <GrainGradient
          className="absolute inset-0 h-full w-full opacity-90 dark:opacity-100"
          width="100%"
          height="100%"
          colorBack={palette.background}
          colors={[palette.violet, palette.violetSoft, palette.amber]}
          shape="wave"
          softness={0.7}
          intensity={0.45}
          noise={0.1}
          speed={0.2}
          scale={1.1}
          maxPixelCount={900_000}
        />
      )}

      {/* Legibility scrim: fade toward the background where hero copy sits, leave the gradient visible elsewhere */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/25 to-transparent dark:from-background/70 dark:via-background/20 dark:to-transparent" />
    </div>
  );
}

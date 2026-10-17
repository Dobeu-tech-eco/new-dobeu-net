"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useExperience } from "./ExperienceProvider";

export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const { stopped } = useExperience();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let last = 0;
    const chars = "░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯";
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.45;
      context.font = '11px "JetBrains Mono", monospace';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = getComputedStyle(canvas).color;
      const time = timeRef.current;
      for (let phi = 0; phi < Math.PI * 2; phi += 0.18) {
        for (let theta = 0.08; theta < Math.PI; theta += 0.18) {
          const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
          const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
          const z = Math.cos(theta);
          const rx = x * Math.cos(time * 0.3) - z * Math.sin(time * 0.3);
          const rz = x * Math.sin(time * 0.3) + z * Math.cos(time * 0.3);
          const ry = y * Math.cos(time * 0.2) - rz * Math.sin(time * 0.2);
          const depth =
            (y * Math.sin(time * 0.2) + rz * Math.cos(time * 0.2) + 1) / 2;
          context.globalAlpha = 0.12 + depth * 0.7;
          context.fillText(
            chars[Math.min(chars.length - 1, Math.floor(depth * chars.length))],
            width / 2 + rx * radius,
            height / 2 + ry * radius,
          );
        }
      }
    };
    const tick = (now: number) => {
      if (now - last >= 40) {
        timeRef.current += 0.024;
        draw();
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const updateAnimation = () => {
      cancelAnimationFrame(frame);
      draw();
      if (!stopped && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateAnimation();
    });
    resize.observe(canvas);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", updateAnimation);
    updateAnimation();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateAnimation);
    };
  }, [stopped, resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-full w-full text-dobeu-indigo-500"
    />
  );
}

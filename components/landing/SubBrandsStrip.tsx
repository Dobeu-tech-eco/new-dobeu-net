"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { SUB_BRANDS } from "@/lib/jeremy-data";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

/**
 * SubBrandsStrip
 *
 * A compact horizontal row surfacing the full Dobeu brand universe.
 * Positioned directly below the Hero so visitors understand this is a
 * multi-product studio, not a single-service freelancer page.
 *
 * On mobile it horizontally scrolls — no truncation, no wrapping.
 */
export function SubBrandsStrip() {
  const mp = useMotionProps(FADE_UP);

  return (
    <section aria-label="The Dobeu Universe" className="border-y border-border/40 bg-elevated/30">
      <div className="container max-w-6xl py-4">
        <motion.div
          initial={mp.initial}
          whileInView={mp.animate}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-3 overflow-x-auto scrollbar-none"
        >
          <span className="flex-shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider pr-2 border-r border-border/50">
            The Dobeu Universe
          </span>

          {SUB_BRANDS.map((brand, i) => (
            <motion.div
              key={brand.name}
              initial={mp.initial}
              whileInView={mp.animate}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="flex-shrink-0"
            >
              <Link
                href={brand.href}
                target={brand.href.startsWith("http") ? "_blank" : undefined}
                rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/60 hover:border-primary/50 hover:bg-primary/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                {/* Category badge */}
                <span className="hidden sm:inline-flex rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wide">
                  {brand.category}
                </span>
                <span>{brand.label}</span>
                <ExternalLink
                  className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity"
                  aria-hidden="true"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

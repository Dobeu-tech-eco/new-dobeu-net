/**
 * Decides whether a click should run the page light transition.
 * The live Dobeu mark is never a transition target — callers animate
 * `main` only and leave the nav lockup outside that snapshot.
 */

export interface RouteClick {
  href: string | null;
  currentHref: string;
  target: string | null;
  download: boolean;
  modified: boolean;
  defaultPrevented: boolean;
  reducedMotion: boolean;
  /** Kept so callers can disable the transition when motion APIs are unavailable. */
  viewTransitions: boolean;
}

export function routeTransitionHref(click: RouteClick): string | null {
  if (!click.viewTransitions || click.reducedMotion) return null;
  if (click.defaultPrevented || click.modified || click.download) return null;
  if (click.target && click.target !== "_self") return null;
  if (!click.href) return null;
  if (
    click.href.startsWith("mailto:") ||
    click.href.startsWith("tel:") ||
    click.href.startsWith("javascript:")
  ) {
    return null;
  }

  let next: URL;
  let current: URL;
  try {
    current = new URL(click.currentHref);
    next = new URL(click.href, current);
  } catch {
    return null;
  }

  if (next.origin !== current.origin) return null;
  if (next.pathname === current.pathname && next.search === current.search) {
    return null;
  }

  return `${next.pathname}${next.search}${next.hash}`;
}

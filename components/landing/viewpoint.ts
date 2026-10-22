/** Scroll windows for illustrations and stepped sequences. */

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clampStep(index: number, count: number) {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

export function progressToStep(progress: number, count: number) {
  if (count <= 1) return 0;
  const clamped = clamp01(progress);
  if (clamped >= 1) return count - 1;
  return clampStep(Math.floor(clamped * count), count);
}

/**
 * 0 while an illustration is entering at the bottom of the viewport (info).
 * 1 once it has settled in the upper viewing band (checked off).
 * Scrolling back up lowers the value again.
 */
export function elementViewpointProgress(top: number, viewportHeight: number) {
  const height = Math.max(viewportHeight, 1);
  // Fully on screen in the lower band is still the info pose.
  // The check-off finishes once the illustration sits in the upper band.
  const start = height * 0.7;
  const end = height * 0.22;
  return clamp01((start - top) / (start - end));
}

/** Each item checks off across its own slice of the illustration's progress. */
export function itemCheckProgress(
  progress: number,
  index: number,
  count: number,
) {
  const total = Math.max(count, 1);
  const start = index / total;
  const end = (index + 1) / total;
  return clamp01((clamp01(progress) - start) / (end - start));
}

export function readViewportHeight() {
  return (
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    1
  );
}

function viewportHeightOf(explicit?: number) {
  if (explicit && explicit > 0) return explicit;
  return readViewportHeight();
}

/**
 * Compact cards advance while they travel through the viewing band, and
 * finish on the last step while the card is still on screen.
 * Sequences taller than the viewport advance as the focal line moves
 * through them, so each step is the one the viewer has reached.
 */
export function getViewportStep(
  element: HTMLElement,
  count: number,
  viewportHeight?: number,
) {
  const height = viewportHeightOf(viewportHeight);
  const rect = element.getBoundingClientRect();
  if (rect.height < 1) return 0;

  if (rect.height > height) {
    const focal = height * 0.42;
    return progressToStep((focal - rect.top) / rect.height, count);
  }

  const start = height * 0.94;
  const end = height * 0.2;
  return progressToStep((start - rect.top) / (start - end), count);
}

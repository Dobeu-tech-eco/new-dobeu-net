import { describe, expect, it } from "vitest";
import {
  elementViewpointProgress,
  getViewportStep,
  itemCheckProgress,
  progressToStep,
} from "./viewpoint";

function box(top: number, height: number) {
  return {
    getBoundingClientRect: () =>
      ({
        top,
        height,
        bottom: top + height,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: top,
        toJSON: () => {},
      }) as DOMRect,
  } as HTMLElement;
}

describe("viewpoint progress", () => {
  it("keeps an illustration in the info state as it enters and checks it off as it settles", () => {
    expect(elementViewpointProgress(920, 1000)).toBe(0);
    expect(elementViewpointProgress(220, 1000)).toBe(1);
    const midway = elementViewpointProgress(460, 1000);
    expect(midway).toBeGreaterThan(0.4);
    expect(midway).toBeLessThan(0.6);
  });

  it("returns to the info state when the illustration scrolls back down the viewport", () => {
    const checked = elementViewpointProgress(400, 1000);
    const restored = elementViewpointProgress(900, 1000);
    expect(checked).toBeGreaterThan(restored);
    expect(restored).toBeLessThan(0.1);
  });

  it("checks items off in order and clears them as progress falls", () => {
    expect(itemCheckProgress(0, 0, 4)).toBe(0);
    expect(itemCheckProgress(0.5, 0, 4)).toBe(1);
    expect(itemCheckProgress(0.5, 1, 4)).toBe(1);
    expect(itemCheckProgress(0.5, 2, 4)).toBe(0);
    expect(itemCheckProgress(1, 3, 4)).toBe(1);
    expect(itemCheckProgress(0.2, 1, 4)).toBe(0);
  });

  it("maps a full scrub to the last step without skipping the first", () => {
    expect(progressToStep(0, 4)).toBe(0);
    expect(progressToStep(0.24, 4)).toBe(0);
    expect(progressToStep(0.25, 4)).toBe(1);
    expect(progressToStep(0.74, 4)).toBe(2);
    expect(progressToStep(0.75, 4)).toBe(3);
    expect(progressToStep(1, 4)).toBe(3);
  });

  it("advances a compact card across the viewing band and reverses on the way up", () => {
    expect(getViewportStep(box(940, 600), 4, 1000)).toBe(0);
    expect(getViewportStep(box(755, 600), 4, 1000)).toBe(1);
    expect(getViewportStep(box(570, 600), 4, 1000)).toBe(2);
    expect(getViewportStep(box(385, 600), 4, 1000)).toBe(3);
    expect(getViewportStep(box(940, 600), 4, 1000)).toBe(0);
  });

  it("advances a tall sequence by the focal line inside the element", () => {
    expect(getViewportStep(box(420, 1400), 3, 1000)).toBe(0);
    expect(getViewportStep(box(-280, 1400), 3, 1000)).toBe(1);
    expect(getViewportStep(box(-980, 1400), 3, 1000)).toBe(2);
    expect(getViewportStep(box(420, 1400), 3, 1000)).toBe(0);
  });

  it("stays on the first step before layout", () => {
    expect(getViewportStep(box(0, 0), 4, 1000)).toBe(0);
  });
});

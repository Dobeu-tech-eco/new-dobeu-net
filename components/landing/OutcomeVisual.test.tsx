import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperienceProvider } from "./ExperienceProvider";
import { OutcomeVisual } from "./OutcomeVisual";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => preferences.reduced,
}));

const placement = { top: 920 };

beforeEach(() => {
  preferences.reduced = false;
  placement.top = 920;
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 1000,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        top: placement.top,
        bottom: placement.top + 192,
        height: 192,
        width: 320,
        left: 0,
        right: 320,
        x: 0,
        y: placement.top,
        toJSON: () => {},
      }) as DOMRect,
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderVisual() {
  return render(
    <ExperienceProvider>
      <OutcomeVisual index={0} />
    </ExperienceProvider>,
  );
}

function phase() {
  return document.querySelector("[data-phase]")?.getAttribute("data-phase");
}

describe("outcome illustrations", () => {
  it("shows info while the illustration is low in the viewport and checks off as it rises", () => {
    renderVisual();
    expect(phase()).toBe("info");

    placement.top = 200;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(phase()).toBe("checked");
  });

  it("restores the info state when the viewer scrolls back up", () => {
    renderVisual();
    placement.top = 200;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(phase()).toBe("checked");

    placement.top = 920;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(phase()).toBe("info");
  });

  it("keeps the checked illustration when motion is paused", () => {
    preferences.reduced = true;
    placement.top = 920;
    renderVisual();
    expect(phase()).toBe("checked");
  });
});

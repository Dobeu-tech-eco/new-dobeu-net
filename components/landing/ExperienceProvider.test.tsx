import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import {
  ExperienceProvider,
  Reveal,
  useAutoStep,
  useExperience,
} from "./ExperienceProvider";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => preferences.reduced,
}));

function Journey() {
  const { ref, active, select, interactionProps } = useAutoStep(3);
  const { stopped, toggleMotion } = useExperience();
  return (
    <div ref={ref} {...interactionProps} data-testid="journey">
      <output data-testid="active">{active}</output>
      <button onClick={toggleMotion}>{stopped ? "Resume" : "Pause"}</button>
      <button onClick={() => select(2)}>Select final stage</button>
    </div>
  );
}

function renderJourney() {
  return render(
    <ExperienceProvider>
      <Journey />
    </ExperienceProvider>,
  );
}
function setJourneyTop(top: number) {
  const element = screen.getByTestId("journey");
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        top,
        bottom: top + 600,
        height: 600,
        width: 400,
        left: 0,
        right: 400,
        x: 0,
        y: top,
        toJSON: () => {},
      }) as DOMRect,
  });

  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

beforeEach(() => {
  preferences.reduced = false;
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 1000,
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
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

describe("marketing experience controls", () => {
  it.each([false, true])(
    "hydrates reveal styles without mismatches when reduced motion is %s",
    async (reduced) => {
      vi.useRealTimers();
      const app = (
        <ExperienceProvider>
          <Reveal>
            <h2>Let&apos;s work out what would.</h2>
          </Reveal>
        </ExperienceProvider>
      );
      preferences.reduced = false;
      const container = document.createElement("div");
      container.innerHTML = renderToString(app);
      document.body.append(container);
      preferences.reduced = reduced;
      const onRecoverableError = vi.fn();
      const consoleError = vi.spyOn(console, "error");
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, app, { onRecoverableError });
        });
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
        expect(container.querySelector("h2")).toHaveTextContent(
          "Let's work out what would.",
        );
        if (reduced) {
          await waitFor(() => {
            expect(container.querySelector("h2")?.parentElement).toHaveStyle({
              opacity: "1",
              transform: "none",
            });
          });
        }
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    },
  );

  it("hydrates matching server markup before applying reduced motion", async () => {
    function MotionControl() {
      const { stopped, toggleMotion } = useExperience();
      return (
        <button onClick={toggleMotion} aria-pressed={stopped}>
          {stopped ? "Play" : "Pause"}
        </button>
      );
    }
    const app = (
      <ExperienceProvider>
        <MotionControl />
      </ExperienceProvider>
    );
    preferences.reduced = false;
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.append(container);
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "running",
    );
    preferences.reduced = true;
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, app, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.firstElementChild).toHaveAttribute(
        "data-motion",
        "paused",
      );
      expect(container.querySelector("button")).toBeEnabled();
      expect(container.querySelector("button")).toHaveTextContent("Play");
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("advances illustrations from the viewing band and restores them when scrolling up", () => {
    renderJourney();

    setJourneyTop(780);
    expect(screen.getByTestId("active")).toHaveTextContent("0");

    setJourneyTop(590);
    expect(screen.getByTestId("active")).toHaveTextContent("1");

    setJourneyTop(-420);
    expect(screen.getByTestId("active")).toHaveTextContent("2");

    setJourneyTop(780);
    expect(screen.getByTestId("active")).toHaveTextContent("0");
  });

  it("does not scroll-cycle when reduced motion keeps playback paused", () => {
    preferences.reduced = true;
    const { container } = renderJourney();

    setJourneyTop(-420);
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "paused",
    );
    expect(screen.getByTestId("active")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Select final stage" }));
    expect(screen.getByTestId("active")).toHaveTextContent("2");
  });

  it("allows explicit play and pause when the system requests reduced motion", () => {
    preferences.reduced = true;
    const { container } = renderJourney();

    setJourneyTop(-420);
    expect(screen.getByTestId("active")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "running",
    );
    setJourneyTop(-420);
    expect(screen.getByTestId("active")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "paused",
    );
    setJourneyTop(780);
    expect(screen.getByTestId("active")).toHaveTextContent("2");
  });

  it("keeps a manually selected stage stable until the viewport changes", () => {
    renderJourney();
    fireEvent.click(screen.getByRole("button", { name: "Select final stage" }));
    expect(screen.getByTestId("active")).toHaveTextContent("2");

    setJourneyTop(780);
    expect(screen.getByTestId("active")).toHaveTextContent("0");
  });

  it("does not change the stage while the document is hidden", () => {
    renderJourney();
    setJourneyTop(780);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    setJourneyTop(-420);
    expect(screen.getByTestId("active")).toHaveTextContent("0");
  });
});

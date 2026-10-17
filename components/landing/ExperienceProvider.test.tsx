import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import {
  ExperienceProvider,
  useAutoStep,
  useExperience,
} from "./ExperienceProvider";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useInView: () => true,
  useReducedMotion: () => preferences.reduced,
}));

function Journey() {
  const { ref, active, select, interactionProps } = useAutoStep(3, 1000);
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
function advance(ms = 1000) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  preferences.reduced = false;
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("marketing experience controls", () => {
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

  it("pauses and resumes auto-advancing illustrations", () => {
    const { container } = renderJourney();
    advance();
    expect(screen.getByTestId("active").textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    advance(4000);
    expect(screen.getByTestId("active").textContent).toBe("1");
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "paused",
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    advance();
    expect(screen.getByTestId("active").textContent).toBe("2");
  });

  it("never autoplays when reduced motion is requested", () => {
    preferences.reduced = true;
    const { container } = renderJourney();
    advance(5000);
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "paused",
    );
    expect(screen.getByTestId("active").textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Select final stage" }));
    expect(screen.getByTestId("active").textContent).toBe("2");
  });

  it("allows explicit play and pause when the system requests reduced motion", () => {
    preferences.reduced = true;
    const { container } = renderJourney();
    advance(3000);
    expect(screen.getByTestId("active")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "running",
    );
    advance();
    expect(screen.getByTestId("active")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-motion",
      "paused",
    );
    advance(3000);
    expect(screen.getByTestId("active")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    advance();
    expect(screen.getByTestId("active")).toHaveTextContent("2");
  });

  it("keeps a manually selected stage stable", () => {
    renderJourney();
    fireEvent.click(screen.getByRole("button", { name: "Select final stage" }));
    advance(5000);
    expect(screen.getByTestId("active").textContent).toBe("2");
  });

  it("pauses while hovered and resumes after leaving", () => {
    renderJourney();
    fireEvent.mouseEnter(screen.getByTestId("journey"));
    advance(4000);
    expect(screen.getByTestId("active").textContent).toBe("0");
    fireEvent.mouseLeave(screen.getByTestId("journey"));
    advance();
    expect(screen.getByTestId("active").textContent).toBe("1");
  });

  it("pauses when the document is hidden", () => {
    renderJourney();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(4000);
    expect(screen.getByTestId("active").textContent).toBe("0");
  });
});

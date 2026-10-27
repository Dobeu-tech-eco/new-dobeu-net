import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Heavy tab bodies are stubbed; the real LightboxDialog (Radix Dialog) is used.
vi.mock("@/components/landing/LeadForm", () => ({
  LeadForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button type="button" onClick={onSuccess}>
      Submit lead
    </button>
  ),
}));
vi.mock("@/components/landing/BookingTab", () => ({ BookingTab: () => <div>Booking</div> }));
vi.mock("@/components/landing/TypeformTab", () => ({ TypeformTab: () => <div>Intake</div> }));

import { LightboxProvider, useLightbox } from "./LightboxProvider";

function Trigger() {
  const { open } = useLightbox();
  return (
    <button type="button" onClick={() => open("email")}>
      Open note
    </button>
  );
}

function RemovedOpener() {
  const { open } = useLightbox();
  const [shown, setShown] = React.useState(true);
  const stable = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={stable}>
        Stable
      </button>
      {shown ? (
        <button
          type="button"
          onClick={() => {
            open("email", stable.current);
            setShown(false);
          }}
        >
          Menu item
        </button>
      ) : null}
    </>
  );
}

describe("Lightbox focus restoration", () => {
  afterEach(cleanup);

  it("returns focus to the opening control when Escape closes the dialog", async () => {
    render(
      <LightboxProvider>
        <Trigger />
      </LightboxProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Open note" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("returns focus to the opener when the form closes the dialog via onSuccess", async () => {
    render(
      <LightboxProvider>
        <Trigger />
      </LightboxProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Open note" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(await screen.findByRole("button", { name: "Submit lead" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("honours returnFocusTo when the original active element was removed", async () => {
    render(
      <LightboxProvider>
        <RemovedOpener />
      </LightboxProvider>,
    );
    const item = screen.getByRole("button", { name: "Menu item" });
    item.focus();
    fireEvent.click(item);

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const stable = screen.getByRole("button", { name: "Stable" });
    await waitFor(() => expect(document.activeElement).toBe(stable));
  });

  it("does not trap focus on body when opened with nothing focused", async () => {
    render(
      <LightboxProvider>
        <Trigger />
      </LightboxProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Open note" });
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    const bodyFocus = vi.spyOn(document.body, "focus");
    fireEvent.click(trigger); // fireEvent.click does not focus the button

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // No stored opener: our restoreFocus must not run its own body.focus() path.
    expect(bodyFocus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(dialog);
    bodyFocus.mockRestore();
  });

  it("returns focus to the pressed control when the browser never focuses it (Safari mouse click)", async () => {
    render(
      <LightboxProvider>
        <Trigger />
      </LightboxProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Open note" });
    fireEvent.pointerDown(trigger);
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  function TwoTriggers() {
    const { open } = useLightbox();
    return (
      <>
        <button type="button" onClick={() => open("email")}>
          Open A
        </button>
        <button type="button" onClick={() => open("email")}>
          Open B
        </button>
      </>
    );
  }

  async function escapeAndExpectFocus(target: HTMLElement) {
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(target));
  }

  it("prefers the pressed control over a previously focused one (Safari mouse click)", async () => {
    render(
      <LightboxProvider>
        <TwoTriggers />
      </LightboxProvider>,
    );
    const a = screen.getByRole("button", { name: "Open A" });
    const b = screen.getByRole("button", { name: "Open B" });
    a.focus();
    fireEvent.pointerDown(b); // Safari: B is pressed but A keeps focus
    expect(document.activeElement).toBe(a);
    fireEvent.click(b);

    await escapeAndExpectFocus(b);
  });

  it("uses the focused control for keyboard activation after an earlier stale press", async () => {
    render(
      <LightboxProvider>
        <TwoTriggers />
      </LightboxProvider>,
    );
    const a = screen.getByRole("button", { name: "Open A" });
    const b = screen.getByRole("button", { name: "Open B" });
    fireEvent.pointerDown(b);
    a.focus();
    fireEvent.keyDown(a, { key: "Enter" });
    fireEvent.click(a);

    await escapeAndExpectFocus(a);
  });

  it("uses the focused control when a click arrives with no pointerdown (screen reader)", async () => {
    render(
      <LightboxProvider>
        <TwoTriggers />
      </LightboxProvider>,
    );
    const a = screen.getByRole("button", { name: "Open A" });
    const b = screen.getByRole("button", { name: "Open B" });
    fireEvent.pointerDown(a); // earlier press that never opened anything
    b.focus();
    fireEvent.click(b); // virtual-cursor activation: no pointerdown, no keydown

    await escapeAndExpectFocus(b);
  });
});

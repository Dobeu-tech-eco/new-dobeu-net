import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
});

vi.mock("@/components/landing/LightboxDialog", async () => {
  await gate.promise;
  return {
    LightboxDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">Lightbox</div> : null),
  };
});

import { LightboxProvider, useLightbox } from "./LightboxProvider";

function Trigger() {
  const { open } = useLightbox();
  return (
    <button type="button" onClick={() => open("form")}>
      Open
    </button>
  );
}

describe("LightboxProvider", () => {
  afterEach(cleanup);

  it("announces loading, lets Escape cancel it, and opens on a later attempt", async () => {
    render(
      <LightboxProvider>
        <Trigger />
      </LightboxProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/press escape to cancel/i);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // The chunk lands after the cancel: nothing opens.
    await act(async () => {
      gate.release();
      await gate.promise;
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // A fresh open works once the chunk is available.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

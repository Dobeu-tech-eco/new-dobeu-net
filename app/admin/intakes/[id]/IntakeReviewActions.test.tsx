import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeReviewActions } from "./IntakeReviewActions";

const h = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));

vi.mock("@/lib/actions/intakes", () => ({
  markIntakeReviewed: vi.fn(),
  archiveIntake: vi.fn(),
}));

import { archiveIntake, markIntakeReviewed } from "@/lib/actions/intakes";

const mockedArchiveIntake = vi.mocked(archiveIntake);
const mockedMarkIntakeReviewed = vi.mocked(markIntakeReviewed);
const INTAKE_ID = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mockedMarkIntakeReviewed.mockResolvedValue({
    ok: true,
    data: { id: INTAKE_ID, status: "reviewed" },
  });
  mockedArchiveIntake.mockResolvedValue({
    ok: true,
    data: { id: INTAKE_ID, status: "archived" },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("IntakeReviewActions", () => {
  it("does not offer edits or transitions for an archived intake", () => {
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="archived"
        initialNotes="Archived after duplicate submission."
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /review notes/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /mark reviewed/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /archive intake/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/archived and cannot be reopened/i),
    ).toBeInTheDocument();
  });

  it("offers note saving and archive actions for a reviewed intake", () => {
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="reviewed"
        initialNotes="Confirmed."
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /review notes/i }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: /save review/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /archive intake/i }),
    ).toBeEnabled();
  });

  it("submits review notes, reports success, and refreshes the detail", async () => {
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="new"
        initialNotes={null}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /review notes/i }), {
      target: { value: "Scope confirmed." },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Intake marked reviewed.",
    );
    expect(mockedMarkIntakeReviewed).toHaveBeenCalledWith({
      id: INTAKE_ID,
      notes: "Scope confirmed.",
    });
    expect(h.refresh).toHaveBeenCalledOnce();
  });

  it("keeps both actions disabled while a review is pending", async () => {
    let resolveReview!: (value: {
      ok: true;
      data: { id: string; status: "reviewed" };
    }) => void;
    mockedMarkIntakeReviewed.mockReturnValue(
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    );
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="new"
        initialNotes={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /archive intake/i }),
      ).toBeDisabled();
    });

    await act(async () => {
      resolveReview({
        ok: true,
        data: { id: INTAKE_ID, status: "reviewed" },
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Intake marked reviewed.",
    );
  });

  it("requires archive confirmation and renders returned action errors", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="new"
        initialNotes="Needs follow-up."
      />,
    );
    const archive = screen.getByRole("button", { name: /archive intake/i });

    fireEvent.click(archive);
    expect(mockedArchiveIntake).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    mockedArchiveIntake.mockResolvedValue({
      ok: false,
      error: "intake_not_found_or_invalid_transition",
    });
    fireEvent.click(archive);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This intake changed or is no longer available for that action.",
    );
    expect(mockedArchiveIntake).toHaveBeenCalledWith({
      id: INTAKE_ID,
      notes: "Needs follow-up.",
    });
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("shows recoverable feedback when a server action throws", async () => {
    mockedMarkIntakeReviewed.mockRejectedValue(new Error("network failure"));
    render(
      <IntakeReviewActions
        intakeId={INTAKE_ID}
        status="new"
        initialNotes={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to update intake. Try again.",
    );
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

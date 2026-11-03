import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminStatusBanner } from "./AdminStatusBanner";

afterEach(cleanup);

describe("AdminStatusBanner", () => {
  it.each([
    "<script>alert(1)</script>",
    "https://evil.example",
    "x".repeat(500),
    "constructor",
    "__proto__",
  ])("never echoes unrecognized error %s", (error) => {
    const { container } = render(<AdminStatusBanner error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
    expect(container.textContent).not.toContain(error);
  });
  it.each([
    ["company_create_failed", "Unable to create the company. Try again."],
    ["company_suspend_failed", "Unable to suspend the company. Try again."],
    [
      "company_reactivate_failed",
      "Unable to reactivate the company. Try again.",
    ],
    [
      "admin_provision_failed",
      "Unable to provision the company admin. Try again.",
    ],
    ["project_save_failed", "Unable to save the project. Try again."],
    ["load_failed", "Unable to load admin data. Try again."],
    ["unknown", "Something went wrong. Try again."],
  ])("renders fixed copy for %s", (error, copy) => {
    render(<AdminStatusBanner error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy);
  });
});

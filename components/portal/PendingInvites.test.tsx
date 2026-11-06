import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const invites = vi.hoisted(() => ({
  result: { invites: [], error: false } as {
    invites: {
      memberId: string;
      companyId: string;
      companyName: string;
      role: string;
      roleLabel: string;
      isAdminRole: boolean;
      companyActive: boolean;
    }[];
    error: boolean;
  },
  calls: [] as string[],
}));

vi.mock("@/lib/company-invites", () => ({
  listPendingInvites: async (userId: string) => {
    invites.calls.push(userId);
    return invites.result;
  },
}));
vi.mock("@/lib/actions/invites", () => ({
  acceptCompanyInviteForm: async () => {},
  declineCompanyInviteForm: async () => {},
}));

import { PendingInvites } from "./PendingInvites";

const member = {
  memberId: "m1",
  companyId: "c1",
  companyName: "Acme Co",
  role: "member",
  roleLabel: "Member",
  isAdminRole: false,
  companyActive: true,
};

afterEach(() => {
  cleanup();
  invites.result = { invites: [], error: false };
  invites.calls = [];
});

describe("PendingInvites", () => {
  it("renders nothing when there are no invites", async () => {
    const { container } = render(await PendingInvites({ userId: "u1" }));
    expect(container.innerHTML).toBe("");
    expect(invites.calls).toEqual(["u1"]);
  });

  it("renders a row per invite with Accept and Decline forms", async () => {
    invites.result = {
      invites: [member, { ...member, memberId: "m2", companyName: "Beta LLC", roleLabel: "Viewer" }],
      error: false,
    };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("heading", { name: "Pending company invites" })).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Acme Co")).toBeTruthy();
    expect(within(rows[0]).getByText("Member")).toBeTruthy();
    expect(within(rows[0]).getByRole("button", { name: "Accept invite to Acme Co" }).getAttribute("type")).toBe("submit");
    expect(within(rows[0]).getByRole("button", { name: "Decline invite to Acme Co" }).closest("form")).toBeTruthy();
    expect(within(rows[1]).getByText("Beta LLC")).toBeTruthy();
    expect(screen.queryByText(/two-factor/i)).toBeNull();
  });

  it("explains two-factor verification for admin roles and links the MFA setup", async () => {
    invites.result = {
      invites: [{ ...member, roleLabel: "Admin", isAdminRole: true }],
      error: false,
    };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByText(/you'll need two-factor verification/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "set it up in settings" }).getAttribute("href")).toBe(
      "/portal/settings/mfa",
    );
  });

  it("shows the suspended line and only Decline for a suspended company", async () => {
    invites.result = { invites: [{ ...member, companyActive: false }], error: false };
    render(await PendingInvites({ userId: "u1" }));
    expect(
      screen.getByText(
        "Acme Co is suspended right now. You can decline this invite, or accept it once the company is active again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept invite/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Decline invite to Acme Co" })).toBeTruthy();
  });

  it("shows both buttons and no suspended line for an active company", async () => {
    invites.result = { invites: [{ ...member, companyActive: true }], error: false };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("button", { name: "Accept invite to Acme Co" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline invite to Acme Co" })).toBeTruthy();
    expect(screen.queryByText(/is suspended right now/)).toBeNull();
  });

  it("handles a mixed list per row", async () => {
    invites.result = {
      invites: [
        { ...member, companyActive: true },
        { ...member, memberId: "m2", companyName: "Beta LLC", companyActive: false },
      ],
      error: false,
    };
    render(await PendingInvites({ userId: "u1" }));
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByRole("button", { name: "Accept invite to Acme Co" })).toBeTruthy();
    expect(within(rows[0]).queryByText(/is suspended right now/)).toBeNull();
    expect(within(rows[1]).queryByRole("button", { name: /Accept invite/ })).toBeNull();
    expect(within(rows[1]).getByText(/Beta LLC is suspended right now/)).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: "Decline invite to Beta LLC" })).toBeTruthy();
  });

  it("renders a non-blocking status notice on read failure", async () => {
    invites.result = { invites: [], error: true };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("status").textContent).toContain("Couldn't check for company invites");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

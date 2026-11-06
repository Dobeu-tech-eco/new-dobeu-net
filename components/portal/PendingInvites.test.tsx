import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const invites = vi.hoisted(() => ({
  result: { invites: [], withheld: 0, error: false } as {
    withheld: number;
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
  methods: null as unknown,
  authUser: { id: "u1" } as { id: string } | null,
  methodsSeen: [] as unknown[],
}));

vi.mock("@/lib/company-invites", () => ({
  listPendingInvites: async (userId: string, methods: unknown) => {
    invites.calls.push(userId);
    invites.methodsSeen.splice(invites.methodsSeen.length, 0, methods);
    return invites.result;
  },
  loadSessionMethods: async () => invites.methods,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: invites.authUser } }) },
  }),
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
  invites.result = { invites: [], withheld: 0, error: false };
  invites.calls = [];
  invites.methods = null;
  invites.authUser = { id: "u1" };
  invites.methodsSeen = [];
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
      withheld: 0,
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
      withheld: 0,
      error: false,
    };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByText(/you'll need two-factor verification/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "set it up in settings" }).getAttribute("href")).toBe(
      "/portal/settings/mfa",
    );
  });

  it("shows the suspended line and only Decline for a suspended company", async () => {
    invites.result = { invites: [{ ...member, companyActive: false }], withheld: 0, error: false };
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
    invites.result = { invites: [{ ...member, companyActive: true }], withheld: 0, error: false };
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
      withheld: 0,
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
    invites.result = { invites: [], withheld: 0, error: true };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("status").textContent).toContain("Couldn't check for company invites");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("passes the session's methods to the list", async () => {
    invites.methods = [{ method: "otp", timestamp: 1 }];
    render(await PendingInvites({ userId: "u1" }));
    expect(invites.methodsSeen).toEqual([[{ method: "otp", timestamp: 1 }]]);
  });

  it("shows a count-only notice, with no company or role, when every invite is withheld", async () => {
    invites.result = { invites: [], withheld: 2, error: false };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("status").textContent).toBe(
      "You have 2 pending invites. Sign in with an emailed link to view them.",
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses singular wording for one withheld invite", async () => {
    invites.result = { invites: [], withheld: 1, error: false };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getByRole("status").textContent).toBe(
      "You have 1 pending invite. Sign in with an emailed link to view it.",
    );
  });

  it("lists proven invites and counts the rest", async () => {
    invites.result = { invites: [member], withheld: 1, error: false };
    render(await PendingInvites({ userId: "u1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain("1 pending invite more");
  });

  it("withholds everything when getUser returns no user", async () => {
    invites.methods = [{ method: "otp", timestamp: 1 }];
    invites.authUser = null;
    render(await PendingInvites({ userId: "u1" }));
    expect(invites.methodsSeen).toEqual([null]);
  });

  it("withholds everything when the verified user is not the userId prop", async () => {
    invites.methods = [{ method: "otp", timestamp: 1 }];
    invites.authUser = { id: "someone-else" };
    render(await PendingInvites({ userId: "u1" }));
    expect(invites.methodsSeen).toEqual([null]);
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import { NewWorkOrderForClientDialog } from "./NewWorkOrderForClientDialog";
import AdminTicketsPage from "@/app/admin/tickets/page";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/actions/work-orders", () => ({
  createWorkOrderForClient: h.create,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));

const CLIENT_A = "00000000-0000-0000-0000-000000000001";
const CLIENT_B = "00000000-0000-0000-0000-000000000002";
const COMPANY = "00000000-0000-0000-0000-000000000003";
const props = {
  clients: [
    { id: CLIENT_A, label: "Client A" },
    { id: CLIENT_B, label: "Client B" },
  ],
  companies: [{ id: COMPANY, name: "Company A" }],
  projects: [
    {
      id: "project-a",
      title: "A project",
      owner_user_id: CLIENT_A,
      company_id: null,
    },
    {
      id: "project-b",
      title: "B project",
      owner_user_id: CLIENT_B,
      company_id: null,
    },
    {
      id: "company-project",
      title: "Company project",
      owner_user_id: CLIENT_B,
      company_id: COMPANY,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.create.mockResolvedValue({
    ok: true,
    data: { id: "work-order", status: "open" },
  });
});
afterEach(cleanup);

function openAndFill() {
  fireEvent.click(screen.getByRole("button", { name: "Post work" }));
  fireEvent.change(screen.getByLabelText("Client"), {
    target: { value: CLIENT_A },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "New logo" },
  });
}

function submit() {
  fireEvent.submit(screen.getByLabelText("Title").closest("form")!);
}

describe("NewWorkOrderForClientDialog", () => {
  it("submits an open payload without an optional quote and returns focus to its trigger", async () => {
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    submit();
    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith({
        client_user_id: CLIENT_A,
        company_id: null,
        project_id: null,
        service_type: "other",
        title: "New logo",
        description: null,
        priority: "normal",
      }),
    );
    await waitFor(
      () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Post work" }),
        ).toHaveFocus(),
      { timeout: 3000 },
    );
  });

  it("submits the selected project, company, priority, notes and dollars converted to cents", async () => {
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: COMPANY },
    });
    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "company-project" },
    });
    fireEvent.change(screen.getByLabelText("Service type"), {
      target: { value: "logo" },
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Modern please" },
    });
    fireEvent.change(screen.getByLabelText("Quote (USD, optional)"), {
      target: { value: "123.45" },
    });
    submit();
    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith({
        client_user_id: CLIENT_A,
        company_id: COMPANY,
        project_id: "company-project",
        service_type: "logo",
        title: "New logo",
        description: "Modern please",
        priority: "high",
        quoted_amount_cents: 12345,
      }),
    );
  });

  it("filters projects by client or selected company and clears stale selections", () => {
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    const project = screen.getByLabelText("Project");
    expect(
      within(project).getByRole("option", { name: "A project" }),
    ).toBeInTheDocument();
    expect(
      within(project).queryByRole("option", { name: "B project" }),
    ).not.toBeInTheDocument();
    expect(
      within(project).queryByRole("option", { name: "Company project" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: COMPANY },
    });
    expect(
      within(project).getByRole("option", { name: "Company project" }),
    ).toBeInTheDocument();
    fireEvent.change(project, { target: { value: "company-project" } });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "" },
    });
    expect(project).toHaveValue("");
    fireEvent.change(project, { target: { value: "project-a" } });
    fireEvent.change(screen.getByLabelText("Client"), {
      target: { value: CLIENT_B },
    });
    expect(project).toHaveValue("");
    expect(
      within(project).queryByRole("option", { name: "A project" }),
    ).not.toBeInTheDocument();
    expect(
      within(project).getByRole("option", { name: "B project" }),
    ).toBeInTheDocument();
  });

  it("shows returned action errors inside the dialog", async () => {
    h.create.mockResolvedValue({
      ok: false,
      error: "Client must be an active company member",
    });
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Client must be an active company member",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    h.create.mockResolvedValueOnce({
      ok: true,
      data: { id: "work-order", status: "open" },
    });
    submit();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(h.create).toHaveBeenCalledTimes(2);
  });

  it("replaces a saved ticket's form with a non-blocking quote notice and a link", async () => {
    h.create.mockResolvedValue({
      ok: true,
      data: { id: "saved-ticket", status: "open", quoteFailed: true },
    });
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    fireEvent.change(screen.getByLabelText("Quote (USD, optional)"), {
      target: { value: "123.45" },
    });
    submit();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Work order posted; the quote could not be saved — open the ticket to quote it",
    );
    expect(screen.getByRole("link", { name: "Open ticket" })).toHaveAttribute(
      "href",
      "/admin/tickets/saved-ticket",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Post work for client" }),
    ).not.toBeInTheDocument();
    expect(h.create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Post work" })).toHaveFocus(),
    );
  });

  it("disables submission while pending and ignores repeated form submissions", async () => {
    let resolve!: (value: unknown) => void;
    h.create.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    const form = screen.getByLabelText("Title").closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    const posting = screen.getByRole("button", { name: "Posting…" });
    expect(posting).toBeDisabled();
    fireEvent.click(posting);
    fireEvent.submit(form);
    expect(h.create).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({
        ok: true,
        data: { id: "saved-ticket", status: "open", quoteFailed: true },
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent("Work order posted");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("shows fixed copy for unexpected failures", async () => {
    h.create.mockRejectedValue(new Error("private internal details"));
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to post work. Try again.",
    );
    expect(screen.queryByText(/private internal/)).not.toBeInTheDocument();
  });

  it.each([
    { ...props, clients: [] },
    { ...props, disabled: true },
  ])(
    "disables posting without clients or when picker reads fail",
    (options) => {
      render(<NewWorkOrderForClientDialog {...options} />);
      const trigger = screen.getByRole("button", { name: "Post work" });
      expect(trigger).toBeDisabled();
      fireEvent.click(trigger);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(h.create).not.toHaveBeenCalled();
    },
  );

  it("returns focus on cancel and clears picker state when reopened", async () => {
    render(<NewWorkOrderForClientDialog {...props} />);
    openAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const trigger = screen.getByRole("button", { name: "Post work" });
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Client")).toHaveValue("");
    expect(screen.getByLabelText("Project")).toHaveValue("");
    expect(h.create).not.toHaveBeenCalled();
  });
});

function arrangePage(failedRead?: string) {
  const stub = buildStubClient({
    tables: {
      work_orders: {
        selectSingle: {
          data:
            failedRead === "work_orders"
              ? null
              : [
                  {
                    id: "ticket",
                    title: "Existing client ticket",
                    service_type: "logo",
                    status: "open",
                    created_at: "2026-11-01T00:00:00Z",
                    quoted_amount_cents: null,
                    created_by: CLIENT_A,
                  },
                ],
          error:
            failedRead === "work_orders"
              ? { message: "private tickets details" }
              : null,
        },
      },
      companies: {
        selectSingle: {
          data: props.companies,
          error:
            failedRead === "companies"
              ? { message: "private company details" }
              : null,
        },
      },
      projects: {
        selectSingle: {
          data: props.projects,
          error:
            failedRead === "projects"
              ? { message: "private project details" }
              : null,
        },
      },
    },
  });
  const listUsers = vi.fn(async () => ({
    data: { users: [{ id: CLIENT_A, email: "client@example.com" }] },
    error:
      failedRead === "clients" ? { message: "private auth details" } : null,
  }));
  h.createAdminClient.mockReturnValue({
    ...stub.supabase,
    auth: { ...stub.supabase.auth, admin: { listUsers } },
  });
  return { ...stub, listUsers };
}

describe("admin tickets picker read isolation", () => {
  it.each(["clients", "companies", "projects"])(
    "keeps the tickets table on %s failure and disables Post work",
    async (failedRead) => {
      arrangePage(failedRead);
      render(await AdminTicketsPage({ searchParams: Promise.resolve({}) }));
      expect(screen.getByRole("table")).toHaveTextContent(
        "Existing client ticket",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Post work is unavailable",
      );
      expect(screen.getByRole("button", { name: "Post work" })).toBeDisabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText(/private .* details/)).not.toBeInTheDocument();
    },
  );

  it("loads bounded picker data and enables posting after successful reads", async () => {
    const stub = arrangePage();
    render(await AdminTicketsPage({ searchParams: Promise.resolve({}) }));
    expect(stub.listUsers).toHaveBeenCalledWith({ perPage: 200 });
    expect(stub.recorded).toContainEqual({
      table: "companies",
      method: "eq",
      args: ["status", "active"],
    });
    expect(stub.recorded).toContainEqual({
      table: "projects",
      method: "limit",
      args: [500],
    });
    expect(screen.getByRole("button", { name: "Post work" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a primary read error without a misleading empty state", async () => {
    arrangePage("work_orders");
    render(await AdminTicketsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load tickets",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/No tickets matching/)).not.toBeInTheDocument();
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditProjectForm } from "@/components/admin/EditProjectForm";
import { NewProjectDialog } from "@/components/admin/NewProjectDialog";
import { createProject, updateProject } from "@/lib/actions/projects";

vi.mock("@/lib/actions/projects", () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

const company = { id: "00000000-0000-0000-0000-000000000003", name: "Acme" };
const project = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Website",
  description: null,
  status: "proposed" as const,
  total_cents: 0,
  company_id: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createProject).mockResolvedValue({
    ok: true,
    data: { id: project.id },
  });
  vi.mocked(updateProject).mockResolvedValue({
    ok: true,
    data: { id: project.id },
  });
});
afterEach(cleanup);

describe("project company forms", () => {
  it("sends a selected company when creating a project", async () => {
    render(
      <NewProjectDialog
        owners={[{ id: "owner", label: "Owner" }]}
        companies={[company]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Owner"), {
      target: { value: "owner" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New website" },
    });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: company.id },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create project" }).closest("form")!,
    );
    await waitFor(() =>
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: company.id }),
      ),
    );
  });

  it("offers No company and sends null when creating without an assignment", async () => {
    render(
      <NewProjectDialog
        owners={[{ id: "owner", label: "Owner" }]}
        companies={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(
      screen.getByRole("option", { name: "No company" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Owner"), {
      target: { value: "owner" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New website" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create project" }).closest("form")!,
    );
    await waitFor(() =>
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: null }),
      ),
    );
  });

  it("sets an active company on edit", async () => {
    render(<EditProjectForm project={project} companies={[company]} />);
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: company.id },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: company.id }),
      ),
    );
  });

  it("clears the assignment when No company is selected", async () => {
    render(
      <EditProjectForm
        project={{ ...project, company_id: company.id }}
        companies={[company]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: null }),
      ),
    );
  });

  it("preserves a suspended assignment when editing unrelated fields", async () => {
    render(
      <EditProjectForm
        project={{ ...project, company_id: company.id }}
        companies={[]}
        currentCompanyName={company.name}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Acme (unavailable)" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated title" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );
    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(vi.mocked(updateProject).mock.calls[0][0]).toEqual(
      expect.objectContaining({ title: "Updated title" }),
    );
    expect(vi.mocked(updateProject).mock.calls[0][0]).not.toHaveProperty(
      "company_id",
    );
  });
});

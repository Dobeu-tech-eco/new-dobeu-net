import { afterEach, describe, expect, it, vi } from "vitest";
import type { DBClient } from "@/lib/actions/auth";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import { writeAdminAudit, writeAdminAuditStrict } from "@/lib/admin-audit";

afterEach(() => vi.restoreAllMocks());

const entry: Parameters<typeof writeAdminAudit>[1] = {
  actorUserId: "admin_id",
  action: "invoice.mark_paid_manual",
  targetType: "invoice",
  targetId: "invoice_id",
  data: { amount_cents: 1000, previous_status: "open", status: "paid" },
  logScope: "invoices",
};

describe("writeAdminAudit", () => {
  it.each(["company", "work_order", "invoice", "project", "user"] as const)(
    "writes a %s audit entry without logging on success",
    async (targetType) => {
      const admin = buildStubClient({});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(
        writeAdminAudit(admin.supabase as unknown as DBClient, {
          ...entry,
          targetType,
        }),
      ).resolves.toBeUndefined();

      expect(admin.recorded).toEqual([
        {
          table: "admin_audit_log",
          method: "insert",
          args: [
            {
              actor_user_id: entry.actorUserId,
              action: entry.action,
              target_type: targetType,
              target_id: entry.targetId,
              data: entry.data,
            },
          ],
        },
      ]);
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("accepts a null actor, target id and JSON data", async () => {
    const admin = buildStubClient({});

    await writeAdminAudit(admin.supabase as unknown as DBClient, {
      ...entry,
      actorUserId: null,
      targetId: null,
      data: null,
    });

    expect(admin.recorded[0].args).toEqual([
      {
        actor_user_id: null,
        action: entry.action,
        target_type: "invoice",
        target_id: null,
        data: null,
      },
    ]);
  });

  it("logs only the error code on a returned insert failure", async () => {
    const error = {
      code: "42501",
      message: "private row details",
      details: "private database details",
      hint: "private hint",
    };
    const admin = buildStubClient({
      tables: { admin_audit_log: { insert: { error } } },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      writeAdminAudit(admin.supabase as unknown as DBClient, {
        ...entry,
        logScope: "companies",
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[companies] audit log insert failed (non-fatal):",
      "42501",
    );
  });

  it("keeps a rejected insert non-fatal without logging its message", async () => {
    const admin = buildStubClient({});
    const table = admin.supabase.from("admin_audit_log");
    table.insert.mockRejectedValueOnce({
      code: "08006",
      message: "private connection details",
    });
    admin.supabase.from.mockReturnValueOnce(table);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      writeAdminAudit(admin.supabase as unknown as DBClient, entry),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[invoices] audit log insert failed (non-fatal):",
      "08006",
    );
  });

  it.each([new Error("private message"), null, undefined, "private failure"])(
    "keeps an unexpected synchronous failure non-fatal (%s)",
    async (error) => {
      const admin = buildStubClient({});
      admin.supabase.from.mockImplementationOnce(() => {
        throw error;
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(
        writeAdminAudit(admin.supabase as unknown as DBClient, entry),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "[invoices] audit log insert failed (non-fatal):",
        undefined,
      );
    },
  );
});

describe("writeAdminAuditStrict", () => {
  it("returns true on success", async () => {
    const admin = buildStubClient({});
    await expect(
      writeAdminAuditStrict(admin.supabase as unknown as DBClient, entry),
    ).resolves.toBe(true);
  });

  it("returns false and logs only the code on a returned failure", async () => {
    const admin = buildStubClient({
      tables: { admin_audit_log: { insert: { error: { code: "42501", message: "private" } as never } } },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      writeAdminAuditStrict(admin.supabase as unknown as DBClient, entry),
    ).resolves.toBe(false);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[invoices] audit log insert failed (non-fatal):",
      "42501",
    );
  });

  it("returns false on a synchronous throw", async () => {
    const admin = buildStubClient({});
    admin.supabase.from.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      writeAdminAuditStrict(admin.supabase as unknown as DBClient, entry),
    ).resolves.toBe(false);
  });
});

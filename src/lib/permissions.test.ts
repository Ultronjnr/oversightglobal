import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  defaultRolePermission,
  effectivePermission,
  withinApprovalLimit,
  type ApprovalLimit,
} from "@/lib/permissions";

const limit = (max: number | null, unlimited = false): ApprovalLimit => ({
  approval_type: "REQUISITION",
  max_amount: max,
  currency: "ZAR",
  unlimited,
});

describe("permission catalogue", () => {
  it("groups every permission and keeps keys unique", () => {
    expect(PERMISSION_GROUPS.length).toBeGreaterThan(5);
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length);
  });
});

describe("Super User", () => {
  it("has full access to every permission", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(defaultRolePermission("ADMIN", key)).toBe(true);
      expect(effectivePermission("ADMIN", {}, key)).toBe(true);
    }
  });

  it("cannot be restricted by an override", () => {
    expect(effectivePermission("ADMIN", { "requisitions.approve": false }, "requisitions.approve")).toBe(true);
  });

  it("approves any amount", () => {
    expect(withinApprovalLimit("ADMIN", limit(5000), 7500)).toBe(true);
  });
});

describe("existing roles keep working", () => {
  it("Finance Manager keeps finance capabilities but not permission management", () => {
    expect(effectivePermission("FINANCE", {}, "finance.process")).toBe(true);
    expect(effectivePermission("FINANCE", {}, "requisitions.approve")).toBe(true);
    expect(effectivePermission("FINANCE", {}, "users.manage_permissions")).toBe(false);
  });

  it("HOD can approve requisitions by default", () => {
    expect(effectivePermission("HOD", {}, "requisitions.approve")).toBe(true);
  });

  it("Team Member can create but not approve requisitions", () => {
    expect(effectivePermission("EMPLOYEE", {}, "requisitions.create")).toBe(true);
    expect(effectivePermission("EMPLOYEE", {}, "requisitions.approve")).toBe(false);
  });
});

describe("configurable overrides", () => {
  it("blocks a protected action when the permission is revoked", () => {
    expect(effectivePermission("HOD", { "requisitions.approve": false }, "requisitions.approve")).toBe(false);
  });

  it("allows a protected action when the permission is granted", () => {
    expect(effectivePermission("EMPLOYEE", { "requisitions.approve": true }, "requisitions.approve")).toBe(true);
  });

  it("leaves untouched permissions on their role default", () => {
    const overrides = { "requisitions.approve": false };
    expect(effectivePermission("HOD", overrides, "requisitions.view")).toBe(true);
  });
});

describe("approval limits", () => {
  it("blocks an amount above the limit", () => {
    expect(withinApprovalLimit("HOD", limit(5000), 7500)).toBe(false);
  });

  it("allows an amount within the limit", () => {
    expect(withinApprovalLimit("HOD", limit(5000), 4999.99)).toBe(true);
    expect(withinApprovalLimit("HOD", limit(5000), 5000)).toBe(true);
  });

  it("treats unlimited as no ceiling", () => {
    expect(withinApprovalLimit("FINANCE", limit(null, true), 10_000_000)).toBe(true);
  });

  it("treats an unconfigured limit as no ceiling", () => {
    expect(withinApprovalLimit("FINANCE", undefined, 10_000)).toBe(true);
  });
});

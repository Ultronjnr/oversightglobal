import { describe, it, expect } from "vitest";
import { scopeAllows, DEFAULT_ORG_SETTINGS } from "./org-settings.service";

describe("org-settings scopeAllows", () => {
  it("never allows suppliers", () => {
    expect(scopeAllows("ALL_STAFF", "SUPPLIER")).toBe(false);
    expect(scopeAllows("HOD_UP", "SUPPLIER")).toBe(false);
    expect(scopeAllows("FINANCE_ADMIN", "SUPPLIER")).toBe(false);
  });

  it("ALL_STAFF allows all internal roles", () => {
    expect(scopeAllows("ALL_STAFF", "EMPLOYEE")).toBe(true);
    expect(scopeAllows("ALL_STAFF", "HOD")).toBe(true);
    expect(scopeAllows("ALL_STAFF", "FINANCE")).toBe(true);
    expect(scopeAllows("ALL_STAFF", "ADMIN")).toBe(true);
  });

  it("HOD_UP excludes employees", () => {
    expect(scopeAllows("HOD_UP", "EMPLOYEE")).toBe(false);
    expect(scopeAllows("HOD_UP", "HOD")).toBe(true);
    expect(scopeAllows("HOD_UP", "FINANCE")).toBe(true);
    expect(scopeAllows("HOD_UP", "ADMIN")).toBe(true);
  });

  it("FINANCE_ADMIN excludes employees and HODs", () => {
    expect(scopeAllows("FINANCE_ADMIN", "EMPLOYEE")).toBe(false);
    expect(scopeAllows("FINANCE_ADMIN", "HOD")).toBe(false);
    expect(scopeAllows("FINANCE_ADMIN", "FINANCE")).toBe(true);
    expect(scopeAllows("FINANCE_ADMIN", "ADMIN")).toBe(true);
  });

  it("denies null/undefined roles", () => {
    expect(scopeAllows("ALL_STAFF", null)).toBe(false);
    expect(scopeAllows("ALL_STAFF", undefined)).toBe(false);
  });

  it("defaults are restrictive", () => {
    expect(DEFAULT_ORG_SETTINGS.funding_source_editors).toBe("FINANCE_ADMIN");
    // HODs must be able to source supplier quotes by default (entry point lives in HOD portal).
    expect(DEFAULT_ORG_SETTINGS.supplier_sourcing_roles).toBe("HOD_UP");
  });
});

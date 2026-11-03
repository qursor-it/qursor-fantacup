import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  AUTH_ONBOARDING_PATH,
  resolvePostAuthRedirect,
  sanitizeNextPath,
} from "./post-auth";

describe("sanitizeNextPath", () => {
  it("accepts internal paths", () => {
    expect(sanitizeNextPath("/partite")).toBe("/partite");
  });

  it("rejects external paths", () => {
    expect(sanitizeNextPath("https://example.com")).toBe("");
    expect(sanitizeNextPath("//example.com")).toBe("");
    expect(sanitizeNextPath("/\\example.com")).toBe("");
    expect(sanitizeNextPath("/\\/example.com")).toBe("");
    expect(sanitizeNextPath("/\texample.com")).toBe("");
  });

  it("rejects non-string values", () => {
    expect(sanitizeNextPath(null)).toBe("");
  });
});

describe("resolvePostAuthRedirect", () => {
  it("sends admins to the admin area by default", () => {
    expect(
      resolvePostAuthRedirect({
        role: UserRole.ADMIN,
        hasFantasyTeam: false,
      })
    ).toBe("/admin");
  });

  it("keeps the requested internal path for admins", () => {
    expect(
      resolvePostAuthRedirect({
        role: UserRole.ADMIN,
        hasFantasyTeam: false,
        next: "/admin/partite",
      })
    ).toBe("/admin/partite");
  });

  it("sends users without a fantasy team to onboarding", () => {
    expect(
      resolvePostAuthRedirect({
        role: UserRole.USER,
        hasFantasyTeam: false,
        next: "/vota/12",
      })
    ).toBe(AUTH_ONBOARDING_PATH);
  });

  it("keeps the requested path for users who already have a fantasy team", () => {
    expect(
      resolvePostAuthRedirect({
        role: UserRole.USER,
        hasFantasyTeam: true,
        next: "/vota/12",
      })
    ).toBe("/vota/12");
  });

  it("falls back to the dashboard for users with a fantasy team", () => {
    expect(
      resolvePostAuthRedirect({
        role: UserRole.USER,
        hasFantasyTeam: true,
      })
    ).toBe("/dashboard");
  });
});

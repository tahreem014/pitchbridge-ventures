import { describe, it, expect } from "vitest";
import { resolveActiveRole } from "@/lib/roles";

describe("resolveActiveRole", () => {
  it("returns null when the user holds no role", () => {
    expect(resolveActiveRole([], null)).toBeNull();
    expect(resolveActiveRole([], "investor")).toBeNull();
  });

  it("uses the only role a user has", () => {
    expect(resolveActiveRole(["investor"], null)).toBe("investor");
  });

  it("defaults a dual-role user to entrepreneur, matching get_primary_role()", () => {
    expect(resolveActiveRole(["investor", "entrepreneur"], null)).toBe("entrepreneur");
  });

  it("prefers admin when nothing else was chosen", () => {
    expect(resolveActiveRole(["investor", "admin", "entrepreneur"], null)).toBe("admin");
  });

  it("honours a saved choice the user still holds", () => {
    expect(resolveActiveRole(["entrepreneur", "investor"], "investor")).toBe("investor");
  });

  it("ignores a saved choice the user does not hold", () => {
    expect(resolveActiveRole(["entrepreneur"], "investor")).toBe("entrepreneur");
    expect(resolveActiveRole(["entrepreneur"], "admin")).toBe("entrepreneur");
  });

  it("ignores garbage in storage", () => {
    expect(resolveActiveRole(["entrepreneur", "investor"], "superuser")).toBe("entrepreneur");
    expect(resolveActiveRole(["investor"], "")).toBe("investor");
  });
});

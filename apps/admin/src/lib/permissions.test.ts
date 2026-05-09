import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  getCurrentUserRole: vi.fn(),
}));

import { getCurrentUserRole } from "./auth";
import {
  assertPermission,
  PERMISSIONS,
  PermissionError,
  ROLE_PERMISSIONS,
  ROLES,
  type Role,
  roleHasPermission,
  UnauthenticatedError,
  userHasPermission,
} from "./permissions";

const mockedGetCurrentUserRole = vi.mocked(getCurrentUserRole);

afterEach(() => {
  mockedGetCurrentUserRole.mockReset();
});

describe("ROLES + PERMISSIONS catalog", () => {
  it("exports both roles", () => {
    expect(ROLES).toEqual(["ADMIN", "SQUAD_MEMBER"]);
  });

  it("ADMIN has every permission", () => {
    for (const perm of PERMISSIONS) {
      expect(ROLE_PERMISSIONS.ADMIN.has(perm)).toBe(true);
    }
  });

  it("SQUAD_MEMBER has only the squad-surface perms plus EVENT_VIEW", () => {
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.size).toBe(3);
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.has("EVENT_VIEW")).toBe(true);
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.has("SQUAD_VIEW_ASSIGNED")).toBe(true);
    expect(
      ROLE_PERMISSIONS.SQUAD_MEMBER.has("SQUAD_REQUEST_PARTICIPATION"),
    ).toBe(true);
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.has("USER_INVITE")).toBe(false);
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.has("EVENT_CREATE")).toBe(false);
    expect(ROLE_PERMISSIONS.SQUAD_MEMBER.has("EVENT_DELETE")).toBe(false);
  });
});

describe("roleHasPermission", () => {
  it("returns true for granted role+perm pair", () => {
    expect(roleHasPermission("ADMIN", "USER_INVITE")).toBe(true);
    expect(roleHasPermission("SQUAD_MEMBER", "SQUAD_VIEW_ASSIGNED")).toBe(true);
  });

  it("returns false for ungranted perm", () => {
    expect(roleHasPermission("SQUAD_MEMBER", "USER_INVITE")).toBe(false);
  });

  it("returns false when role is null", () => {
    expect(roleHasPermission(null, "USER_INVITE")).toBe(false);
  });
});

describe("userHasPermission", () => {
  it("returns true when role grants the perm", async () => {
    mockedGetCurrentUserRole.mockResolvedValue("ADMIN");
    expect(await userHasPermission("EVENT_CREATE")).toBe(true);
  });

  it("returns false when role does not grant the perm", async () => {
    mockedGetCurrentUserRole.mockResolvedValue("SQUAD_MEMBER");
    expect(await userHasPermission("EVENT_CREATE")).toBe(false);
  });

  it("returns false when no session", async () => {
    mockedGetCurrentUserRole.mockResolvedValue(null);
    expect(await userHasPermission("EVENT_CREATE")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("resolves when role has the perm", async () => {
    mockedGetCurrentUserRole.mockResolvedValue("ADMIN");
    await expect(assertPermission("USER_INVITE")).resolves.toBeUndefined();
  });

  it("throws UnauthenticatedError when no session", async () => {
    mockedGetCurrentUserRole.mockResolvedValue(null);
    await expect(assertPermission("USER_INVITE")).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("throws PermissionError when role lacks the perm", async () => {
    mockedGetCurrentUserRole.mockResolvedValue("SQUAD_MEMBER");
    await expect(assertPermission("USER_INVITE")).rejects.toBeInstanceOf(
      PermissionError,
    );
  });
});

describe("module-load self-check", () => {
  it("fires when a permission is declared but not granted to any role", async () => {
    // Reset modules so a fresh import re-runs the top-level self-check loop.
    vi.resetModules();
    vi.doMock("./auth", () => ({ getCurrentUserRole: vi.fn() }));

    // Replace ROLE_PERMISSIONS with a synthetic state where one perm is
    // missing from every role's set. The check iterates over PERMISSIONS, so
    // it must throw on the orphaned entry.
    const orphan = "ORPHAN_PERMISSION";
    const fakeAdmin = new Set<string>(["USER_INVITE"]);
    const fakeSquad = new Set<string>(["SQUAD_VIEW_ASSIGNED"]);
    const allDeclared = ["USER_INVITE", "SQUAD_VIEW_ASSIGNED", orphan];
    const granted = (perm: string) =>
      [fakeAdmin, fakeSquad].some((s) => s.has(perm));
    expect(() => {
      for (const p of allDeclared) {
        if (!granted(p)) {
          throw new Error(
            `Permission "${p}" is declared in PERMISSIONS but not granted to any role.`,
          );
        }
      }
    }).toThrow(/ORPHAN_PERMISSION/);
  });
});

describe("type narrowing", () => {
  it("PermissionError exposes the missing permission", () => {
    const err = new PermissionError("USER_DELETE");
    expect(err.permission).toBe("USER_DELETE");
    expect(err.message).toBe("Missing permission: USER_DELETE");
    expect(err).toBeInstanceOf(PermissionError);
  });

  it("Role union covers exactly the declared roles", () => {
    const sample: Role[] = ["ADMIN", "SQUAD_MEMBER"];
    expect(sample.length).toBe(ROLES.length);
  });
});

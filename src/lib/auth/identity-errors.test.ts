import { describe, expect, it } from "vitest";
import { mapAuthError } from "@/lib/auth/identity-errors";

describe("mapAuthError", () => {
  it("maps identity collision to a non-merge existing-account error", () => {
    const mapped = mapAuthError({
      code: "identity_already_exists",
      message: "Identity is already linked to another user",
    });

    expect(mapped.kind).toBe("identity_collision");
    expect(mapped.merge).toBe(false);
    expect(mapped.messageKey).toBe("collisionBody");
  });

  it("maps email-already-used collisions without merging", () => {
    const mapped = mapAuthError({
      code: "email_exists",
      message: "Email already registered",
    });

    expect(mapped.kind).toBe("identity_collision");
    expect(mapped.merge).toBe(false);
  });

  it("maps unknown errors to a generic failure", () => {
    const mapped = mapAuthError({ message: "network down" });

    expect(mapped.kind).toBe("generic");
    expect(mapped.merge).toBe(false);
    expect(mapped.messageKey).toBe("genericError");
  });
});

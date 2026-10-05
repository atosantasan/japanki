import { describe, expect, it } from "vitest";
import {
  oauthCallbackAuthErrorParam,
  returnedAuthErrorState,
} from "@/lib/auth/oauth-callback-error";

describe("oauthCallbackAuthErrorParam", () => {
  it("returns null when the provider sent no error", () => {
    expect(
      oauthCallbackAuthErrorParam({
        error: null,
        errorCode: null,
        errorDescription: null,
      }),
    ).toBeNull();
  });

  it("maps an identity collision to a stable authError token", () => {
    expect(
      oauthCallbackAuthErrorParam({
        error: "server_error",
        errorCode: "identity_already_exists",
        errorDescription: "Identity is already linked to another user",
      }),
    ).toBe("identity_already_exists");
  });

  it("maps collision wording in the description when the code is generic", () => {
    expect(
      oauthCallbackAuthErrorParam({
        error: "server_error",
        errorCode: null,
        errorDescription: "Identity is already linked to another user",
      }),
    ).toBe("identity_already_exists");
  });

  it("maps other provider failures to a generic authError token", () => {
    expect(
      oauthCallbackAuthErrorParam({
        error: "access_denied",
        errorCode: null,
        errorDescription: "User denied access",
      }),
    ).toBe("generic");
  });
});

describe("returnedAuthErrorState", () => {
  it("opens the link modal for an identity collision without merging accounts", () => {
    const state = returnedAuthErrorState("identity_already_exists");

    expect(state.authError?.kind).toBe("identity_collision");
    expect(state.authError?.merge).toBe(false);
    expect(state.openLinkModal).toBe(true);
  });

  it("surfaces a generic OAuth failure in the link modal", () => {
    const state = returnedAuthErrorState("generic");

    expect(state.authError?.kind).toBe("generic");
    expect(state.openLinkModal).toBe(true);
  });

  it("leaves the modal closed when the callback sent no authError", () => {
    expect(returnedAuthErrorState(null)).toEqual({
      authError: null,
      openLinkModal: false,
    });
  });
});

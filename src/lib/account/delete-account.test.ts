import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_TEXT } from "@/lib/account/deletion";
import { deleteMyAccount } from "@/lib/account/delete-account";

describe("deleteMyAccount", () => {
  it("uses DELETE as the confirmation token", () => {
    expect(ACCOUNT_DELETION_CONFIRM_TEXT).toBe("DELETE");
  });

  it("returns 401 when the session has no user", async () => {
    const deleteAuthUser = vi.fn();
    const deleteStripeCustomerByEmail = vi.fn();

    const result = await deleteMyAccount({
      confirm: true,
      getUser: vi.fn().mockResolvedValue(null),
      deleteStripeCustomerByEmail,
      deleteAuthUser,
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "unauthenticated" });
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(deleteStripeCustomerByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm is not true", async () => {
    const deleteAuthUser = vi.fn();

    const result = await deleteMyAccount({
      confirm: false,
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "traveler@example.com",
      }),
      deleteStripeCustomerByEmail: vi.fn(),
      deleteAuthUser,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "confirmation_required" });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("allows anonymous users to delete their own account", async () => {
    const deleteAuthUser = vi.fn().mockResolvedValue(undefined);
    const deleteStripeCustomerByEmail = vi.fn();

    const result = await deleteMyAccount({
      confirm: true,
      getUser: vi.fn().mockResolvedValue({
        id: "anon-1",
        email: null,
        isAnonymous: true,
      }),
      deleteStripeCustomerByEmail,
      deleteAuthUser,
    });

    expect(result).toEqual({
      status: 200,
      body: { deleted: true },
    });
    expect(deleteAuthUser).toHaveBeenCalledWith("anon-1");
    expect(deleteStripeCustomerByEmail).not.toHaveBeenCalled();
  });

  it("deletes the auth user even when Stripe customer deletion fails", async () => {
    const deleteAuthUser = vi.fn().mockResolvedValue(undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await deleteMyAccount({
      confirm: true,
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "traveler@example.com",
        isAnonymous: false,
      }),
      deleteStripeCustomerByEmail: vi
        .fn()
        .mockRejectedValue(new Error("stripe down")),
      deleteAuthUser,
    });

    expect(deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ deleted: true });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("returns 500 when auth user deletion fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await deleteMyAccount({
      confirm: true,
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "traveler@example.com",
      }),
      deleteStripeCustomerByEmail: vi.fn(),
      deleteAuthUser: vi.fn().mockRejectedValue(new Error("auth down")),
    });

    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "Unable to delete account" });
    error.mockRestore();
  });
});

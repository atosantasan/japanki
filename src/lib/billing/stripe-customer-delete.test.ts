import { describe, expect, it, vi } from "vitest";
import { deleteStripeCustomerByEmail } from "@/lib/billing/stripe-customer-delete";

describe("deleteStripeCustomerByEmail", () => {
  it("skips Stripe when the user has no email", async () => {
    const listCustomers = vi.fn();
    const deleteCustomer = vi.fn();

    await expect(
      deleteStripeCustomerByEmail({
        email: null,
        listCustomers,
        deleteCustomer,
      }),
    ).resolves.toEqual({ attempted: false, deleted: false });

    expect(listCustomers).not.toHaveBeenCalled();
    expect(deleteCustomer).not.toHaveBeenCalled();
  });

  it("deletes the first Stripe customer matched by email", async () => {
    const deleteCustomer = vi.fn().mockResolvedValue(undefined);

    await expect(
      deleteStripeCustomerByEmail({
        email: "traveler@example.com",
        listCustomers: async (email) => {
          expect(email).toBe("traveler@example.com");
          return [{ id: "cus_123" }];
        },
        deleteCustomer,
      }),
    ).resolves.toEqual({ attempted: true, deleted: true });

    expect(deleteCustomer).toHaveBeenCalledWith("cus_123");
  });

  it("does not throw when no Stripe customer exists", async () => {
    await expect(
      deleteStripeCustomerByEmail({
        email: "nobody@example.com",
        listCustomers: async () => [],
        deleteCustomer: vi.fn(),
      }),
    ).resolves.toEqual({ attempted: true, deleted: false });
  });
});

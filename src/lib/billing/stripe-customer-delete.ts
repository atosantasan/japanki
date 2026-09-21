import { findCustomerIdForPortal } from "@/lib/billing/portal";

export async function deleteStripeCustomerByEmail(input: {
  email: string | null | undefined;
  listCustomers: (email: string) => Promise<{ id: string }[]>;
  deleteCustomer: (customerId: string) => Promise<void>;
}): Promise<{ attempted: boolean; deleted: boolean }> {
  const found = await findCustomerIdForPortal({
    email: input.email,
    listCustomers: input.listCustomers,
  });

  if (!found.ok) {
    return {
      attempted: found.code !== "no_email",
      deleted: false,
    };
  }

  await input.deleteCustomer(found.customerId);
  return { attempted: true, deleted: true };
}

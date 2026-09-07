export async function findCustomerIdForPortal(input: {
  email: string | null | undefined;
  listCustomers: (email: string) => Promise<{ id: string }[]>;
}): Promise<
  | { ok: true; customerId: string }
  | { ok: false; code: "no_email" | "no_customer" }
> {
  const email = input.email?.trim();
  if (!email) {
    return { ok: false, code: "no_email" };
  }

  const customers = await input.listCustomers(email);
  const customerId = customers[0]?.id;
  if (!customerId) {
    return { ok: false, code: "no_customer" };
  }

  return { ok: true, customerId };
}

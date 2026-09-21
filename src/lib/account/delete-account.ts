export type AccountUser = {
  id: string;
  email?: string | null;
  isAnonymous?: boolean;
};

export type DeleteAccountStore = {
  getUser: () => Promise<AccountUser | null>;
  deleteStripeCustomerByEmail: (email: string) => Promise<unknown>;
  deleteAuthUser: (userId: string) => Promise<void>;
};

export async function deleteMyAccount(input: {
  confirm: boolean;
  getUser: DeleteAccountStore["getUser"];
  deleteStripeCustomerByEmail: DeleteAccountStore["deleteStripeCustomerByEmail"];
  deleteAuthUser: DeleteAccountStore["deleteAuthUser"];
}): Promise<
  | { status: 200; body: { deleted: true } }
  | { status: 400; body: { error: "confirmation_required" } }
  | { status: 401; body: { error: "unauthenticated" } }
  | { status: 500; body: { error: "Unable to delete account" } }
> {
  if (!input.confirm) {
    return { status: 400, body: { error: "confirmation_required" } };
  }

  const user = await input.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  try {
    await input.deleteAuthUser(user.id);
  } catch (error) {
    console.error("Failed to delete auth user", user.id, error);
    return { status: 500, body: { error: "Unable to delete account" } };
  }

  const email = user.email?.trim();
  if (email) {
    try {
      await input.deleteStripeCustomerByEmail(email);
    } catch (error) {
      console.error("Failed to delete Stripe customer", user.id, error);
    }
  }

  return { status: 200, body: { deleted: true } };
}

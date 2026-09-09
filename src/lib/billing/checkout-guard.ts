export type CheckoutGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403;
      code: "unauthenticated" | "identity_linking_required";
    };

const LINKED_PROVIDERS = new Set(["google", "email"]);

export function hasLinkedIdentity(identityProviders: readonly string[]): boolean {
  return identityProviders.some((provider) => LINKED_PROVIDERS.has(provider));
}

export function canStartCheckout(input: {
  userId: string | null;
  isAnonymous: boolean;
  identityProviders: readonly string[];
}): CheckoutGuardResult {
  if (!input.userId) {
    return { ok: false, status: 401, code: "unauthenticated" };
  }

  if (input.isAnonymous || !hasLinkedIdentity(input.identityProviders)) {
    return { ok: false, status: 403, code: "identity_linking_required" };
  }

  return { ok: true };
}

export type DuplicatePurchaseGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: 400;
      code: "already_purchased";
      error: "既に購入済みのパックです";
    };

export function rejectIfAlreadyOwned(
  alreadyOwned: boolean,
): DuplicatePurchaseGuardResult {
  if (alreadyOwned) {
    return {
      ok: false,
      status: 400,
      code: "already_purchased",
      error: "既に購入済みのパックです",
    };
  }

  return { ok: true };
}

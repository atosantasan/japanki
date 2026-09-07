import { NextResponse } from "next/server";
import { canStartCheckout } from "@/lib/billing/checkout-guard";
import { findCustomerIdForPortal } from "@/lib/billing/portal";
import { getStripe } from "@/lib/billing/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = body.locale || "en";

  const userClient = await createServerSupabaseClient();
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const identityProviders = (userData.user.identities ?? []).map(
    (identity) => identity.provider,
  );
  const { data: profile } = await userClient
    .from("profiles")
    .select("is_anonymous")
    .eq("id", userData.user.id)
    .maybeSingle();

  const guard = canStartCheckout({
    userId: userData.user.id,
    isAnonymous: Boolean(profile?.is_anonymous),
    identityProviders,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status });
  }

  const stripe = getStripe();
  const found = await findCustomerIdForPortal({
    email: userData.user.email,
    listCustomers: async (email) => {
      const list = await stripe.customers.list({ email, limit: 1 });
      return list.data.map((customer) => ({ id: customer.id }));
    },
  });
  if (!found.ok) {
    const status = found.code === "no_email" ? 400 : 404;
    return NextResponse.json({ error: found.code }, { status });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: found.customerId,
    return_url: `${origin}/${locale}/account`,
  });

  return NextResponse.json({ url: session.url });
}

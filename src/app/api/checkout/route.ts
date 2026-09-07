import { NextResponse } from "next/server";
import { canStartCheckout } from "@/lib/billing/checkout-guard";
import { getStripe } from "@/lib/billing/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = (await request.json()) as { packId?: string; locale?: string };
  const packId = body.packId;
  const locale = body.locale || "en";
  if (!packId) {
    return NextResponse.json({ error: "pack_id is required" }, { status: 400 });
  }

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

  const admin = createAdminSupabaseClient();
  const { data: pack } = await admin
    .from("content_packs")
    .select("id, is_free, price_usd, stripe_price_id, title")
    .eq("id", packId)
    .maybeSingle();

  if (!pack) {
    return NextResponse.json({ error: "Content pack not found" }, { status: 404 });
  }
  if (pack.is_free) {
    return NextResponse.json({ error: "Pack is free" }, { status: 400 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const stripe = getStripe();
  const title =
    pack.title && typeof pack.title === "object" && pack.title !== null
      ? String((pack.title as Record<string, string>).en ?? packId)
      : packId;

  const lineItem = pack.stripe_price_id
    ? { price: pack.stripe_price_id, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(Number(pack.price_usd ?? 0) * 100),
          product_data: { name: `Japanki ${title}` },
        },
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: userData.user.email,
    customer_creation: "always",
    line_items: [lineItem],
    client_reference_id: userData.user.id,
    metadata: {
      supabase_user_id: userData.user.id,
      pack_id: packId,
    },
    success_url: `${origin}/${locale}/success?pack=${encodeURIComponent(packId)}`,
    cancel_url: `${origin}/${locale}`,
  });

  return NextResponse.json({ url: session.url });
}

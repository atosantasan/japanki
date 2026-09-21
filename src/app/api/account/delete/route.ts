import { NextResponse } from "next/server";
import { deleteMyAccount } from "@/lib/account/delete-account";
import { deleteStripeCustomerByEmail } from "@/lib/billing/stripe-customer-delete";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    confirm?: unknown;
  };
  const userClient = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  const result = await deleteMyAccount({
    confirm: body.confirm === true,
    async getUser() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return {
        id: data.user.id,
        email: data.user.email,
        isAnonymous: Boolean(data.user.is_anonymous),
      };
    },
    async deleteStripeCustomerByEmail(email) {
      const stripe = getStripe();
      await deleteStripeCustomerByEmail({
        email,
        listCustomers: async (customerEmail) => {
          const list = await stripe.customers.list({
            email: customerEmail,
            limit: 1,
          });
          return list.data.map((customer) => ({ id: customer.id }));
        },
        deleteCustomer: async (customerId) => {
          await stripe.customers.del(customerId);
        },
      });
    },
    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        throw error;
      }
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from "next/server";
import { exportMyDataForRequest } from "@/lib/account/export-my-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const result = await exportMyDataForRequest({
    async getUser() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return {
        id: data.user.id,
        email: data.user.email,
        isAnonymous: Boolean(data.user.is_anonymous),
        providers: (data.user.identities ?? []).map(
          (identity) => identity.provider,
        ),
        createdAt: data.user.created_at,
      };
    },
    async exportMyData() {
      const { data, error } = await userClient.rpc("export_my_data");
      if (error) {
        throw error;
      }
      return data;
    },
  });

  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return new NextResponse(JSON.stringify(result.body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}

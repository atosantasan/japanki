export type ExportAuthUser = {
  id: string;
  email?: string | null;
  isAnonymous?: boolean;
  providers?: string[];
  createdAt?: string | null;
};

export type ExportMyDataPayload = {
  exported_at: string;
  auth: {
    id: string;
    email: string | null;
    is_anonymous: boolean;
    providers: string[];
    created_at: string | null;
  };
  profile: unknown;
  purchases: unknown;
  quiz_sessions: unknown;
};

export async function exportMyDataForRequest(input: {
  getUser: () => Promise<ExportAuthUser | null>;
  exportMyData: () => Promise<unknown>;
  now?: Date;
}): Promise<
  | {
      status: 200;
      filename: string;
      body: ExportMyDataPayload;
    }
  | { status: 401; body: { error: "unauthenticated" }; filename?: undefined }
  | { status: 500; body: { error: "Unable to export data" }; filename?: undefined }
> {
  const user = await input.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  try {
    const rpcPayload = await input.exportMyData();
    const data =
      rpcPayload && typeof rpcPayload === "object"
        ? (rpcPayload as Record<string, unknown>)
        : {};
    const exportedAt = (input.now ?? new Date()).toISOString();
    const body: ExportMyDataPayload = {
      exported_at: exportedAt,
      auth: {
        id: user.id,
        email: user.email ?? null,
        is_anonymous: Boolean(user.isAnonymous),
        providers: user.providers ?? [],
        created_at: user.createdAt ?? null,
      },
      profile: data.profile ?? null,
      purchases: data.purchases ?? [],
      quiz_sessions: data.quiz_sessions ?? [],
    };

    return {
      status: 200,
      filename: `japanki-export-${user.id}-${exportedAt.slice(0, 10)}.json`,
      body,
    };
  } catch (error) {
    console.error("Failed to export account data", user.id, error);
    return { status: 500, body: { error: "Unable to export data" } };
  }
}

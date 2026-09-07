export type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, string>,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export type CreatedQuizSession = {
  sessionId: string;
};

export type ConsumeHeartResult = {
  remainingHearts: number;
  updatedAt: string;
};

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return null;
}

export async function createQuizSession(
  client: RpcClient,
  packId: string,
): Promise<CreatedQuizSession> {
  const { data, error } = await client.rpc("create_quiz_session", {
    pack_id_param: packId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data);
  const sessionId = row?.session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("Quiz session was not created");
  }

  return { sessionId };
}

export async function consumeHeart(
  client: RpcClient,
  sessionId: string,
  phraseId: string,
): Promise<ConsumeHeartResult> {
  const { data, error } = await client.rpc("consume_heart", {
    session_id_param: sessionId,
    phrase_id_param: phraseId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data);
  const remainingHearts = row?.remaining_hearts;
  const updatedAt = row?.updated_at;
  if (typeof remainingHearts !== "number" || typeof updatedAt !== "string") {
    throw new Error("Heart state was not returned");
  }

  return { remainingHearts, updatedAt };
}

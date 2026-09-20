import {
  ANONYMOUS_RETENTION_DAYS,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants/app";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CleanupProfile = {
  id: string;
  is_anonymous: boolean;
  created_at: string;
};

export type SubmitAnswerCallRow = {
  id: string;
  called_at: string;
};

export type AnonymousUserCleanupStore = {
  listAnonymousProfiles: () => Promise<CleanupProfile[]>;
  listPurchasedUserIds: (userIds: string[]) => Promise<string[]>;
  deleteAuthUser: (userId: string) => Promise<void>;
};

export type AnonymousCleanupStore = AnonymousUserCleanupStore & {
  deleteStaleSubmitAnswerCalls: (cutoffIso: string) => Promise<number>;
};

export function selectAnonymousUserIdsForCleanup(input: {
  profiles: CleanupProfile[];
  purchasedUserIds: Iterable<string>;
  now?: Date;
  retentionDays?: number;
}): string[] {
  const now = input.now ?? new Date();
  const retentionDays = input.retentionDays ?? ANONYMOUS_RETENTION_DAYS;
  const cutoffMs = now.getTime() - retentionDays * DAY_MS;
  const purchased = new Set(input.purchasedUserIds);

  return input.profiles
    .filter(
      (profile) =>
        profile.is_anonymous &&
        Date.parse(profile.created_at) <= cutoffMs &&
        !purchased.has(profile.id),
    )
    .map((profile) => profile.id);
}

export function selectStaleSubmitAnswerCallIds(input: {
  rows: SubmitAnswerCallRow[];
  now?: Date;
  retentionMs?: number;
}): string[] {
  const now = input.now ?? new Date();
  const retentionMs = input.retentionMs ?? RATE_LIMIT_WINDOW_MS;
  const cutoffMs = now.getTime() - retentionMs;
  return input.rows
    .filter((row) => Date.parse(row.called_at) < cutoffMs)
    .map((row) => row.id);
}

export async function cleanupAnonymousUsers(
  store: AnonymousUserCleanupStore,
  options?: { now?: Date; retentionDays?: number },
): Promise<{ deleted: number; failed: number }> {
  const profiles = await store.listAnonymousProfiles();
  const purchasedUserIds = await store.listPurchasedUserIds(
    profiles.map((profile) => profile.id),
  );
  const ids = selectAnonymousUserIdsForCleanup({
    profiles,
    purchasedUserIds,
    now: options?.now,
    retentionDays: options?.retentionDays,
  });

  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await store.deleteAuthUser(id);
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to delete anonymous user", id, error);
    }
  }

  console.info("Anonymous user cleanup", {
    deleted,
    failed,
    scanned: profiles.length,
  });
  return { deleted, failed };
}

export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) {
    return false;
  }
  return authorizationHeader === `Bearer ${secret}`;
}

export async function handleAnonymousCleanupRequest(input: {
  authorizationHeader: string | null;
  cronSecret: string | undefined;
  store: AnonymousCleanupStore;
  now?: Date;
}): Promise<
  | {
      status: 200;
      body: {
        deleted: number;
        failed: number;
        submitAnswerCallsDeleted: number;
      };
    }
  | { status: 401 | 500; body: { error: string } }
> {
  if (!isAuthorizedCronRequest(input.authorizationHeader, input.cronSecret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  try {
    const result = await cleanupAnonymousUsers(input.store, { now: input.now });
    const cutoff = new Date(
      (input.now ?? new Date()).getTime() - RATE_LIMIT_WINDOW_MS,
    ).toISOString();
    const submitAnswerCallsDeleted =
      await input.store.deleteStaleSubmitAnswerCalls(cutoff);
    console.info("Submit answer call cleanup", {
      deleted: submitAnswerCallsDeleted,
    });
    return {
      status: 200,
      body: { ...result, submitAnswerCallsDeleted },
    };
  } catch (error) {
    console.error("Anonymous user cleanup failed", error);
    return { status: 500, body: { error: "Unable to clean up anonymous users" } };
  }
}

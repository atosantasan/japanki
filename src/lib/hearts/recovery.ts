export const HEART_RECOVERY_MINUTES = 30;
export const MAX_HEARTS = 5;

export type HeartRecovery = {
  hearts: number;
  msUntilNext: number | null;
};

export function recoverHearts(input: {
  storedHearts: number;
  lastHeartUpdatedAt: Date;
  now: Date;
}): HeartRecovery {
  const elapsedMs = Math.max(
    0,
    input.now.getTime() - input.lastHeartUpdatedAt.getTime(),
  );
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  const recovered = Math.floor(elapsedMinutes / HEART_RECOVERY_MINUTES);
  const hearts = Math.min(MAX_HEARTS, Math.max(0, input.storedHearts) + recovered);

  if (hearts >= MAX_HEARTS) {
    return { hearts: MAX_HEARTS, msUntilNext: null };
  }

  const minutesIntoCycle = elapsedMinutes % HEART_RECOVERY_MINUTES;
  const msIntoCurrentMinute = elapsedMs % 60_000;
  const msUntilNext =
    (HEART_RECOVERY_MINUTES - minutesIntoCycle) * 60_000 - msIntoCurrentMinute;

  return { hearts, msUntilNext };
}

export function formatCountdown(msUntilNext: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msUntilNext / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function recoveredHeartCount(input: {
  storedHearts: number;
  lastHeartUpdatedAt: string | null | undefined;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const lastHeartUpdatedAt = input.lastHeartUpdatedAt
    ? new Date(input.lastHeartUpdatedAt)
    : now;
  return recoverHearts({
    storedHearts: input.storedHearts,
    lastHeartUpdatedAt,
    now,
  }).hearts;
}

export function shouldShowHeartsEmpty(input: {
  storedHearts: number;
  lastHeartUpdatedAt: string | null | undefined;
  now?: Date;
}): boolean {
  return recoveredHeartCount(input) === 0;
}

export function canPlayWithHearts(remainingHearts: number): boolean {
  return remainingHearts > 0;
}

export function applyHeartRecovery(input: {
  storedHearts: number;
  lastHeartUpdatedAt: Date | string | null | undefined;
  now?: Date;
}): {
  hearts: number;
  lastHeartUpdatedAt: string;
  msUntilNext: number | null;
} {
  const now = input.now ?? new Date();
  const parsed = input.lastHeartUpdatedAt
    ? new Date(input.lastHeartUpdatedAt)
    : now;
  const lastHeartUpdatedAt = Number.isNaN(parsed.getTime()) ? now : parsed;
  const storedHearts = Math.max(0, input.storedHearts);
  const recovered = recoverHearts({
    storedHearts,
    lastHeartUpdatedAt,
    now,
  });
  const added = Math.max(0, recovered.hearts - storedHearts);
  const nextUpdatedAt =
    recovered.hearts >= MAX_HEARTS && added > 0
      ? now
      : new Date(
          lastHeartUpdatedAt.getTime() +
            added * HEART_RECOVERY_MINUTES * 60_000,
        );

  return {
    hearts: recovered.hearts,
    lastHeartUpdatedAt: nextUpdatedAt.toISOString(),
    msUntilNext: recovered.msUntilNext,
  };
}

export function toPlayableHearts(input: {
  remainingHearts: number;
  updatedAt: string;
  now?: Date;
}): { remainingHearts: number; updatedAt: string } {
  const applied = applyHeartRecovery({
    storedHearts: input.remainingHearts,
    lastHeartUpdatedAt: input.updatedAt,
    now: input.now,
  });
  return {
    remainingHearts: applied.hearts,
    updatedAt: applied.lastHeartUpdatedAt,
  };
}

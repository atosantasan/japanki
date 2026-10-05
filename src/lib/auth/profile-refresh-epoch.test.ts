import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProfileRefreshEpoch } from "./profile-refresh-epoch";

const authProviderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../components/auth/AuthProvider.tsx"),
  "utf8",
);

describe("createProfileRefreshEpoch", () => {
  it("keeps overlapping profile refreshes applicable until sign-out", () => {
    const epoch = createProfileRefreshEpoch();
    const first = epoch.capture();
    const second = epoch.capture();

    expect(epoch.isCurrent(first)).toBe(true);
    expect(epoch.isCurrent(second)).toBe(true);
  });

  it("drops a refresh that started before sign-out and keeps the one after it", () => {
    const epoch = createProfileRefreshEpoch();
    const inFlight = epoch.capture();

    epoch.invalidate();
    expect(epoch.isCurrent(inFlight)).toBe(false);

    epoch.invalidate();
    const afterSignOut = epoch.capture();

    expect(epoch.isCurrent(afterSignOut)).toBe(true);
    expect(epoch.isCurrent(inFlight)).toBe(false);
  });
});

describe("AuthProvider sign-out profile race", () => {
  it("invalidates in-flight profile refreshes before clearing the session", () => {
    expect(authProviderSource).toMatch(/createProfileRefreshEpoch/);
    expect(authProviderSource).toMatch(
      /invalidate\(\);\s*const supabase = createBrowserSupabaseClient\(\);\s*await supabase\.auth\.signOut\(\)/,
    );
    expect(authProviderSource).toMatch(
      /event === "SIGNED_OUT"\) \{\s*profileRefreshEpochRef\.current\.invalidate\(\)/,
    );
  });

  it("applies profile writes only when that refresh is still current", () => {
    const refreshStart = authProviderSource.indexOf("const refreshProfile = useCallback");
    const refreshEnd = authProviderSource.indexOf("const openLinkModal = useCallback");
    const refreshSource = authProviderSource.slice(refreshStart, refreshEnd);

    expect(refreshSource).toMatch(/\.capture\(\)/);
    expect(refreshSource).toMatch(/if \(!isCurrent\(\)\)/);
    expect(refreshSource.match(/if \(!isCurrent\(\)\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

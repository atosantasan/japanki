"use client";

import { AuthBar } from "@/components/auth/AuthBar";
import { useAuth } from "@/components/auth/AuthProvider";
import { HeartsStatus } from "@/components/hearts/HeartsStatus";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

export function AppHeader() {
  const { profile } = useAuth();

  return (
    <header className="relative z-10 flex flex-col gap-4 px-6 py-6 md:px-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-noto-sans-jp)] text-sm tracking-[0.35em] text-cream/70 hover:text-cream"
        >
          音で覚える
        </Link>
        <div className="flex items-center gap-3">
          <AuthBar />
          <LocaleSwitcher />
        </div>
      </div>
      {profile ? (
        <HeartsStatus
          storedHearts={profile.hearts}
          lastHeartUpdatedAt={profile.lastHeartUpdatedAt}
        />
      ) : null}
    </header>
  );
}

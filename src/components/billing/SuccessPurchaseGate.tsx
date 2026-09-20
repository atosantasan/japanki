"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { waitForPurchase } from "@/lib/billing/wait-for-purchase";
import { CONTACT_EMAIL } from "@/lib/constants/app";

type SuccessPurchaseGateProps = {
  packId: string;
};

type GatePhase = "polling" | "confirmed" | "timedOut";

export function SuccessPurchaseGate({ packId }: SuccessPurchaseGateProps) {
  const t = useTranslations("Success");
  const { refreshProfile } = useAuth();
  const [phase, setPhase] = useState<GatePhase>("polling");
  const [attempt, setAttempt] = useState(0);

  const runPoll = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      setPhase("polling");
      const result = await waitForPurchase({
        packId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result.confirmed) {
        await refreshProfile();
        if (!controller.signal.aborted) {
          setPhase("confirmed");
        }
        return;
      }
      if (result.timedOut) {
        setPhase("timedOut");
      }
    })();

    return () => {
      controller.abort();
    };
  }, [attempt, packId, refreshProfile]);

  return (
    <div className="mt-8 flex flex-col items-start gap-4">
      {phase === "polling" ? (
        <p className="text-sm text-cream/70">{t("confirming")}</p>
      ) : null}
      {phase === "timedOut" ? (
        <div className="space-y-2 text-sm text-cream/70">
          <p>{t("timeout")}</p>
          <a
            className="inline-block underline decoration-cream/30 underline-offset-4 hover:text-cream"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {t("contact", { email: CONTACT_EMAIL })}
          </a>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {phase === "confirmed" ? (
          <Link
            href={`/quiz/${packId}`}
            className="inline-flex w-fit rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink"
          >
            {t("cta")}
          </Link>
        ) : (
          <button
            type="button"
            disabled={phase === "polling"}
            onClick={phase === "timedOut" ? runPoll : undefined}
            className="inline-flex w-fit rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === "timedOut" ? t("retry") : t("cta")}
          </button>
        )}
        <Link
          href="/account"
          className="inline-flex w-fit rounded-full border border-cream/25 px-6 py-3 text-sm font-semibold text-cream"
        >
          {t("accountCta")}
        </Link>
      </div>
    </div>
  );
}

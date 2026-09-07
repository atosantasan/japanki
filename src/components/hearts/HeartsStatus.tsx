"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatCountdown, recoverHearts } from "@/lib/hearts/recovery";

export function HeartsStatus({
  storedHearts,
  lastHeartUpdatedAt,
}: {
  storedHearts: number;
  lastHeartUpdatedAt: string | null;
}) {
  const t = useTranslations("Hearts");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const recovered = recoverHearts({
    storedHearts,
    lastHeartUpdatedAt: lastHeartUpdatedAt
      ? new Date(lastHeartUpdatedAt)
      : new Date(now),
    now: new Date(now),
  });

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className="flex items-center gap-2"
        aria-label={`${t("label")}: ${recovered.hearts}`}
      >
        <span className="text-xs uppercase tracking-[0.2em] text-cream/60">
          {t("label")}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, index) => (
            <Heart
              key={index}
              className={
                index < recovered.hearts
                  ? "h-5 w-5 fill-sun text-sun"
                  : "h-5 w-5 text-cream/25"
              }
            />
          ))}
        </div>
      </div>
      <p className="text-xs tracking-wide text-cream/55">
        {recovered.msUntilNext === null
          ? t("full")
          : t("nextIn", { time: formatCountdown(recovered.msUntilNext) })}
      </p>
    </div>
  );
}

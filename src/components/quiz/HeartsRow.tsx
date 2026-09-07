"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";

export function HeartsRow({ hearts }: { hearts: number }) {
  const t = useTranslations("Hearts");
  const filled = Math.max(0, Math.min(5, hearts));

  return (
    <div className="flex items-center gap-2" aria-label={`${t("label")}: ${filled}`}>
      <span className="text-xs uppercase tracking-[0.2em] text-cream/60">
        {t("label")}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <Heart
            key={index}
            className={
              index < filled
                ? "h-5 w-5 fill-sun text-sun"
                : "h-5 w-5 text-cream/25"
            }
          />
        ))}
      </div>
    </div>
  );
}

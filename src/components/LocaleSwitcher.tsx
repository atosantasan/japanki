"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label="Language" className="flex flex-wrap justify-center gap-2">
      {routing.locales.map((locale) => {
        const isActive = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            className={
              isActive
                ? "rounded-full bg-sun px-3 py-1 text-xs font-semibold tracking-wide text-ink"
                : "rounded-full border border-cream/20 px-3 py-1 text-xs font-medium tracking-wide text-cream/80 hover:border-cream/50 hover:text-cream"
            }
            aria-current={isActive ? "page" : undefined}
          >
            {LOCALE_LABELS[locale]}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, type SupportedLocale } from "@/lib/i18n/locales";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label>
      <span className="sr-only">Language</span>
      <select
        className="rounded-xl bg-transparent py-1 text-sm text-cream/80 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
        value={currentLocale}
        onChange={(event) => {
          const next = event.target.value;
          if (!(routing.locales as readonly string[]).includes(next)) {
            return;
          }
          router.replace(pathname, { locale: next as SupportedLocale });
        }}
      >
        {routing.locales.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}

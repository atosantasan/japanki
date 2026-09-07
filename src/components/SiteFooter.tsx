import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/constants/app";

export async function SiteFooter() {
  const legal = await getTranslations("Legal");
  const home = await getTranslations("HomePage");

  return (
    <footer className="relative z-10 mt-auto border-t border-cream/10 px-6 py-8 text-sm text-cream/60 md:px-10">
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        <Link
          className="underline decoration-cream/25 underline-offset-4 hover:text-cream"
          href="/terms"
        >
          {legal("termsNav")}
        </Link>
        <Link
          className="underline decoration-cream/25 underline-offset-4 hover:text-cream"
          href="/privacy"
        >
          {legal("privacyNav")}
        </Link>
        <Link
          className="underline decoration-cream/25 underline-offset-4 hover:text-cream"
          href="/legal"
        >
          {legal("tokushoNav")}
        </Link>
        <Link
          className="underline decoration-cream/25 underline-offset-4 hover:text-cream"
          href="/account"
        >
          {legal("accountNav")}
        </Link>
      </nav>
      <a
        className="mt-4 inline-block underline decoration-cream/30 underline-offset-4 hover:text-cream"
        href={`mailto:${CONTACT_EMAIL}`}
      >
        {home("contact")}: {CONTACT_EMAIL}
      </a>
    </footer>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalFrame } from "@/components/legal/LegalFrame";
import { LEGAL_TERMS_SECTIONS } from "@/lib/legal/sections";
import { routing } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal.terms");

  return (
    <LegalFrame title={t("title")}>
      <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-cream/80">
        {t("intro")}
      </p>
      <div className="mt-12 space-y-10">
        {LEGAL_TERMS_SECTIONS.map((section) => (
          <section key={section}>
            <h2 className="text-xl font-semibold text-cream">
              {t(`${section}.title`)}
            </h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-cream/75">
              {t(`${section}.body`)}
            </p>
          </section>
        ))}
      </div>
    </LegalFrame>
  );
}

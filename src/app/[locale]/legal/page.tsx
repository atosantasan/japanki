import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalFrame } from "@/components/legal/LegalFrame";
import { TOKUSHO_FIELDS } from "@/lib/legal/sections";
import { routing } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function tokushoKeys(field: (typeof TOKUSHO_FIELDS)[number]): {
  label: string;
  value: string;
} {
  const suffix = field.charAt(0).toUpperCase() + field.slice(1);
  return {
    label: `label${suffix}`,
    value: `value${suffix}`,
  };
}

export default async function TokushoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal.tokusho");

  return (
    <LegalFrame title={t("title")}>
      <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-cream/80">
        {t("intro")}
      </p>
      <dl className="mt-12 divide-y divide-cream/10 border-y border-cream/10">
        {TOKUSHO_FIELDS.map((field) => {
          const keys = tokushoKeys(field);
          return (
            <div
              key={field}
              className="grid gap-2 py-5 md:grid-cols-[12rem_1fr] md:gap-8"
            >
              <dt className="text-sm uppercase tracking-[0.18em] text-sun">
                {t(keys.label as "labelSeller")}
              </dt>
              <dd className="text-cream/80">{t(keys.value as "valueSeller")}</dd>
            </div>
          );
        })}
      </dl>
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-cream">
          {t("disclosureTitle")}
        </h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-cream/75">
          {t("disclosureBody")}
        </p>
      </section>
    </LegalFrame>
  );
}

import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PAID_PACK_ID } from "@/lib/constants/app";

type SuccessPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SuccessPage({ params }: SuccessPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Success");

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight text-cream">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cream/75">{t("body")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/quiz/${PAID_PACK_ID}`}
            className="inline-flex w-fit rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink"
          >
            {t("cta")}
          </Link>
          <Link
            href="/account"
            className="inline-flex w-fit rounded-full border border-cream/25 px-6 py-3 text-sm font-semibold text-cream"
          >
            {t("accountCta")}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

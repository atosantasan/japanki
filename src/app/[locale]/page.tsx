import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { PurchaseButton } from "@/components/billing/PurchaseButton";
import { SiteFooter } from "@/components/SiteFooter";
import { Link } from "@/i18n/navigation";
import { FREE_PACK_ID, PAID_PACK_ID } from "@/lib/constants/app";
import { routing } from "@/i18n/routing";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-sun/90 blur-[2px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-16 right-10 h-40 w-40 rounded-full bg-ember/80"
      />
      <AppHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16 pt-8 md:px-10">
        <p className="mb-6 text-sm uppercase tracking-[0.28em] text-sun">
          {t("sessionHint")}
        </p>
        <h1 className="font-[family-name:var(--font-outfit)] text-6xl font-semibold tracking-tight text-cream md:text-8xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-xl text-xl leading-relaxed text-cream/80 md:text-2xl">
          {t("tagline")}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href={`/quiz/${FREE_PACK_ID}`}
            className="inline-flex w-fit items-center rounded-full bg-cream px-6 py-3 text-sm font-semibold tracking-wide text-ink"
          >
            {t("cta")}
          </Link>
          <Link
            href={`/quiz/${PAID_PACK_ID}`}
            className="inline-flex w-fit items-center rounded-full border border-cream/20 px-6 py-3 text-sm font-semibold tracking-wide text-cream"
          >
            {t("travelCta")}
          </Link>
          <PurchaseButton packId={PAID_PACK_ID} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

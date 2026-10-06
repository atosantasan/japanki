import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import {
  PurchaseButton,
  UnlimitedHeartsButton,
} from "@/components/billing/PurchaseButton";
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
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16 md:px-10">
        <h1 className="max-w-xl whitespace-pre-line font-[family-name:var(--font-noto-sans-jp)] text-4xl font-medium leading-tight text-cream md:text-5xl">
          {t("tagline")}
        </h1>
        <div className="mt-10 flex flex-col items-start gap-5">
          <Link
            href={`/quiz/${FREE_PACK_ID}`}
            className="inline-flex rounded-2xl bg-cream px-6 py-3.5 text-base font-medium text-ink outline-none hover:bg-cream/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
          >
            {t("cta")}
          </Link>
          <div className="flex flex-col items-start gap-3">
            <Link
              href={`/quiz/${PAID_PACK_ID}`}
              className="text-base text-cream/75 underline decoration-cream/25 underline-offset-[0.3em] outline-none hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
            >
              {t("travelCta")}
            </Link>
            <PurchaseButton packId={PAID_PACK_ID} />
            <UnlimitedHeartsButton />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { routing } from "@/i18n/routing";
import { SuccessPurchaseGate } from "@/components/billing/SuccessPurchaseGate";
import { PAID_PACK_ID } from "@/lib/constants/app";

type SuccessPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pack?: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SuccessPage({
  params,
  searchParams,
}: SuccessPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Success");
  const packId = query.pack?.trim() || PAID_PACK_ID;

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight text-cream">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cream/75">{t("body")}</p>
        <SuccessPurchaseGate packId={packId} />
      </main>
      <SiteFooter />
    </div>
  );
}

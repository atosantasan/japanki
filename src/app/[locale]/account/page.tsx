import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { AccountPanel } from "@/components/billing/AccountPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { routing } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Account");

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-ember/70 blur-[2px]"
      />
      <AppHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-8 md:px-10">
        <h1 className="font-[family-name:var(--font-outfit)] text-5xl font-semibold tracking-tight text-cream">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream/75">
          {t("subtitle")}
        </p>
        <AccountPanel />
      </main>
      <SiteFooter />
    </div>
  );
}

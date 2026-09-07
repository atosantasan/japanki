import { setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { QuizPlay } from "@/components/quiz/QuizPlay";
import { SiteFooter } from "@/components/SiteFooter";
import { routing } from "@/i18n/routing";

type QuizPageProps = {
  params: Promise<{ locale: string; packId: string }>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => [
    { locale, packId: "survival" },
    { locale, packId: "travel" },
  ]);
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { locale, packId } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-sun/90 blur-[2px]"
      />
      <AppHeader />
      <QuizPlay packId={packId} />
      <SiteFooter />
    </div>
  );
}

import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getTranslations } from "next-intl/server";

type LegalFrameProps = {
  title: string;
  children: React.ReactNode;
};

export async function LegalFrame({ title, children }: LegalFrameProps) {
  const legal = await getTranslations("Legal");

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-[-6rem] h-72 w-72 rounded-full bg-sun/80 blur-[1px]"
      />
      <AppHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-6 md:px-10">
        <p className="text-sm uppercase tracking-[0.28em] text-sun">
          {legal("updated")}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-outfit)] text-4xl font-semibold tracking-tight text-cream md:text-6xl">
          {title}
        </h1>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

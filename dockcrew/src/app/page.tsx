import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function Landing() {
  const t = await getTranslations();
  const steps = ["step1", "step2", "step3", "step4", "step5"] as const;
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-xl font-bold tracking-tight text-[#0f4c81]">
            {t("app.name")}
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitch label={t("nav.language")} />
            <Link href="/login" className="hidden text-sm font-medium text-slate-700 hover:underline sm:block">
              {t("nav.login")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{t("landing.heroTitle")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">{t("landing.heroText")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup/supplier"
              className="rounded-lg bg-[#0f4c81] px-5 py-3 text-center font-semibold text-white hover:bg-[#0c3d68]"
            >
              {t("nav.signupSupplier")}
            </Link>
            <Link
              href="/signup/team"
              className="rounded-lg border-2 border-[#0f4c81] px-5 py-3 text-center font-semibold text-[#0f4c81] hover:bg-blue-50"
            >
              {t("nav.signupTeam")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">{t("landing.region")}</p>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">{t("landing.forSuppliers")}</h2>
              <p className="mt-2 text-slate-700">{t("landing.forSuppliersText")}</p>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("landing.forTeams")}</h2>
              <p className="mt-2 text-slate-700">{t("landing.forTeamsText")}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-xl font-semibold">{t("landing.how")}</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f4c81] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-slate-800">{t(`landing.${s}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-6 text-sm text-slate-600">
          <span>© {new Date().getFullYear()} {t("app.name")}</span>
          <Link href="/terms" className="hover:underline">{t("footer.legal")}</Link>
          <Link href="/privacy" className="hover:underline">{t("footer.privacy")}</Link>
          <Link href="/contact" className="hover:underline">{t("footer.contact")}</Link>
        </div>
      </footer>
    </>
  );
}

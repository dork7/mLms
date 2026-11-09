import type { Metadata } from "next";
import { t } from "@/i18n";
import { SetupPage } from "../setup-shell";
import { PeriodsForm } from "./periods-form";

export const metadata: Metadata = { title: t("pageTitles.periods") };

export default function PeriodsPage() {
  return (
    <SetupPage title="setup.periods.title">
      {(setup) => (
        <section className="card">
          <p>
            {setup.periodsPerDay === null
              ? t("setup.periods.notSet")
              : t("setup.periods.current", { n: setup.periodsPerDay })}
          </p>
          <PeriodsForm current={setup.periodsPerDay} />
        </section>
      )}
    </SetupPage>
  );
}

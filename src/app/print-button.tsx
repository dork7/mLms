"use client";

import { t } from "@/i18n";

export function PrintButton() {
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      {t("examSchedule.print")}
    </button>
  );
}

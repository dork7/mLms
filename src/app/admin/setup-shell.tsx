// Shared frame for the Admin's school setup pages: loads the setup through the
// layer and shows the refusal text instead if the actor isn't allowed.
import Link from "next/link";
import type { ReactNode } from "react";
import { getSchoolSetup, type SchoolSetup } from "@/core/school/school-setup";
import { type MessageKey, t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export async function SetupPage({
  title,
  children,
}: {
  title: MessageKey;
  children: (setup: SchoolSetup) => ReactNode;
}) {
  let setup: SchoolSetup;
  try {
    setup = await asCurrentActor((ctx) => getSchoolSetup(ctx));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t(title)}</h1>
        <Link href="/admin">{t("setup.backToDashboard")}</Link>
      </header>
      {children(setup)}
    </main>
  );
}

export function FormError({ error }: { error?: MessageKey }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {t(error)}
    </p>
  );
}

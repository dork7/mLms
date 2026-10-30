// A Class's roster on one date, with a GET form to pick another date. Shown on the
// Admin's and the Teacher's Class pages; each Student links to their profile.
import Link from "next/link";
import type { RosterRow } from "@/core/enrollment/enrollment";
import { t } from "@/i18n";

export function ClassRoster({
  roster,
  date,
  profileHref,
}: {
  roster: RosterRow[];
  /** The date shown, or "" for today. */
  date: string;
  profileHref: (studentId: string) => string;
}) {
  return (
    <section className="card" aria-labelledby="roster">
      <h2 id="roster">{t("enrollment.rosterTitle")}</h2>
      <form method="get" className="inline-form">
        <label className="field">
          {t("enrollment.rosterOn")}
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button className="button" type="submit">
          {t("enrollment.show")}
        </button>
      </form>
      {roster.length === 0 ? (
        <p>{t("enrollment.rosterEmpty")}</p>
      ) : (
        <ul className="list">
          {roster.map((r) => (
            <li key={r.studentId}>
              <Link href={profileHref(r.studentId)}>
                {t("enrollment.rosterLine", { name: r.name, studentNumber: r.studentNumber })}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

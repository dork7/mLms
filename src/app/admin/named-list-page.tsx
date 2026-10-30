// The Grades, Subjects and Rooms pages: list every entry with an edit form, plus a create form.
import { t } from "@/i18n";
import { NamedForm } from "./named-list";
import type { NamedKind } from "./setup-actions";
import { SetupPage } from "./setup-shell";

const labels = {
  grades: { title: "setup.grades.title", name: "setup.grades.name", empty: "setup.grades.empty" },
  subjects: { title: "setup.subjects.title", name: "setup.subjects.name", empty: "setup.subjects.empty" },
  rooms: { title: "setup.rooms.title", name: "setup.rooms.name", empty: "setup.rooms.empty" },
} as const;

export function NamedListPage({ kind }: { kind: NamedKind }) {
  const l = labels[kind];
  return (
    <SetupPage title={l.title}>
      {(setup) => (
        <>
          <section className="card">
            <NamedForm kind={kind} label={l.name} />
          </section>
          <section className="card">
            {setup[kind].length === 0 ? (
              <p>{t(l.empty)}</p>
            ) : (
              <ul className="list">
                {setup[kind].map((item) => (
                  <li key={item.id}>
                    <NamedForm kind={kind} item={item} label={l.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </SetupPage>
  );
}

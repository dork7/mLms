// The Grades page: name each Grade and set the order Promotion follows.
import { t } from "@/i18n";
import { NamedForm } from "../named-list";
import { SetupPage } from "../setup-shell";
import { GradeOrderForm } from "./grade-order-form";

export default function GradesPage() {
  return (
    <SetupPage title="setup.grades.title">
      {(setup) => (
        <>
          <section className="card">
            <NamedForm kind="grades" label="setup.grades.name" />
          </section>
          <section className="card">
            {setup.gradesInOrder.length === 0 ? (
              <p>{t("setup.grades.empty")}</p>
            ) : (
              <>
                <p className="muted">{t("setup.grades.orderHint")}</p>
                <ul className="list">
                  {setup.gradesInOrder.map((grade) => (
                    <li key={grade.id}>
                      <NamedForm kind="grades" item={grade} label="setup.grades.name" />
                      <GradeOrderForm grade={grade} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </SetupPage>
  );
}

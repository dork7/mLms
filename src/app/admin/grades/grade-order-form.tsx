"use client";
// One Grade's place in the Admin's order. Empty clears it.
import { useActionState, useState } from "react";
import { type FormState, Refusal } from "@/app/form-kit";
import type { GradeInOrder } from "@/core/school/catalogue";
import { t } from "@/i18n";
import { saveGradeOrder } from "../setup-actions";

export function GradeOrderForm({ grade }: { grade: GradeInOrder }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveGradeOrder, { saved: 0 });
  const [order, setOrder] = useState(grade.order === null ? "" : String(grade.order));

  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="gradeId" value={grade.id} />
      <label className="field">
        {t("setup.grades.orderOf", { name: grade.name })}
        <input
          type="number"
          name="order"
          min="1"
          step="1"
          inputMode="numeric"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("setup.grades.setOrder")}
      </button>
      <Refusal error={state.error} />
    </form>
  );
}

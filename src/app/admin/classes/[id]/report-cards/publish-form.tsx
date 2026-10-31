"use client";
// The Admin's Publish or unpublish button for one Class and Term.
import { useActionState } from "react";
import { t } from "@/i18n";
import { Refusal } from "../../forms";
import type { FormState } from "../../../setup-actions";
import { publishAction, unpublishAction } from "./actions";

export function PublishForm({
  classId,
  termId,
  published,
}: {
  classId: number;
  termId: number;
  published: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    published ? unpublishAction : publishAction,
    { saved: 0 },
  );

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="termId" value={termId} />
      <button className="button" type="submit" disabled={pending}>
        {t(published ? "publish.unpublish" : "publish.publish")}
      </button>
    </form>
  );
}

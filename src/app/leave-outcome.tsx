// What the last decision on a decider's page did, read from the query `decideFromForm`
// leaves: the decision and, for a Student's request, how many Marks changed and how many
// were skipped because they're frozen. Or why it was refused.
import { isMessageKey, t } from "@/i18n";

export type LeaveOutcomeQuery = {
  decision?: string | string[];
  exempted?: string | string[];
  restored?: string | string[];
  frozen?: string | string[];
  refused?: string | string[];
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const count = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export function LeaveOutcome({ query }: { query: LeaveOutcomeQuery }) {
  const refused = one(query.refused);
  if (refused) {
    return (
      <p className="error" role="alert">
        {t(isMessageKey(refused) ? refused : "errors.accessDenied")}
      </p>
    );
  }
  const decision = one(query.decision);
  if (decision !== "approved" && decision !== "rejected") return null;
  const exempted = count(query.exempted);
  const restored = count(query.restored);
  const frozen = count(query.frozen);
  const lines = [t(decision === "approved" ? "leave.outcome.approved" : "leave.outcome.rejected")];
  if (decision === "approved" && exempted !== null) lines.push(t("leave.outcome.exempted", { count: exempted }));
  if (decision === "rejected" && restored !== null) lines.push(t("leave.outcome.restored", { count: restored }));
  if (frozen) lines.push(t("leave.outcome.frozen", { count: frozen }));
  return (
    <p className="success" role="status">
      {lines.join(" ")}
    </p>
  );
}

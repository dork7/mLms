// The Fee Alert, for every screen where the Admin or the Student sees that Student. Only
// pass it what `studentFeeAlert`/`feeAlerts` returned: a Teacher's screen never calls them.
// It informs and never blocks, and it stays off printouts.
import Link from "next/link";
import type { FeeAlert as FeeAlertData } from "@/core/fees/fee-alert";
import { t } from "@/i18n";
import { paidText } from "./fee-assignments";

export function FeeAlert({ alert, viewer }: { alert: FeeAlertData | null | undefined; viewer: "admin" | "student" }) {
  if (!alert) return null;
  const count = alert.overdue.length;
  const name = alert.overdue[0].studentName;
  const summary =
    viewer === "student"
      ? count === 1
        ? t("feeAlert.student")
        : t("feeAlert.studentMany", { count })
      : count === 1
        ? t("feeAlert.admin", { name })
        : t("feeAlert.adminMany", { name, count });

  return (
    <div className="fee-alert no-print" role="alert">
      <div className="fee-alert-title">{t("feeAlert.title")}</div>
      <p>{summary}</p>
      <ul>
        {alert.overdue.map((a) => {
          const text = t("feeAlert.item", { fee: a.fee.name, date: a.fee.dueDate, paid: paidText(a) });
          return (
            <li key={a.id}>{viewer === "admin" ? <Link href={`/admin/fees/assignments/${a.id}`}>{text}</Link> : text}</li>
          );
        })}
      </ul>
      {viewer === "student" && (
        <p>
          <Link href="/student/fees">{t("feeAlert.seeFees")}</Link>
        </p>
      )}
    </div>
  );
}

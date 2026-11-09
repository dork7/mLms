import type { Metadata } from "next";
import { ExamSchedulePage } from "../../exam-schedule-page";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pageTitles.myExams") };

export default function StudentExamsPage() {
  return <ExamSchedulePage homeHref="/student" />;
}

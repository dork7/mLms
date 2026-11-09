import type { Metadata } from "next";
import { NamedListPage } from "../named-list-page";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pageTitles.subjects") };

export default function SubjectsPage() {
  return <NamedListPage kind="subjects" />;
}

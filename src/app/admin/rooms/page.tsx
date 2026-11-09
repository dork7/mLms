import type { Metadata } from "next";
import { NamedListPage } from "../named-list-page";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pageTitles.rooms") };

export default function RoomsPage() {
  return <NamedListPage kind="rooms" />;
}

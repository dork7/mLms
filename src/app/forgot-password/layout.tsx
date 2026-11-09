// Only here to give the client-side page its title.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pageTitles.forgotPassword") };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { dir, locale, t } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = { title: t("app.name") };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}

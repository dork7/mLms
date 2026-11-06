import type { Metadata } from "next";
import type { ReactNode } from "react";
import { dir, locale, t } from "@/i18n";
import { applySavedTheme } from "./theme";
import { ThemePicker } from "./theme-picker";
import "./globals.css";

export const metadata: Metadata = { title: t("app.name") };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets data-theme before React hydrates.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>
        {children}
        <footer className="app-footer no-print">
          <ThemePicker />
        </footer>
      </body>
    </html>
  );
}

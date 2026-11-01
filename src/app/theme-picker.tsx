"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { applyTheme, savedTheme, saveTheme, type ThemeChoice } from "./theme";

const listeners = new Set<() => void>();

// Another tab's choice arrives as a storage event; this tab's own arrives through `choose`.
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function choose(choice: ThemeChoice) {
  const change = () => {
    saveTheme(choice);
    applyTheme(choice);
    listeners.forEach((listener) => listener());
  };
  if (document.startViewTransition) document.startViewTransition(change);
  else change();
}

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, savedTheme, () => "system" as const);

  // Follows another tab's choice, and restores data-theme after React's dev Strict Mode remount
  // clears it from <html>. Reads storage because `theme` is still "system" during hydration.
  useLayoutEffect(() => applyTheme(savedTheme()), [theme]);

  return (
    <label className="theme-picker">
      {t("theme.label")}
      <select value={theme} onChange={(event) => choose(event.target.value as ThemeChoice)}>
        <option value="system">{t("theme.system")}</option>
        <option value="light">{t("theme.light")}</option>
        <option value="dark">{t("theme.dark")}</option>
      </select>
    </label>
  );
}

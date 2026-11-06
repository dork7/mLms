// The person's colour scheme choice, kept per browser. No choice means "follow the system", which
// globals.css does by itself; a choice sets data-theme on <html> to override it.
export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

// Runs in <head> before the first paint, so a saved choice never flashes the other scheme.
export const applySavedTheme = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function savedTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system"; // storage is blocked
  }
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage is blocked: the choice still applies until the page is reloaded
  }
}

export function applyTheme(choice: ThemeChoice): void {
  if (choice === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", choice);
}

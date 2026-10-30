// t("adminDashboard.welcome", { name }) -> "Welcome, Amina."
// Keys are type-checked against en.ts; a typo is a compile error.
import { en, type Messages } from "./en";

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Keys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Keys<T[K]>>;
}[keyof T & string];

export type MessageKey = Keys<Messages>;

export const locale = "en";
export const dir: "ltr" | "rtl" = "ltr";

const messages: Messages = en;

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
  return String(template).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

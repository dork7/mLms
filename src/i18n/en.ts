// English UI text. Every string shown in the UI lives here under a key.
// Add Arabic later as ar.ts with the same shape (the Messages type enforces it).
export const en = {
  app: {
    name: "School LMS",
  },
  login: {
    title: "Log in",
    email: "Email",
    password: "Password",
    submit: "Log in",
    invalid: "Email or password is incorrect.",
  },
  nav: {
    logout: "Log out",
  },
  adminDashboard: {
    title: "Admin dashboard",
    welcome: "Welcome, {name}.",
    today: "Today is {date}.",
    empty: "Nothing here yet.",
  },
  errors: {
    accessDenied: "You don't have access to this page.",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;

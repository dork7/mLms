// English UI text. Every string shown in the UI lives here under a key.
// Add Arabic later as ar.ts with the same shape (the Messages type enforces it).
export const en = {
  app: {
    name: "School LMS",
  },
  login: {
    title: "Log in",
    identifier: "Email or phone",
    password: "Password",
    submit: "Log in",
    invalid: "Email, phone or password is incorrect.",
    tooManyAttempts: "Too many failed attempts. Try again in 15 minutes.",
    forgot: "Forgot your password?",
  },
  changePassword: {
    title: "Change your password",
    firstLogin: "Choose a new password to replace the one you were given.",
    current: "Current password",
    new: "New password",
    confirm: "Confirm new password",
    submit: "Change password",
    mismatch: "The new passwords don't match.",
    wrongCurrent: "Your current password is incorrect.",
  },
  forgotPassword: {
    title: "Reset your password",
    email: "Email",
    submit: "Send reset link",
    sent: "If that email belongs to an account, a reset link is on its way. It works for one hour.",
    backToLogin: "Back to log in",
  },
  resetPassword: {
    title: "Choose a new password",
    submit: "Set password",
    done: "Your password has been changed. You can now log in.",
    invalidToken: "This reset link is invalid or has expired. Ask for a new one.",
  },
  nav: {
    logout: "Log out",
    dashboard: "Dashboard",
    teachers: "Teachers",
  },
  adminDashboard: {
    title: "Admin dashboard",
    welcome: "Welcome, {name}.",
    today: "Today is {date}.",
  },
  teacherDashboard: {
    title: "Teacher dashboard",
    empty: "Your Classes will appear here.",
  },
  teachers: {
    title: "Teachers",
    addTitle: "Add a Teacher",
    name: "Name",
    email: "Email",
    phone: "Phone",
    add: "Add Teacher",
    created: "{name} can now log in. Give them this initial password; they must change it on first login:",
    none: "No Teachers yet.",
    disabled: "Login disabled",
    disable: "Disable login",
    enable: "Enable login",
  },
  errors: {
    accessDenied: "You don't have access to this page.",
    duplicateLogin: "Another account already uses this email or phone.",
    nameRequired: "Enter a name.",
    emailOrPhoneRequired: "Enter an email or a phone number.",
    passwordTooShort: "Use at least 10 characters.",
    cannotDisableSelf: "You can't disable your own login.",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;

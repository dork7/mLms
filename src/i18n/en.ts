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
    setupHeading: "School setup",
  },
  setup: {
    backToDashboard: "Back to dashboard",
    add: "Add",
    save: "Save",
    saved: "Saved.",
    dateRange: "{start} to {end}",
    academicYears: {
      title: "Academic Years",
      editTitle: "Edit Academic Year",
      empty: "No Academic Years yet.",
      new: "New Academic Year",
      create: "Create Academic Year",
      edit: "Edit {name}",
      name: "Academic Year name",
      startDate: "First day",
      endDate: "Last day",
      terms: "Terms",
      termName: "Term {n} name",
      termStart: "Term {n} first day",
      termEnd: "Term {n} last day",
      addTerm: "Add a Term",
      removeTerm: "Remove Term {n}",
      termLine: "{name}: {start} to {end}",
    },
    grades: { title: "Grades", name: "Grade name", empty: "No Grades yet." },
    subjects: { title: "Subjects", name: "Subject name", empty: "No Subjects yet." },
    rooms: { title: "Rooms", name: "Room name", empty: "No Rooms yet." },
    periods: {
      title: "Periods per day",
      label: "Number of Periods in the school day",
      notSet: "The number of Periods per day hasn't been set yet.",
      current: "The school day has {n} Periods.",
    },
  },
  errors: {
    accessDenied: "You don't have access to this page.",
    termsDoNotCoverYear: "The Terms must cover the whole Academic Year, with no gaps or overlaps.",
    academicYearsOverlap: "This Academic Year overlaps another one.",
    nameTaken: "That name is already used.",
    notFound: "That record no longer exists.",
    invalidPeriodsPerDay: "The number of Periods per day must be a whole number from 1 to 20.",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;

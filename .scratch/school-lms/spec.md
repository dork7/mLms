# Spec: School LMS v1

Status: ready-for-agent

## Problem Statement

A school's office, Teachers and Students keep their academic records in spreadsheets, paper registers and messaging apps. These cover Classes, Enrollments, Lessons, Assessments, Marks, Report Cards and exam timetables, and nothing ties them together. Report Cards are assembled by hand at the end of each Term, which is slow and error-prone. When a Student changes Class mid-year, their Marks scatter across registers. Exam timetables clash. Teachers can't quickly enter a whole Class's Marks from their phone. Students can't see their own timetable, Exams, grades or Report Card in one place. Fee tracking happens separately from the student record. The office has no reliable way to remind families, or to know which Students it can't reach by email.

## Solution

A single web app for one school (see ADR 0001) that works well on a phone. Every record hangs off an Academic Year, Term, Class, Class Subject, Teacher and date.

- **Admins** set up the year: Terms, Grades, Classes, Subjects, Class Subjects, Teachers, Rooms and Grading Scales. They register Students by hand with a Student Number, enroll Students in Classes, build the exam timetable, Publish Report Cards, and run Promotion and Closing at year end.
- **Teachers** see only their own Class Subjects (and the whole Class, if they are its Class Teacher). From a phone they can log a Lesson or enter a whole Class's Marks in under a minute, and they write Report Card remarks.
- **Students** log in with their Student Number. They see their Exam schedule, their Marks and their Published Report Cards, and download Report Cards as PDF.
- **Fees (P2)**: Admins define Fees, assign them, and log Payment Records. Students can download each Payment Record. Fee Reminders go by email automatically to the Student's one email address. Students with no email are listed in a report. Overdue Fees raise a Fee Alert for the Admin and the Student, never for Teachers.

## User Stories

Priority tags: **[P1]** is the MVP and **[P2]** is the next release.

### Accounts and access

1. As an Admin, I want to log in with my email or phone and a password, so that I can manage the school. [P1]
2. As a Teacher, I want to log in with my email or phone and a password, so that I can reach my Classes. [P1]
3. As a Student, I want to log in with my Student Number and a password, so that I don't need an email address of my own to use the app. [P1]
4. As any user, I want to be forced to change my password on first login, so that the initial password the Admin gave me stops working. [P1]
5. As any user, I want to reset a forgotten password, so that I'm not locked out. [P1]
6. As an Admin, I want to reset a Student's password, so that Students without an email address can still recover their account. [P1]
7. As an Admin, I want to create Teacher accounts, so that staff can start using the app. [P1]
8. As an Admin, I want to disable a Student's or Teacher's login without deleting their records, so that former staff and young Students can't log in while their history is kept. [P1]
9. As the school, I want sessions to time out and repeated failed logins to be rate-limited, so that accounts are hard to break into. [P1]
10. As a Teacher, I want to see only the Classes, Class Subjects and Students I teach, so that student data stays private. [P1]
11. As a Class Teacher, I want to see every Subject's Marks for my Class, so that I can write the overall Report Card remark. [P1]
12. As a Student, I want to see only my own data, so that my classmates' grades stay private. [P1]

### School structure

13. As an Admin, I want to create an Academic Year with Terms that cover it end to end with no gaps, so that every dated record falls in exactly one Term. [P1]
14. As an Admin, I want to define Grades, so that Classes and Grading Scales can be organised by year level. [P1]
15. As an Admin, I want to create Classes for a Grade in an Academic Year, such as 7-A, and assign each a Class Teacher, so that each cohort has one Teacher responsible for it. [P1]
16. As an Admin, I want to define Subjects, so that they can be taught across Grades. [P1]
17. As an Admin, I want to create Class Subjects (a Subject for a Class, taught by a Subject Teacher), so that Teachers are linked to their Students. [P1]
18. As an Admin, I want to change the Subject Teacher of a Class Subject, so that I can handle staff changes during the year. [P1]
19. As an Admin, I want to set the number of Periods in the school day, so that Teachers can log which Period a Lesson was taught in. [P1]
20. As an Admin, I want to maintain a list of Rooms, so that Exams can be held in them and clash-checked. [P1]

### Students and Enrollment

21. As an Admin, I want to register a Student with their name, date of birth, national ID, guardian contact, one email address (optional), photo, admission date and a Student Number I assign, so that the Student has a record and a login. [P1]
22. As an Admin, I want the Student Number to be rejected if another Student already has it, so that every login is unambiguous. [P1]
23. As an Admin, I want to enroll a Student in a Class from a given date, so that they appear on that Class's roster. [P1]
24. As an Admin, I want to move a Student to another Class in the same Grade from a given date, so that changing section mid-year keeps their existing Marks where they are. [P1]
25. As an Admin, I want to see a Student's profile with their Enrollment history, Marks and Report Cards, so that I have their whole record in one place. [P1]
26. As a Teacher, I want a "My Students" list that I can filter by Class and Class Subject, so that I can find a Student quickly. [P1]

### Lessons

27. As a Subject Teacher, I want to log a Lesson with its date, Period, topic covered and homework, so that the Class's teaching is recorded. [P1]
28. As a Subject Teacher, I want logging a Lesson on my phone to take under a minute, so that I do it straight after teaching. [P1]
29. As a Teacher, I want to be stopped from logging a Lesson for a Class Subject I don't teach, so that records are attributed correctly. [P1]
30. As an Admin or Class Teacher, I want a class summary that shows every Lesson for a Class by day, Subject and Teacher, so that I can see what has been covered. [P1]

### Assessments and Marks

31. As a Subject Teacher, I want to create an Assessment (quiz, assignment, midterm or final) with its date, maximum marks and weight, so that I can record a Class's Marks. [P1]
32. As a Subject Teacher, I want each Assessment's Term worked out from its date, so that I can never file it under the wrong Term. [P1]
33. As a Subject Teacher, I want to enter Marks for the whole Class in one grid, so that entering marks takes under a minute. [P1]
34. As a Subject Teacher, I want to mark a Student Absent (counts as zero) or Exempt (not counted), so that the Term Grade is fair. [P1]
35. As a Subject Teacher, I want a 40-Student marks grid to save in under a second, so that entering marks on a phone isn't frustrating. [P1]
36. As a Subject Teacher, I want the grid to list exactly the Students enrolled in the Class on the Assessment's date, so that Students who joined or left are handled correctly. [P1]
37. As a Subject Teacher, I want to change an Assessment's maximum marks or weight after Marks are entered, until the Term is Published, so that I can fix mistakes. Existing raw Marks keep their values and percentages are recalculated. [P1]
38. As a Subject Teacher, I want to see an Assessment's class average, highest and lowest Marks, so that I can judge how the Class did. [P1]
39. As a Teacher or Student, I want to see one Student's Assessment history with their Marks, so that progress is visible. [P1]
40. As a Teacher, I want to see every Assessment in a Class Subject with its statistics, so that I can review the Term. [P1]

### Grading and Report Cards

41. As an Admin, I want to set a Grading Scale for each Grade (percentage bands mapped to a letter or descriptor, plus a pass mark), so that younger and older Grades can be graded differently. [P1]
42. As the school, I want each Term Grade to be the weighted average of that Term's Assessments in the Subject, normalised by the weights of the Assessments that count, so that weights don't have to add up to 100. [P1]
43. As the school, I want a Student's Term Grade to include Marks from every Class they were enrolled in during the Term, so that a mid-term Class move doesn't lose their results. [P1]
44. As a Subject Teacher, I want to write one remark per Student for my Subject's Term Grade, so that the Report Card explains the grade. [P1]
45. As a Class Teacher, I want to write one overall remark per Student in my Class, so that the Report Card has a summary. [P1]
46. As the school, I want a Student's Report Card to come from their Issuing Class (their Class on the Term's last day), so that the overall remark and rank come from the right Class. [P1]
47. As an Admin, I want to turn rank on or off for the whole school, with rank calculated within the Issuing Class from the overall percentage, so that the school's policy is respected. [P1]
48. As an Admin, I want to preview a Class's Report Cards before Publishing, so that I can spot missing Marks or remarks. [P1]
49. As an Admin, I want to Publish a Class's Report Cards for a Term, so that Students can see them and that Term's Marks for the Class are frozen. [P1]
50. As an Admin, I want to unpublish if I must, with the action logged, so that genuine mistakes can be fixed without hiding who changed what. [P1]
51. As a Teacher, I want to be stopped from changing Marks for a Published Term, so that Published Report Cards stay accurate. [P1]
52. As a Student, I want to see my Published Report Cards and download them as PDF, so that I have a copy. [P1]
53. As an Admin, I want to export one Report Card, or a whole Class's, as PDF, so that I can print them. [P1]

### Exams

54. As an Admin, I want to build a Term's exam timetable by adding Exams with their Class Subject, date, start time, duration and Room, so that the school has one schedule. [P1]
55. As an Admin, I want adding an Exam to create its Assessment for that Class Subject automatically, so that Teachers enter Exam Marks in the usual grid. [P1]
56. As an Admin, I want to add one grade-wide Exam (for example, Grade 7 Math final) as one Exam per Class Subject, shown together in the timetable, so that scheduling a whole Grade is quick. [P1]
57. As an Admin, I want an Exam to be refused if its Class already has an Exam at an overlapping time, so that no Class has two Exams at once. [P1]
58. As an Admin, I want an Exam to be refused if its Room is already booked at an overlapping time, so that no Room is double-booked. [P1]
59. As a Student, I want to see my Exam schedule, so that I know when and where each Exam is. [P1]
60. As a Teacher, I want to see the Exams for my Class Subjects, so that I can prepare. [P1]
61. As a Student or Teacher, I want to print my Exam schedule or export it as an .ics calendar file, so that it's in my calendar. [P1]

### Dashboards

62. As an Admin, I want a dashboard with counts of Students, Teachers and Classes, and Report Cards waiting to be Published, so that I can see the school's state at a glance. [P1]
63. As a Teacher, I want a dashboard listing my Class Subjects, recent Lessons and Assessments that still need Marks, so that I know what to do next. [P1]
64. As a Student, I want a dashboard with my next Exam and latest Marks, so that I'm up to date. [P1]

### Year end

65. As an Admin, I want to promote a whole Class into a Class of the next Grade in the new Academic Year, so that rolling the year over is quick. [P1]
66. As an Admin, I want to mark individual Students as Repeating (they stay in the same Grade) or Leaving (their Enrollment ends) during Promotion, so that the exceptions are handled. [P1]
67. As an Admin, I want to Close an Academic Year after Promotion, so that its records become read-only but stay visible. [P1]
68. As anyone with access, I want past Academic Years to be viewable but never editable, so that history can be trusted. [P1]

### Fees

69. As an Admin, I want to define a Fee with its name, amount in AED and due date, so that I can track what the school charges. [P2]
70. As an Admin, I want to apply a Fee to a whole Grade or to specific Students, which creates Fee Assignments, so that I don't have to assign it one Student at a time. [P2]
71. As an Admin, I want to log a Payment Record against a Fee Assignment, with its amount, date, method (cash, bank transfer or cheque) and reference, so that I have a record of what was paid. [P2]
72. As an Admin, I want each Fee Status (Unpaid, Partially Paid or Paid) worked out from its Payment Records, so that the status never drifts from the payments. [P2]
73. As an Admin, I want to waive a Fee Assignment, so that exemptions are recorded. [P2]
74. As a Student, I want to see my Fee Assignments and Payment Records, so that I know what I owe and have paid. [P2]
75. As a Student, I want to download each Payment Record as PDF, so that I have proof of payment. [P2]
76. As an Admin or Student, I want a Fee Alert wherever that Student appears (profile, dashboard, Report Card screen) while any Fee Assignment is Overdue, so that it can't be missed. [P2]
77. As a Teacher, I want never to see Fees or Fee Alerts, so that families' financial information stays private. [P2]
78. As the school, I want an Overdue Fee never to block a Report Card, an Exam or a login, so that a Student's education isn't held back. [P2]
79. As an Admin, I want Fee Reminders emailed to the Student's email address automatically, 7 days before the due date and then weekly while Overdue, with the timings configurable school-wide, so that families are reminded without manual work. [P2]
80. As an Admin, I want a "Send reminders now" action for a Fee, so that I can chase payment on demand. [P2]
81. As an Admin, I want a report of every Student with no email address, showing whether each has an outstanding Fee, so that I can collect missing addresses and contact those families another way. [P2]
82. As an Admin, I want Students without an email address skipped when reminders are sent, and visible in that report, so that a send never fails silently. [P2]

### Leave

83. As a Student, I want to submit a Leave Request with dates, a reason and an optional attachment, so that my absence can be approved. [P2]
84. As a Class Teacher, I want to approve or reject Leave Requests from my Class's Students, so that I can handle them myself. [P2]
85. As an Admin, I want to override a Class Teacher's decision on a Student's Leave Request, so that the office has the final say. [P2]
86. As a Teacher, I want to submit a Leave Request for the Admin to approve, so that my absence is recorded. [P2]
87. As the school, I want an approved Student leave to turn that Student's Absent Marks in the leave dates into Exempt, so that excused absences don't count against them. [P2]

## Implementation Decisions

### Architecture

- **One deployment per school** (ADR 0001). There's no tenant key and every row belongs to the one school.
- **Stack** (ADR 0002): Next.js (App Router) and TypeScript, Postgres with Drizzle, Better Auth, Playwright HTML-to-PDF, SMTP email, Docker Compose on a VPS. It's a responsive web app with no native client.
- **Application layer as the single core.** Every command and query lives in a framework-independent application layer. Next.js server actions and route handlers do nothing except authenticate, call the layer, and render. Each call carries the **acting person** (Admin, Teacher or Student, with their identity), and the layer enforces access itself. Access is never left to the UI.
- **Injected dependencies.** The layer depends on a **Clock**, which provides "today" for working out Terms, Overdue status and reminder timing, and a **Mailer**, which sends over SMTP in production. Nothing else is injected, and the database is used directly.
- **Ready for translation and right-to-left from day one.** All UI text comes from translation keys and CSS uses logical (direction-neutral) properties. English only in v1.

### Domain modules (in the application layer)

- **Identity and access**: accounts, the roles Admin, Teacher and Student, first-login password change, Admin-initiated reset, and disabling logins. Students log in with their Student Number and staff with email or phone. One access policy answers "can this person see or act on this Class, Class Subject or Student?":
  - An Admin can see and act on everything.
  - A Subject Teacher can see and act on their own Class Subjects and those Classes' rosters.
  - A Class Teacher can also see every Class Subject's Marks for their Class.
  - A Student can see only themselves.
  - Fee data is visible to the Admin and the Student concerned only.
- **School structure**: Academic Year, Term, Grade, Class (with its Class Teacher), Subject, Class Subject (with its Subject Teacher), the number of Periods per day, and Room. Terms must cover their Academic Year with no gaps or overlaps. A Closed Academic Year rejects every write to records dated within it.
- **Enrollment**: Student × Class × start date × optional end date. A Student has at most one open Enrollment at a time. Moving Class ends one Enrollment and starts the next on the given date. The roster on a given date is every Student whose Enrollment covers that date. Promotion creates the next year's Enrollments, while Repeating creates one in the same Grade and Leaving creates none.
- **Lessons**: one logged Lesson per Class Subject, date and Period, recording its topic and homework. Only that Class Subject's Subject Teacher can log it.
- **Assessments and Marks**: an Assessment belongs to one Class Subject and has a type, date, maximum marks and weight. Its Term is worked out from its date and never stored separately. A Mark is (Assessment, Student) with either a raw score from 0 to the maximum or a status of Absent or Exempt. Saving the marks grid is one batch upsert in one transaction.
- **Grading**: each Grade has a Grading Scale made of ordered percentage bands with labels, plus a pass mark.
  - **Term Grade** for a Student, Subject and Term: take every Assessment in that Term for any Class Subject of that Subject in any Class the Student was enrolled in on the Assessment's date. Exempt Marks are left out, and Absent counts as 0. The result is Σ(weight × score ÷ maximum) ÷ Σ(weight of the Assessments that count). The label comes from the Grading Scale of the Issuing Class's Grade.
  - The overall percentage is the plain average of the Term Grade percentages.
  - Rank is optional, set school-wide, and calculated within the Issuing Class. Tied Students share a rank.
- **Report Cards**: the Issuing Class is the Student's Class on the Term's last day. Remarks come from Subject Teachers (one per Student per Subject) and the Class Teacher (one overall per Student).
  - Publishing happens per Class and Term. It stores the publish event, and while it stands, any Mark write for Assessments in that Term whose Students are in that Class is rejected.
  - Unpublishing is Admin-only and recorded with who did it and when.
  - The PDF is rendered by Playwright from the same Report Card data the layer returns.
- **Exams**: an Exam is a Class Subject, start time, duration and Room, plus its own Assessment, created in the same transaction.
  - Clash rules are enforced in the layer: no two Exams overlap for the same Class, and no two Exams overlap in the same Room.
  - A grade-wide Exam is just several Exams that the timetable groups by Subject and time.
  - Schedules can be exported as printable views and as .ics files, filtered for the person viewing.
- **Fees (P2)**:
  - A Fee has a name, an amount in AED and a due date. A Fee Assignment is (Fee, Student) with an optional waived flag. A Payment Record has an amount, date, method and reference.
  - Fee Status is worked out, never stored: Waived if waived, otherwise Paid if payments ≥ the amount, Partially Paid if payments > 0, otherwise Unpaid.
  - Overdue means past the due date (by the Clock) and not Paid or Waived. The Fee Alert appears whenever a Student has any Overdue Fee Assignment.
- **Fee Reminders (P2)**:
  - A scheduled job runs daily and finds Fee Assignments that are due in the configured lead time (default 7 days) or Overdue and due for another reminder (default every 7 days). For each one with an email address it sends through the Mailer.
  - A log of reminders sent prevents duplicate sends. The manual "Send reminders now" goes through the same path.
  - Students without an email address are skipped and appear in the no-email report.
- **Leave (P2)**: a Leave Request comes from a Student or a Teacher, with a date range, a reason and an optional attachment. A Student's request is approved by their current Class Teacher and an Admin can override it. A Teacher's request is approved by an Admin. When a Student's leave is approved, their Absent Marks on Assessments within the leave dates become Exempt.

### Interactions and limits

- A marks grid for a 40-Student Class must save in under 1 second.
- Logging a Lesson and entering Marks must work at phone width.
- Database backups run daily and are kept for 30 days, using a Docker Compose service on the VPS.

## Testing Decisions

- **One seam: the application layer.** Tests call commands and queries as a specific Admin, Teacher or Student against a **real Postgres database** (a throwaway database per test run, with migrations applied). Only the **Clock** (fixed by each test) and the **Mailer** (records messages instead of sending) are swapped out.
- **What a good test looks like**: it sets up a school through the layer's own commands, acts as a person, and checks what that person can then see or what was refused. It never inspects tables, Drizzle queries or internal helpers. A test name reads like a user story or a scenario using the glossary terms.
- **What gets tested**:
  - **Access policy**: a Teacher is refused another Teacher's Class Subject. A Class Teacher sees all Marks for their Class. A Student sees only themselves. A Teacher never sees Fees.
  - **Enrollment and Term Grade**: the Aisha scenario (she moves from 7-A to 7-B in week 6, her 7-A Marks count toward her Report Card, and 7-B is her Issuing Class). Absent and Exempt handling. Weight normalisation. Changing maximum marks or weight after entry. Grading Scale per Grade. Rank with ties.
  - **Publish**: Mark writes rejected after Publish, accepted again after unpublish, and the unpublish recorded.
  - **Exams**: the Class clash and Room clash rules, including back-to-back Exams that don't overlap. The Exam's Assessment is created with it.
  - **Year end**: Promotion with Repeating and Leaving Students. Writes rejected once a year is Closed.
  - **Fees**: Fee Status worked out from Payment Records. Overdue and Fee Alert changing as the Clock moves. Reminder timing and no duplicate sends. No-email Students skipped and listed in the report.
  - **Leave**: approval rights, Admin override, and Absent becoming Exempt.
- **Smoke tests only, outside the seam**: one Playwright run that renders a Report Card PDF and a Payment Record PDF, and one login through the real UI.
- **Prior art**: none. The repo is new. The first tests written for the application layer set the pattern.

## Out of Scope

- **Online fee payment**: no payment gateway, card or wallet payments, discounts or instalment plans.
- **Electives and cross-Class teaching groups.** In v1 every Student in a Class takes every Class Subject.
- **More than one school or tenant** (ADR 0001).
- A native mobile app.
- Arabic text (P2), though the code is ready for it and for right-to-left from day one.
- The P2 and P3 features not listed above: Parent accounts, bulk import, private teacher notes, substitute teachers, syllabus coverage, Lesson attachments, attendance, per-Assessment locks, progress charts, at-risk alerts, analytics, invigilator assignment, weekly timetable, announcements, push and WhatsApp notifications, homework submission, AI helpers, leave balances, and the general audit log beyond unpublish.
- Online video classes, transport, library and hostel management.

## Further Notes

- Vocabulary follows `GLOSSARY.md`. Use **Assessment**, not "test". Use **Class** for a cohort, never for a Period or a Lesson.
- These change the original requirements:
  - Publish (with freezing of Marks) comes into P1.
  - Fee tracking moves from out of scope to P2.
  - Students log in with a Student Number.
  - Each Student has at most one email address.
- Prepare for P2 without building it:
  - Keep the access policy in one place so Parent can be added as another role.
  - Keep Mark statuses extensible for leave-driven Exempt.

# 24: Exam editing

**What to build:** The Admin can fix a mistake in the exam timetable: reschedule an Exam (its date, start time, duration and Room) or delete it. The clash rules still hold, and no Mark is ever lost or moved to another date.

**Blocked by:** 13 (Exam timetable), 16 (Year end)

**Status:** resolved

- [x] The Admin reschedules an Exam: its date, start time, duration and Room. The Class and Room clash rules are checked again, the Exam itself excepted, and back-to-back Exams are still allowed
- [x] An Exam with Marks keeps its date, so its roster, Term and any leave exemptions stay right. Its start time, duration and Room can still change
- [x] The Admin deletes an Exam that has no Marks, and its Assessment goes with it. An Exam with Marks is refused
- [x] Teachers are refused both, and a Closed Academic Year refuses both
- [x] The timetable links each Exam to a page where the Admin reschedules or deletes it. A grade-wide Exam is changed one Class at a time, or whole (added after the UX review)
- [x] Student and Teacher schedules and the .ics follow the change; the calendar event keeps its UID

**Out of scope:** changing an Exam's Class Subject or type (delete it and add it again), and the Admin changing maximum marks or weight (the Subject Teacher already can).

**Follow-up (UX/UI review):** every finding was fixed: the whole grade-wide Exam moves in one step, clash refusals name the Exam in the way, forms focus their message after a submit, every page has its own title, dates read as "Nov 10, 2141", deletes are confirmed, and the Exam pages got clearer labels and tap targets. See the review section in `docs/handoff/conventions.md`.

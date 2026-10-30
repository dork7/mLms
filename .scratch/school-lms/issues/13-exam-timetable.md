# 13: Exam timetable

**What to build:** The Admin builds a Term's exam timetable. Each Exam automatically creates its Assessment, and clashes are refused.

**Blocked by:** 03 (School setup), 08 (Assessments and marks grid)

**Status:** ready-for-agent

- [ ] The Admin adds an Exam with its Class Subject, start, duration and Room. Its Assessment is created in the same transaction
- [ ] An Exam that overlaps another Exam for the same Class is refused
- [ ] An Exam that overlaps another Exam in the same Room is refused. Back-to-back Exams that don't overlap are allowed
- [ ] The timetable groups grade-wide Exams (the same Subject and time across several Classes)
- [ ] Subject Teachers enter Exam Marks in the normal marks grid

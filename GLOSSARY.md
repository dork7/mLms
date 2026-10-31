# School LMS

One place for a single school to run its academic year: classes, students, teachers, lessons, assessments, grades, exams and leaves.

## School structure

**Academic Year**:
The school year that all Classes, Enrollments and Assessments belong to. Past years are read-only.

**Term**:
A division of an Academic Year that grades are reported on.

**Grade**:
A year level, such as Grade 7.
_Avoid_: Level, year (for the year level)

**Class**:
One cohort of students in a Grade for one Academic Year, such as Grade 7-A.
_Avoid_: Section (as a standalone noun), homeroom; never "class" for a Period or Lesson

**Subject**:
A discipline taught in the school, such as Math.

**Class Subject**:
A Subject as taught to one Class by one Subject Teacher, such as Math for 7-A.
_Avoid_: Course

**Enrollment**:
A Student's membership of a Class for a date range. A Student who changes Class mid-year has two Enrollments.

**Promotion**:
Moving a Class's Students into the next Grade's Class for the new Academic Year. Individual Students can instead be Repeating (they stay in the same Grade) or Leaving (their Enrollment ends).

**Closing** (an Academic Year):
Making an Academic Year read-only once Promotion is done.

**Room**:
A named place in the school where an Exam can be held.

## People

**Admin**:
School office staff who set up the Academic Year, Classes, Subjects, Teachers and Students.

**Teacher**:
A staff member who teaches. One person can be both a Class Teacher and a Subject Teacher.

**Class Teacher**:
The one Teacher responsible for a Class as a whole. Sees every Subject's marks for that Class.
_Avoid_: Homeroom teacher, form teacher

**Subject Teacher**:
The Teacher assigned to a Class Subject.

**Student**:
A learner enrolled in the school. Has their own account, logs in with their Student Number, and has at most one email address on record, which may be a guardian's.

**Student Number**:
The school-issued identifier that the Admin assigns when registering a Student, unique within the school. It is not the national ID.
_Avoid_: Student ID, ID number (that's the national ID)

**Parent**:
A guardian linked to one or more Students, with a read-only view.
_Avoid_: Guardian (as an account role)

## Teaching

**Period**:
A numbered teaching slot in the school day.
_Avoid_: Class, slot

**Lesson**:
One delivered teaching session of a Class Subject, logged with its date, Period, topic and homework.
_Avoid_: Class, lesson log (that's the record, not the thing)

## Assessment and grading

**Assessment**:
Anything graded with Marks for one Class Subject: a quiz, assignment, midterm or final. Belongs to exactly one Term.
_Avoid_: Test (as the umbrella term)

**Exam**:
An Assessment that also has a scheduled sitting, with a date, time, room and invigilator. A grade-wide exam is one Exam per Class Subject.

**Mark**:
A Student's score on one Assessment, or a status of Absent or Exempt instead.
_Avoid_: Score, result

**Absent**:
A Mark status meaning the Student missed the Assessment. It counts as zero.

**Exempt**:
A Mark status meaning the Assessment doesn't count for that Student. An excused absence becomes Exempt.

**Grading Scale**:
A Grade's mapping from percentage to a letter or descriptor, plus the pass mark.

**Term Grade**:
A Student's weighted result in one Subject for one Term, combining every Assessment in that Subject across all their Enrollments.

**Report Card**:
A Student's Term Grades for one Term, plus their overall percentage, optional rank within the Class, one remark per Term Grade from the Subject Teacher and one overall remark from the Class Teacher.

**Issuing Class**:
The Class a Student is enrolled in on the last day of a Term. It owns that Term's Report Card: the overall remark comes from its Class Teacher, and rank is computed within it.

**Publish** (Report Cards):
The Admin releasing a Class's Report Cards for a Term. Students can then see them, and that Term's Marks for the Class are frozen.

**Publication**:
The record of one Publish: who did it and when, the Report Cards as Published, and who unpublished it and when, if anyone did. It stays on record after unpublishing. While it stands, it freezes the Marks and remarks its Report Cards depend on.

## Leave

**Leave Request**:
A Student's or Teacher's request to be away for a date range, with a reason. A Student's request is approved by their Class Teacher, with the Admin able to override. A Teacher's request is approved by the Admin.
_Avoid_: Absence (that's an attendance fact, not a request)

## Fees

**Fee**:
Something the school charges, with a name, amount and due date, applied to a Grade or to specific Students. For example, "Term 1 Tuition".
_Avoid_: Charge, invoice, bill

**Fee Assignment**:
One Student owing one Fee.

**Payment Record**:
One logged payment against a Fee Assignment, with its amount, date, method and reference. The Student can see and download it.
_Avoid_: Receipt, transaction

**Fee Status**:
The state of a Fee Assignment: Unpaid, Partially Paid or Paid, worked out from its Payment Records, or Waived by the Admin.

**Overdue**:
A Fee Assignment that is past its due date and not fully paid or waived.

**Fee Alert**:
The warning shown to the Admin and the Student wherever that Student appears, while they have any Overdue Fee Assignment. Teachers never see it.

**Fee Reminder**:
An email sent to a Student's email address about an upcoming or Overdue Fee Assignment.

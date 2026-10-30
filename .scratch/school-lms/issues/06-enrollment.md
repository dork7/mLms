# 06: Enrollment

**What to build:** The Admin enrolls Students into Classes and moves them between Classes from a given date. Teachers see their students, and everyone with access sees a Student's Enrollment history on their profile.

**Blocked by:** 04 (Classes, Class Subjects and access policy), 05 (Student registration and login)

**Status:** resolved

- [x] The Admin enrolls a Student in a Class from a date. A Student has at most one open Enrollment at a time
- [x] Moving a Student to another Class ends one Enrollment and starts the next on the given date
- [x] The roster of a Class on any date is exactly the Students whose Enrollment covers that date
- [x] A Teacher's "My Students" list shows the Students of their Class Subjects and can be filtered by Class and Class Subject
- [x] The Student profile shows their Enrollment history to the Admin, the Student's Teachers and the Student

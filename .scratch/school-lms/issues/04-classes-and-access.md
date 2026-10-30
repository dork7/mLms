# 04: Classes, Class Subjects and access policy

**What to build:** The Admin creates the Classes for each Grade in an Academic Year, each with a Class Teacher, and the Class Subjects, each with a Subject Teacher. One access policy decides who can see and act on what. A Teacher sees only their own Class Subjects, and a Class Teacher also sees their whole Class.

**Blocked by:** 02 (Staff accounts), 03 (School setup)

**Status:** resolved

- [x] The Admin creates a Class (Grade plus a name such as 7-A) with a Class Teacher
- [x] The Admin creates a Class Subject (Class × Subject) with a Subject Teacher and can reassign the Teacher
- [x] A Teacher's list of Class Subjects contains only their own
- [x] A Teacher is refused access to another Teacher's Class Subject
- [x] A Class Teacher can see every Class Subject of their Class
- [x] One access policy in the application layer answers every access check (it will later be extended for Students and Parents)

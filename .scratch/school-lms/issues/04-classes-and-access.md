# 04: Classes, Class Subjects and access policy

**What to build:** The Admin creates the Classes for each Grade in an Academic Year, each with a Class Teacher, and the Class Subjects, each with a Subject Teacher. One access policy decides who can see and act on what. A Teacher sees only their own Class Subjects, and a Class Teacher also sees their whole Class.

**Blocked by:** 02 (Staff accounts), 03 (School setup)

**Status:** ready-for-agent

- [ ] The Admin creates a Class (Grade plus a name such as 7-A) with a Class Teacher
- [ ] The Admin creates a Class Subject (Class × Subject) with a Subject Teacher and can reassign the Teacher
- [ ] A Teacher's list of Class Subjects contains only their own
- [ ] A Teacher is refused access to another Teacher's Class Subject
- [ ] A Class Teacher can see every Class Subject of their Class
- [ ] One access policy in the application layer answers every access check (it will later be extended for Students and Parents)

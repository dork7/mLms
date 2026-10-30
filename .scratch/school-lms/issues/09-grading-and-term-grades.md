# 09: Grading Scales and Term Grades

**What to build:** The Admin defines a Grading Scale for each Grade. The system works out each Student's Term Grade per Subject, including Marks from every Class the Student was enrolled in during the Term.

**Blocked by:** 08 (Assessments and marks grid)

**Status:** ready-for-agent

- [ ] The Admin defines a Grading Scale per Grade, with ordered percentage bands, labels and a pass mark
- [ ] Term Grade = Σ(weight × score ÷ maximum) ÷ Σ(weight of the Assessments that count). Exempt is left out and Absent counts as 0
- [ ] The Aisha scenario: a Student who moves from 7-A to 7-B mid-Term has both Classes' Marks for a Subject in that Subject's Term Grade
- [ ] The label and pass/fail use the Grading Scale of the Grade of the Student's Class on the Term's last day
- [ ] Teachers and the Student can see Term Grades

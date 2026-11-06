# 08: Assessments and marks grid

**What to build:** A Subject Teacher creates Assessments and enters Marks for the whole Class in one grid. Teachers and the Student can see the Student's Assessment history, and Teachers see each Assessment's statistics.

**Blocked by:** 06 (Enrollment)

**Status:** resolved

- [x] A Subject Teacher creates an Assessment with its type (quiz, assignment, midterm or final), date, maximum marks and weight, and its Term is worked out from its date
- [x] The marks grid lists exactly the roster on the Assessment's date
- [x] Each Mark is a raw score from 0 to the maximum, Absent or Exempt. Out-of-range scores are refused
- [x] Saving a 40-Student grid is one transaction and takes under 1 second
- [x] Maximum marks and weight can be changed after Marks are entered. Raw Marks are kept and percentages recalculated
- [x] Each Assessment shows its average, highest and lowest Marks
- [x] A Student's Assessment history is visible to the Student and to their Teachers
- [x] The grid works at phone width

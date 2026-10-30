// A Teacher's "My Students": the Students enrolled today in the Classes the Teacher
// teaches (as a Subject Teacher of one of its Class Subjects, or as its Class
// Teacher), optionally narrowed to one Class or one Class Subject.
import { and, asc, eq, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { classSubject, enrollment, schoolClass, student, subject, user } from "@/db/schema";
import { isTeacherOfClass, requireRole } from "../access";
import type { Ctx } from "../context";

export type MyStudentsFilter = { classId?: number; classSubjectId?: number };

export type MyStudentRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  classId: number;
  class: string;
  /** The Class Subjects of this Student's Class that the acting Teacher teaches. */
  classSubjects: { id: number; subject: string }[];
};

export async function listMyStudents(ctx: Ctx, filter: MyStudentsFilter): Promise<MyStudentRow[]> {
  requireRole(ctx.actor, "teacher");
  const me = ctx.actor.userId;
  const today = ctx.clock.today();

  const conditions: (SQL | undefined)[] = [
    isTeacherOfClass(me),
    lte(enrollment.startDate, today),
    or(isNull(enrollment.endDate), gte(enrollment.endDate, today)),
  ];
  if (filter.classId !== undefined) conditions.push(eq(schoolClass.id, safeId(filter.classId)));
  if (filter.classSubjectId !== undefined) {
    // Only a Class Subject the Teacher can see narrows the list to its Class.
    conditions.push(sql`exists (
      select 1 from ${classSubject}
      where ${classSubject.id} = ${safeId(filter.classSubjectId)}
        and ${classSubject.classId} = ${schoolClass.id}
        and (${classSubject.teacherId} = ${me} or ${schoolClass.classTeacherId} = ${me}))`);
  }

  const [rows, taught] = await Promise.all([
    ctx.db
      .select({
        studentId: student.userId,
        name: user.name,
        studentNumber: student.studentNumber,
        classId: schoolClass.id,
        class: schoolClass.name,
      })
      .from(enrollment)
      .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
      .innerJoin(student, eq(student.userId, enrollment.studentId))
      .innerJoin(user, eq(user.id, student.userId))
      .where(and(...conditions))
      .orderBy(asc(user.name), asc(schoolClass.name), asc(user.id)),
    ctx.db
      .select({ id: classSubject.id, classId: classSubject.classId, subject: subject.name })
      .from(classSubject)
      .innerJoin(subject, eq(subject.id, classSubject.subjectId))
      .where(eq(classSubject.teacherId, me))
      .orderBy(asc(subject.name)),
  ]);

  return rows.map((row) => ({
    ...row,
    classSubjects: taught.filter((cs) => cs.classId === row.classId).map(({ id, subject }) => ({ id, subject })),
  }));
}

/** A filter id from a URL that isn't a whole number matches nothing. */
function safeId(id: number): number {
  return Number.isSafeInteger(id) ? id : -1;
}

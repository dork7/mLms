// A Student's profile (with their Enrollment history) and photo, for the Admin, the
// Student's Teachers and the Student themselves (see `requireCanSeeStudent`).
import { eq, sql } from "drizzle-orm";
import { student, studentPhoto, user } from "@/db/schema";
import { requireCanSeeStudent } from "../access";
import type { Ctx } from "../context";
import { enrollmentHistory, type EnrollmentRow } from "../enrollment/enrollment";
import { NotFound } from "../errors";
import type { Photo } from "./photo";

export type StudentProfile = {
  id: string;
  name: string;
  studentNumber: string;
  dateOfBirth: string;
  nationalId: string;
  guardianContact: string;
  email: string | null;
  admissionDate: string;
  hasPhoto: boolean;
  disabled: boolean;
  /** Oldest first; the last one has no end date while the Student is enrolled. */
  enrollments: EnrollmentRow[];
};

export async function getStudentProfile(ctx: Ctx, input: { studentId: string }): Promise<StudentProfile> {
  await requireCanSeeStudent(ctx, input.studentId);
  const [found] = await ctx.db
    .select({
      id: user.id,
      name: user.name,
      studentNumber: student.studentNumber,
      dateOfBirth: student.dateOfBirth,
      nationalId: student.nationalId,
      guardianContact: student.guardianContact,
      email: student.email,
      admissionDate: student.admissionDate,
      hasPhoto: sql<boolean>`${studentPhoto.studentId} is not null`,
      disabledAt: user.disabledAt,
    })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .leftJoin(studentPhoto, eq(studentPhoto.studentId, student.userId))
    .where(eq(student.userId, input.studentId))
    .limit(1);
  if (!found) throw new NotFound("no such Student");
  const { disabledAt, ...profile } = found;
  const enrollments = await enrollmentHistory(ctx.db, input.studentId);
  return { ...profile, disabled: disabledAt !== null, enrollments };
}

export async function getStudentPhoto(ctx: Ctx, input: { studentId: string }): Promise<Photo | null> {
  await requireCanSeeStudent(ctx, input.studentId);
  const [found] = await ctx.db
    .select({ contentType: studentPhoto.contentType, data: studentPhoto.data })
    .from(studentPhoto)
    .where(eq(studentPhoto.studentId, input.studentId))
    .limit(1);
  return found ? { contentType: found.contentType, data: new Uint8Array(found.data) } : null;
}

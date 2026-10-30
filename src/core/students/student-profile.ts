// A Student's profile and photo. The Admin sees any Student; a Student sees only
// themselves (see `requireCanSeeStudent`).
import { eq, sql } from "drizzle-orm";
import { student, studentPhoto, user } from "@/db/schema";
import { requireCanSeeStudent } from "../access";
import type { Ctx } from "../context";
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
};

export async function getStudentProfile(ctx: Ctx, input: { studentId: string }): Promise<StudentProfile> {
  requireCanSeeStudent(ctx.actor, input.studentId);
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
  return { ...profile, disabled: disabledAt !== null };
}

export async function getStudentPhoto(ctx: Ctx, input: { studentId: string }): Promise<Photo | null> {
  requireCanSeeStudent(ctx.actor, input.studentId);
  const [found] = await ctx.db
    .select({ contentType: studentPhoto.contentType, data: studentPhoto.data })
    .from(studentPhoto)
    .where(eq(studentPhoto.studentId, input.studentId))
    .limit(1);
  return found ? { contentType: found.contentType, data: new Uint8Array(found.data) } : null;
}

// The Admin registers a Student by hand and assigns their Student Number, which
// becomes their login. Returns a generated initial password for the Admin to hand
// over; the Student must change it on first login.
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { account, student, studentPhoto, user } from "@/db/schema";
import { requireAdmin } from "../access";
import { normaliseEmail, normaliseStudentNumber } from "../accounts/identifiers";
import { generatePassword } from "../accounts/passwords";
import type { Ctx } from "../context";
import { InvalidInput, isUniqueViolation, StudentNumberTaken } from "../errors";
import { checkPhoto, type Photo } from "./photo";

export type RegisterStudentInput = {
  name: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  nationalId: string;
  guardianContact: string;
  email?: string;
  photo?: Photo;
  /** YYYY-MM-DD */
  admissionDate: string;
  studentNumber: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function registerStudent(
  ctx: Ctx,
  input: RegisterStudentInput,
): Promise<{ studentId: string; studentNumber: string; initialPassword: string }> {
  requireAdmin(ctx.actor);

  const name = input.name.trim();
  const studentNumber = normaliseStudentNumber(input.studentNumber);
  const nationalId = input.nationalId.trim();
  const guardianContact = input.guardianContact.trim();
  const email = input.email?.trim() ? normaliseEmail(input.email) : null;
  if (!name) throw new InvalidInput("errors.nameRequired");
  if (!studentNumber) throw new InvalidInput("errors.studentNumberRequired");
  if (studentNumber.includes("@")) throw new InvalidInput("errors.studentNumberInvalid");
  if (!nationalId) throw new InvalidInput("errors.nationalIdRequired");
  if (!guardianContact) throw new InvalidInput("errors.guardianContactRequired");
  if (!isDate(input.dateOfBirth)) throw new InvalidInput("errors.dateOfBirthRequired");
  if (!isDate(input.admissionDate)) throw new InvalidInput("errors.admissionDateRequired");
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw new InvalidInput("errors.emailInvalid");
  if (input.photo) checkPhoto(input.photo);

  const initialPassword = generatePassword();
  const passwordHash = await hashPassword(initialPassword);
  const studentId = randomUUID();

  await ctx.db
    .transaction(async (tx) => {
      const [taken] = await tx
        .select({ id: student.userId })
        .from(student)
        .where(eq(student.studentNumber, studentNumber))
        .limit(1);
      if (taken) throw new StudentNumberTaken();

      const now = ctx.clock.now();
      await tx.insert(user).values({
        id: studentId,
        name,
        role: "student",
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: studentId,
        providerId: "credential",
        userId: studentId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(student).values({
        userId: studentId,
        studentNumber,
        dateOfBirth: input.dateOfBirth,
        nationalId,
        guardianContact,
        email,
        admissionDate: input.admissionDate,
      });
      if (input.photo) {
        await tx.insert(studentPhoto).values({
          studentId,
          contentType: input.photo.contentType,
          data: Buffer.from(input.photo.data),
        });
      }
    })
    .catch((err) => {
      // A concurrent registration can still hit the unique constraint.
      if (isUniqueViolation(err)) throw new StudentNumberTaken();
      throw err;
    });

  return { studentId, studentNumber, initialPassword };
}

function isDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

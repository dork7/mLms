// Exams: an Assessment with a scheduled sitting (a Class Subject, date, start time,
// duration and Room). Adding an Exam creates its Assessment in the same transaction,
// so Subject Teachers enter Exam Marks in the normal grid. A Term's timetable is worked
// out from the dates: Exams never store their Term.
import { and, asc, desc, eq, gte, lte, notInArray, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  academicYear,
  assessment,
  classSubject,
  exam,
  grade,
  mark,
  room,
  schoolClass,
  subject,
  term,
  user,
} from "@/db/schema";
import { requireAdmin, requireId } from "../access";
import { type AssessmentType, insertAssessment, requireAssessmentDate } from "../assessments/assessments";
import type { Ctx } from "../context";
import type { Tx } from "../enrollment/enrollment";
import { type ClashingExam, ExamClashForClass, ExamClashForRoom, InvalidInput, NotFound } from "../errors";
import type { Term } from "../school/academic-year";
import { requireOpenYear } from "../school/closed-year";

const MINUTES_PER_DAY = 24 * 60;

/** Serialises adding and rescheduling Exams: otherwise two overlapping ones could each see no clash. */
const EXAM_TIMETABLE_LOCK = 13;

export type ExamIds = { id: number; assessmentId: number };

export type AddExamInput = {
  classSubjectId: number;
  roomId: number;
  type: AssessmentType;
  date: string;
  /** The school's wall-clock time, HH:MM. */
  startTime: string;
  durationMinutes: number;
  maxMarks: number;
  weight: number;
};

export async function addExam(ctx: Ctx, input: AddExamInput): Promise<ExamIds> {
  requireAdmin(ctx.actor);
  requireId(input.classSubjectId);
  requireValidSitting(input);

  return ctx.db.transaction(async (tx) => {
    await lockTimetable(tx);
    return scheduleExam(tx, input);
  });
}

export type AddGradeWideExamInput = Omit<AddExamInput, "classSubjectId" | "roomId"> & {
  academicYearId: number;
  gradeId: number;
  subjectId: number;
  /** One Room for each Class Subject of the Subject in the Grade's Classes that year. */
  rooms: { classSubjectId: number; roomId: number }[];
};

/**
 * One Exam for a Subject across a Grade's Classes: one Exam per Class Subject, each with
 * its own Assessment and Room, at the same time. A Class of the Grade without the Subject
 * sits nothing. It's all or nothing: the first refusal, such as a clash with the
 * timetable or between the Classes' own Rooms, undoes the whole add.
 */
export async function addGradeWideExam(ctx: Ctx, input: AddGradeWideExamInput): Promise<ExamIds[]> {
  requireAdmin(ctx.actor);
  requireId(input.academicYearId);
  requireId(input.gradeId);
  requireId(input.subjectId);
  requireValidSitting(input);
  const { academicYearId, gradeId, subjectId, rooms, ...sitting } = input;

  return ctx.db.transaction(async (tx) => {
    await lockTimetable(tx);
    const classSubjects = await tx
      .select({ id: classSubject.id })
      .from(classSubject)
      .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
      .where(
        and(
          eq(schoolClass.academicYearId, academicYearId),
          eq(schoolClass.gradeId, gradeId),
          eq(classSubject.subjectId, subjectId),
        ),
      )
      .orderBy(asc(schoolClass.name));
    if (classSubjects.length === 0) throw new InvalidInput("errors.gradeExamNoClassSubjects");

    const roomOf = new Map(rooms.map((r) => [r.classSubjectId, r.roomId]));
    if (rooms.length !== classSubjects.length || classSubjects.some((cs) => !roomOf.has(cs.id))) {
      throw new InvalidInput("errors.gradeExamRoomsMismatch");
    }

    const exams: ExamIds[] = [];
    for (const { id } of classSubjects) {
      exams.push(await scheduleExam(tx, { ...sitting, classSubjectId: id, roomId: roomOf.get(id)! }));
    }
    return exams;
  });
}

export type GradeWideExamChoice = {
  gradeId: number;
  grade: string;
  subjectId: number;
  subject: string;
  classSubjects: { id: number; class: string }[];
};

/** What can sit a grade-wide Exam in an Academic Year: each Grade's Subjects, with their Classes. */
export async function gradeWideExamChoices(
  ctx: Ctx,
  input: { academicYearId: number },
): Promise<GradeWideExamChoice[]> {
  requireAdmin(ctx.actor);
  requireId(input.academicYearId);
  const rows = await ctx.db
    .select({
      id: classSubject.id,
      class: schoolClass.name,
      gradeId: grade.id,
      grade: grade.name,
      subjectId: subject.id,
      subject: subject.name,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .where(eq(schoolClass.academicYearId, input.academicYearId))
    .orderBy(asc(grade.name), asc(subject.name), asc(schoolClass.name));

  const choices = new Map<string, GradeWideExamChoice>();
  for (const { id, class: className, ...choice } of rows) {
    const key = `${choice.gradeId}:${choice.subjectId}`;
    const found = choices.get(key) ?? { ...choice, classSubjects: [] };
    found.classSubjects.push({ id, class: className });
    choices.set(key, found);
  }
  return [...choices.values()];
}

function requireValidSitting(input: { startTime: string; durationMinutes: number }): void {
  const end = startMinute(input.startTime) + input.durationMinutes;
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || end > MINUTES_PER_DAY) {
    throw new InvalidInput("errors.examDurationInvalid");
  }
}

function lockTimetable(tx: Tx) {
  return tx.execute(sql`select pg_advisory_xact_lock(${EXAM_TIMETABLE_LOCK})`);
}

/**
 * Stores one Exam and its Assessment, refusing a clash with what the timetable holds so
 * far in this transaction. The caller has checked access and holds the timetable lock.
 */
async function scheduleExam(tx: Tx, input: AddExamInput): Promise<ExamIds> {
  requireId(input.roomId);
  const start = startMinute(input.startTime);
  const end = start + input.durationMinutes;

  const [found] = await tx
    .select({ classId: classSubject.classId })
    .from(classSubject)
    .where(eq(classSubject.id, input.classSubjectId));
  if (!found) throw new NotFound();
  await requireRoom(tx, input.roomId);

  // This also validates the date, so the clash query below only ever sees a real one.
  const { id: assessmentId } = await insertAssessment(tx, input);

  await requireNoClash(tx, { classId: found.classId, roomId: input.roomId, date: input.date, start, end });

  const [row] = await tx
    .insert(exam)
    .values({
      assessmentId,
      roomId: input.roomId,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
    })
    .returning({ id: exam.id });
  return { id: row.id, assessmentId };
}

/**
 * Refuses a sitting that overlaps another Exam of the same Class or in the same Room on
 * that date. Ranges are half-open, so an Exam may start the minute another ends. Exams
 * being moved are left out, so an old sitting never clashes with a new one. The caller
 * holds the timetable lock.
 */
async function requireNoClash(
  tx: Tx,
  at: { classId: number; roomId: number; date: string; start: number; end: number; exceptExamIds?: number[] },
): Promise<void> {
  const sameDay = await tx
    .select({
      classId: classSubject.classId,
      roomId: exam.roomId,
      startTime: exam.startTime,
      durationMinutes: exam.durationMinutes,
      subject: subject.name,
      class: schoolClass.name,
      room: room.name,
    })
    .from(exam)
    .innerJoin(assessment, eq(assessment.id, exam.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(room, eq(room.id, exam.roomId))
    .where(
      and(
        eq(assessment.date, at.date),
        or(eq(classSubject.classId, at.classId), eq(exam.roomId, at.roomId)),
        at.exceptExamIds?.length ? notInArray(exam.id, at.exceptExamIds) : undefined,
      ),
    )
    .orderBy(asc(exam.startTime));
  const overlapping = sameDay.filter((other) => {
    const otherStart = startMinute(other.startTime);
    return at.start < otherStart + other.durationMinutes && otherStart < at.end;
  });
  const sameClass = overlapping.find((other) => other.classId === at.classId);
  if (sameClass) throw new ExamClashForClass(clashing(sameClass));
  const sameRoom = overlapping.find((other) => other.roomId === at.roomId);
  if (sameRoom) throw new ExamClashForRoom(clashing(sameRoom));
}

function clashing(other: {
  subject: string;
  class: string;
  room: string;
  startTime: string;
  durationMinutes: number;
}): ClashingExam {
  const start = startMinute(other.startTime);
  return {
    subject: other.subject,
    class: other.class,
    room: other.room,
    start: clockTime(start),
    end: clockTime(start + other.durationMinutes),
  };
}

export type RescheduleExamInput = {
  examId: number;
  roomId: number;
  date: string;
  /** The school's wall-clock time, HH:MM. */
  startTime: string;
  durationMinutes: number;
};

/**
 * Moves an Exam to a new date, time, duration or Room. Its Assessment, and so its Class
 * Subject, type, maximum, weight and Marks, stay as they are.
 */
export async function rescheduleExam(ctx: Ctx, input: RescheduleExamInput): Promise<void> {
  requireAdmin(ctx.actor);
  requireId(input.examId);
  requireId(input.roomId);
  requireValidSitting(input);

  await ctx.db.transaction(async (tx) => {
    await lockTimetable(tx);
    await moveExams(tx, [{ examId: input.examId, roomId: input.roomId }], input);
  });
}

/**
 * Moves a grade-wide Exam: every Class sitting it goes to the new date, time and duration
 * together, so it stays one grade-wide Exam. The chosen Exam takes the new Room; the other
 * Classes keep theirs. All or nothing. An Exam on its own moves as `rescheduleExam` would.
 */
export async function rescheduleGradeWideExam(ctx: Ctx, input: RescheduleExamInput): Promise<void> {
  requireAdmin(ctx.actor);
  requireId(input.examId);
  requireId(input.roomId);
  requireValidSitting(input);

  await ctx.db.transaction(async (tx) => {
    await lockTimetable(tx);
    const others = (await gradeWideGroup(tx, input.examId)).filter((e) => e.id !== input.examId);
    // The chosen Exam moves last, so a clash with another Class's Room is reported from its side.
    const moves = others.map((e) => ({ examId: e.id, roomId: e.roomId }));
    await moveExams(tx, [...moves, { examId: input.examId, roomId: input.roomId }], input);
  });
}

/**
 * Moves Exams to one new sitting, each into its own Room, one at a time. Each is checked
 * against the timetable as it stands, with the ones not yet moved left out. A date only
 * changes while none of them has Marks. The caller holds the timetable lock.
 */
async function moveExams(
  tx: Tx,
  moves: { examId: number; roomId: number }[],
  sitting: { date: string; startTime: string; durationMinutes: number },
): Promise<void> {
  const start = startMinute(sitting.startTime);
  const found = [];
  for (const move of moves) found.push({ ...move, ...(await lockExamAssessment(tx, move.examId)) });
  for (const exam of found) {
    await requireRoom(tx, exam.roomId);
    // The new date must be a real day in the Class's year; the clash query needs one.
    await requireAssessmentDate(tx, { classSubjectId: exam.classSubjectId, date: sitting.date });
  }
  for (const exam of found) {
    if (sitting.date !== exam.date && (await hasMarks(tx, exam.assessmentId))) {
      throw new InvalidInput("errors.examHasMarksDateFixed");
    }
  }
  for (const [i, moving] of found.entries()) {
    await requireNoClash(tx, {
      classId: moving.classId,
      roomId: moving.roomId,
      date: sitting.date,
      start,
      end: start + sitting.durationMinutes,
      exceptExamIds: found.slice(i).map((e) => e.examId),
    });
    await tx.update(assessment).set({ date: sitting.date }).where(eq(assessment.id, moving.assessmentId));
    await tx
      .update(exam)
      .set({ roomId: moving.roomId, startTime: sitting.startTime, durationMinutes: sitting.durationMinutes })
      .where(eq(exam.id, moving.examId));
  }
}

/**
 * Deletes an Exam and its Assessment. Refused while any Mark is stored for it, so no
 * Mark is ever lost: the Subject Teacher clears them first. Deleting can't make a clash,
 * so it doesn't take the timetable lock.
 */
export async function deleteExam(ctx: Ctx, input: { examId: number }): Promise<void> {
  requireAdmin(ctx.actor);
  requireId(input.examId);

  await ctx.db.transaction(async (tx) => {
    const found = await lockExamAssessment(tx, input.examId);
    if (await hasMarks(tx, found.assessmentId)) throw new InvalidInput("errors.examHasMarks");
    await tx.delete(exam).where(eq(exam.id, input.examId));
    await tx.delete(assessment).where(eq(assessment.id, found.assessmentId));
  });
}

/**
 * Finds an Exam and locks its Assessment row, as a grid save does, so no Mark arrives
 * between the caller's check for Marks and its write. The Closed-year guard comes first,
 * keeping the order `saveMarks` uses: the year row, then the Assessment row.
 */
async function lockExamAssessment(tx: Tx, examId: number) {
  const [found] = await tx.select({ assessmentId: exam.assessmentId }).from(exam).where(eq(exam.id, examId));
  if (!found) throw new NotFound();
  await requireOpenYear(tx, { assessmentId: found.assessmentId });
  const [locked] = await tx
    .select({
      assessmentId: assessment.id,
      classSubjectId: assessment.classSubjectId,
      classId: classSubject.classId,
      date: assessment.date,
    })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .where(eq(assessment.id, found.assessmentId))
    .for("update", { of: assessment });
  return locked;
}

async function requireRoom(tx: Tx, roomId: number): Promise<void> {
  const [found] = await tx.select({ id: room.id }).from(room).where(eq(room.id, roomId));
  if (!found) throw new NotFound();
}

/** Whether any Mark is stored for the Assessment, on its roster or not. */
async function hasMarks(tx: Tx, assessmentId: number): Promise<boolean> {
  const [found] = await tx.select({ id: mark.assessmentId }).from(mark).where(eq(mark.assessmentId, assessmentId)).limit(1);
  return found !== undefined;
}

export type ExamDetail = {
  id: number;
  assessmentId: number;
  class: string;
  subject: string;
  type: AssessmentType;
  maxMarks: number;
  weight: number;
  roomId: number;
  date: string;
  /** HH:MM. */
  startTime: string;
  durationMinutes: number;
  /** The Term the date falls in, for the timetable to go back to; null if none does. */
  termId: number | null;
  /** The Class's Academic Year: a rescheduled date must stay within it. */
  academicYear: { id: number; startDate: string; endDate: string; closed: boolean };
  /** An Exam with Marks keeps its date and can't be deleted. */
  hasMarks: boolean;
  /** The other Classes' Exams sitting with this one as a grade-wide Exam, by Class name. */
  gradeWide: { id: number; class: string; room: string }[];
};

/** One Exam, with what the Admin's page needs to reschedule or delete it. */
export async function getExam(ctx: Ctx, input: { examId: number }): Promise<ExamDetail> {
  requireAdmin(ctx.actor);
  requireId(input.examId);
  const [found] = await ctx.db
    .select({
      id: exam.id,
      assessmentId: exam.assessmentId,
      class: schoolClass.name,
      subject: subject.name,
      type: assessment.type,
      maxMarks: assessment.maxMarks,
      weight: assessment.weight,
      roomId: exam.roomId,
      date: assessment.date,
      startTime: exam.startTime,
      durationMinutes: exam.durationMinutes,
      termId: term.id,
      yearId: academicYear.id,
      yearStart: academicYear.startDate,
      yearEnd: academicYear.endDate,
      yearClosed: sql<boolean>`${academicYear.closedAt} is not null`,
      hasMarks: sql<boolean>`exists (select 1 from ${mark} where ${mark.assessmentId} = ${assessment.id})`,
    })
    .from(exam)
    .innerJoin(assessment, eq(assessment.id, exam.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .leftJoin(
      term,
      and(
        eq(term.academicYearId, academicYear.id),
        lte(term.startDate, assessment.date),
        gte(term.endDate, assessment.date),
      ),
    )
    .where(eq(exam.id, input.examId));
  if (!found) throw new NotFound();
  const { yearId, yearStart, yearEnd, yearClosed, startTime, ...detail } = found;
  const group = await gradeWideGroup(ctx.db, input.examId);
  return {
    ...detail,
    startTime: clockTime(startMinute(startTime)),
    academicYear: { id: yearId, startDate: yearStart, endDate: yearEnd, closed: yearClosed },
    gradeWide: group
      .filter((e) => e.id !== input.examId)
      .map(({ id, class: className, room: roomName }) => ({ id, class: className, room: roomName })),
  };
}

/**
 * The Exams sitting together with this one as a grade-wide Exam, itself included, by Class
 * name: the same Grade, Subject, type, date, start and duration, as the timetable groups
 * them. An Exam on its own is a group of one.
 */
async function gradeWideGroup(db: Db | Tx, examId: number) {
  const [key] = await db
    .select({
      date: assessment.date,
      type: assessment.type,
      startTime: exam.startTime,
      durationMinutes: exam.durationMinutes,
      subjectId: classSubject.subjectId,
      gradeId: schoolClass.gradeId,
      academicYearId: schoolClass.academicYearId,
    })
    .from(exam)
    .innerJoin(assessment, eq(assessment.id, exam.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .where(eq(exam.id, examId));
  if (!key) return [];
  return db
    .select({ id: exam.id, class: schoolClass.name, roomId: exam.roomId, room: room.name })
    .from(exam)
    .innerJoin(assessment, eq(assessment.id, exam.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(room, eq(room.id, exam.roomId))
    .where(
      and(
        eq(assessment.date, key.date),
        eq(assessment.type, key.type),
        eq(exam.startTime, key.startTime),
        eq(exam.durationMinutes, key.durationMinutes),
        eq(classSubject.subjectId, key.subjectId),
        eq(schoolClass.gradeId, key.gradeId),
        eq(schoolClass.academicYearId, key.academicYearId),
      ),
    )
    .orderBy(asc(schoolClass.name));
}

export type TimetableExam = {
  id: number;
  assessmentId: number;
  class: string;
  room: string;
  teacher: string;
};

/**
 * One line of the timetable: Exams of one Grade with the same Subject, type and time. A
 * grade-wide Exam is several of them; an Exam for a single Class is a group of one.
 */
export type ExamGroup = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  grade: string;
  subject: string;
  type: AssessmentType;
  exams: TimetableExam[];
};

export type ExamTimetable = { term: Term; groups: ExamGroup[] };

/**
 * A Term's exam timetable, in time order. With no Term given, the one today falls in,
 * else the newest Academic Year's first; null if there is no Term at all.
 */
export async function examTimetable(ctx: Ctx, input: { termId?: number }): Promise<ExamTimetable | null> {
  requireAdmin(ctx.actor);
  const found = await timetableTerm(ctx, input.termId);
  if (!found) return null;

  const rows = await examRows(
    ctx.db,
    and(gte(assessment.date, found.startDate), lte(assessment.date, found.endDate)),
  );

  const groups = new Map<string, ExamGroup>();
  for (const r of rows) {
    const key = [r.date, r.startTime, r.durationMinutes, r.gradeId, r.subjectId, r.type].join("|");
    let group = groups.get(key);
    if (!group) {
      const start = startMinute(r.startTime);
      group = {
        date: r.date,
        startTime: clockTime(start),
        endTime: clockTime(start + r.durationMinutes),
        durationMinutes: r.durationMinutes,
        grade: r.grade,
        subject: r.subject,
        type: r.type,
        exams: [],
      };
      groups.set(key, group);
    }
    group.exams.push({
      id: r.id,
      assessmentId: r.assessmentId,
      class: r.class,
      room: r.room,
      teacher: r.teacher,
    });
  }
  return { term: found, groups: [...groups.values()] };
}

/** Exams with everything shown about them, in time order. Grade-wide ones come out together. */
export function examRows(db: Db, where: SQL | undefined) {
  return db
    .select({
      id: exam.id,
      assessmentId: exam.assessmentId,
      date: assessment.date,
      startTime: exam.startTime,
      durationMinutes: exam.durationMinutes,
      gradeId: grade.id,
      grade: grade.name,
      subjectId: subject.id,
      subject: subject.name,
      type: assessment.type,
      class: schoolClass.name,
      room: room.name,
      teacher: user.name,
    })
    .from(exam)
    .innerJoin(assessment, eq(assessment.id, exam.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(user, eq(user.id, classSubject.teacherId))
    .innerJoin(room, eq(room.id, exam.roomId))
    .where(where)
    .orderBy(
      asc(assessment.date),
      asc(exam.startTime),
      asc(exam.durationMinutes),
      asc(grade.name),
      asc(subject.name),
      asc(assessment.type),
      asc(schoolClass.name),
    );
}

async function timetableTerm(ctx: Ctx, termId: number | undefined): Promise<Term | null> {
  if (termId !== undefined) requireId(termId);
  const today = ctx.clock.today();
  const [found] = await ctx.db
    .select({
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      academicYearId: term.academicYearId,
      academicYear: academicYear.name,
    })
    .from(term)
    .innerJoin(academicYear, eq(academicYear.id, term.academicYearId))
    .where(termId === undefined ? undefined : eq(term.id, termId))
    .orderBy(
      // The Term today falls in comes first, then the newest year's first Term.
      desc(sql`${term.startDate} <= ${today} and ${term.endDate} >= ${today}`),
      desc(academicYear.startDate),
      asc(term.startDate),
    )
    .limit(1);
  if (!found && termId !== undefined) throw new NotFound();
  return found ?? null;
}

/** Minutes since midnight for HH:MM, or HH:MM:SS as Postgres returns a `time`. */
export function startMinute(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/.exec(value);
  if (!match) throw new InvalidInput("errors.examStartTimeInvalid");
  return Number(match[1]) * 60 + Number(match[2]);
}

/** HH:MM for minutes since midnight; an Exam can end exactly at 24:00. */
export function clockTime(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

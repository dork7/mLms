// What the Admin lands on: how many people and Classes the school has now, and which
// Report Cards are waiting for them to Publish.
import { and, asc, count, countDistinct, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { academicYear, enrollment, reportCardPublication, schoolClass, term, user } from "@/db/schema";
import { requireAdmin } from "../access";
import { enrollmentCovers } from "../enrollment/roster-condition";
import type { Ctx } from "../context";

export type WaitingReportCards = {
  classId: number;
  class: string;
  termId: number;
  term: string;
  academicYear: string;
  /** How many Report Cards this Class issues for this Term. */
  reportCards: number;
};

export type AdminDashboard = {
  adminName: string;
  today: string;
  /** Students in a Class now or starting in one later, so not those not yet enrolled or gone. */
  students: number;
  /** Teachers whose login isn't disabled. */
  teachers: number;
  /** The Classes of `academicYear`. */
  classes: number;
  /** The Academic Year today falls in, else the newest; null before there is one. */
  academicYear: string | null;
  reportCardsWaiting: WaitingReportCards[];
};

export async function getAdminDashboard(ctx: Ctx): Promise<AdminDashboard> {
  requireAdmin(ctx.actor);
  const today = ctx.clock.today();

  const [me] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, ctx.actor.userId));
  const [students] = await ctx.db
    .select({ total: countDistinct(enrollment.studentId) })
    .from(enrollment)
    .where(or(isNull(enrollment.endDate), gte(enrollment.endDate, today)));
  const [teachers] = await ctx.db
    .select({ total: count() })
    .from(user)
    .where(and(eq(user.role, "teacher"), isNull(user.disabledAt)));

  const [year] = await ctx.db
    .select({ id: academicYear.id, name: academicYear.name })
    .from(academicYear)
    .orderBy(
      desc(and(lte(academicYear.startDate, today), gte(academicYear.endDate, today))!),
      desc(academicYear.startDate),
    )
    .limit(1);
  const [classes] = year
    ? await ctx.db.select({ total: count() }).from(schoolClass).where(eq(schoolClass.academicYearId, year.id))
    : [{ total: 0 }];

  return {
    adminName: me.name,
    today,
    students: students.total,
    teachers: teachers.total,
    classes: classes.total,
    academicYear: year?.name ?? null,
    reportCardsWaiting: await reportCardsWaiting(ctx, today),
  };
}

/**
 * Each Class and Term with Report Cards to Publish: the Term's last day has come, so its
 * Issuing Classes are settled, and the Class has someone on its roster that day and no
 * standing Publication. A Closed year is left out, since Publish would refuse it. Counted
 * here rather than by building every card, as `classReportCards` would have to.
 */
function reportCardsWaiting(ctx: Ctx, today: string): Promise<WaitingReportCards[]> {
  return ctx.db
    .select({
      classId: schoolClass.id,
      class: schoolClass.name,
      termId: term.id,
      term: term.name,
      academicYear: academicYear.name,
      reportCards: countDistinct(enrollment.studentId),
    })
    .from(term)
    .innerJoin(academicYear, eq(academicYear.id, term.academicYearId))
    .innerJoin(schoolClass, eq(schoolClass.academicYearId, academicYear.id))
    .innerJoin(
      enrollment,
      and(
        eq(enrollment.classId, schoolClass.id),
        enrollmentCovers(term.endDate),
      ),
    )
    .leftJoin(
      reportCardPublication,
      and(
        eq(reportCardPublication.classId, schoolClass.id),
        eq(reportCardPublication.termLastDay, term.endDate),
        isNull(reportCardPublication.unpublishedAt),
      ),
    )
    .where(and(lte(term.endDate, today), isNull(academicYear.closedAt), sql`${reportCardPublication.id} is null`))
    .groupBy(schoolClass.id, schoolClass.name, term.id, term.name, term.endDate, academicYear.name)
    .orderBy(asc(term.endDate), asc(schoolClass.name));
}

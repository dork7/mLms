// Publish: the Admin releases a Class's Report Cards for a Term. Students can then see them,
// and what they depend on is frozen (see ./publications.ts). The Report Cards are stored as
// Published, so the Admin and the Student read the same thing, and it stays what the Student
// was given whatever later happens to the Grading Scale, the rank switch or a Teacher.
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { publishedReportCard, reportCardPublication } from "@/db/schema";
import { requireAdmin, requireCanSeeReportCards } from "../access";
import type { Ctx } from "../context";
import { AlreadyPublished, InvalidInput, NotPublished } from "../errors";
import { requireOpenYear } from "../school/closed-year";
import { takeFreezeLockExclusively } from "./publications";
import { rankIsEnabled } from "./rank-setting";
import { ranksOf } from "./report-card-rules";
import { classAndTerm, type PublishedCard, reportCardsIssuedBy } from "./report-cards";

type ClassTerm = { classId: number; termId: number };

/**
 * Publishes every Report Card the Class issues for the Term, complete or not: the preview
 * says what's missing and the Admin decides. A Student with no Issuing Class has none, so
 * Publish doesn't wait for them. A Class that issues no Report Card has nothing to Publish.
 */
export async function publishReportCards(ctx: Ctx, input: ClassTerm): Promise<void> {
  requireAdmin(ctx.actor);
  const { term } = await classAndTerm(ctx, input);
  await ctx.db.transaction(async (tx) => {
    await requireOpenYear(tx, { classId: input.classId });
    await takeFreezeLockExclusively(tx);
    const [already] = await tx
      .select({ id: reportCardPublication.id })
      .from(reportCardPublication)
      .where(standingFor(input.classId, term.endDate));
    if (already) throw new AlreadyPublished();

    // Read on this transaction's connection: writers waiting for the lock may hold the
    // others in the pool. The transaction has written nothing yet, so this reads only
    // what's committed, as the Db these helpers expect would.
    const inTx: Ctx = { ...ctx, db: tx as unknown as Db };
    const cards = await reportCardsIssuedBy(inTx, input.classId, term);
    if (cards.length === 0) throw new InvalidInput("errors.publishNoReportCards");
    const rankShown = await rankIsEnabled(inTx.db);
    const ranks = rankShown ? ranksOf(cards) : new Map<string, number>();

    const [publication] = await tx
      .insert(reportCardPublication)
      .values({
        classId: input.classId,
        termName: term.name,
        academicYearName: term.academicYear,
        termStartDate: term.startDate,
        termLastDay: term.endDate,
        rankShown,
        publishedAt: ctx.clock.now(),
        publishedBy: ctx.actor.userId,
      })
      .returning({ id: reportCardPublication.id });
    await tx.insert(publishedReportCard).values(
      cards.map((card) => {
        const stored: PublishedCard = { ...card, rank: ranks.get(card.studentId) ?? null };
        return { publicationId: publication.id, studentId: card.studentId, card: stored };
      }),
    );
  });
}

/**
 * Takes a Class's Report Cards for a Term back: Students no longer see them and writes are
 * accepted again. The Publication stays on record with who unpublished it and when.
 */
export async function unpublishReportCards(ctx: Ctx, input: ClassTerm): Promise<void> {
  requireAdmin(ctx.actor);
  const { term } = await classAndTerm(ctx, input);
  await ctx.db.transaction(async (tx) => {
    await requireOpenYear(tx, { classId: input.classId });
    await takeFreezeLockExclusively(tx);
    const taken = await tx
      .update(reportCardPublication)
      .set({ unpublishedAt: ctx.clock.now(), unpublishedBy: ctx.actor.userId })
      .where(standingFor(input.classId, term.endDate))
      .returning({ id: reportCardPublication.id });
    if (taken.length === 0) throw new NotPublished();
  });
}

function standingFor(classId: number, termLastDay: string) {
  return and(
    eq(reportCardPublication.classId, classId),
    eq(reportCardPublication.termLastDay, termLastDay),
    isNull(reportCardPublication.unpublishedAt),
  );
}

export type StudentReportCard = PublishedCard & {
  publicationId: number;
  term: { name: string; startDate: string; endDate: string; academicYear: string };
  rankShown: boolean;
  publishedAt: Date;
};

/** A Student's Published Report Cards, newest Term first. Unpublished ones aren't here. */
export async function studentReportCards(ctx: Ctx, input: { studentId: string }): Promise<StudentReportCard[]> {
  requireCanSeeReportCards(ctx.actor, input.studentId);
  const rows = await ctx.db
    .select({
      publicationId: reportCardPublication.id,
      card: publishedReportCard.card,
      termName: reportCardPublication.termName,
      startDate: reportCardPublication.termStartDate,
      endDate: reportCardPublication.termLastDay,
      academicYear: reportCardPublication.academicYearName,
      rankShown: reportCardPublication.rankShown,
      publishedAt: reportCardPublication.publishedAt,
    })
    .from(publishedReportCard)
    .innerJoin(reportCardPublication, eq(reportCardPublication.id, publishedReportCard.publicationId))
    .where(and(eq(publishedReportCard.studentId, input.studentId), isNull(reportCardPublication.unpublishedAt)))
    .orderBy(desc(reportCardPublication.termLastDay));
  return rows.map((r) => ({
    ...(r.card as PublishedCard),
    publicationId: r.publicationId,
    term: { name: r.termName, startDate: r.startDate, endDate: r.endDate, academicYear: r.academicYear },
    rankShown: r.rankShown,
    publishedAt: r.publishedAt,
  }));
}

CREATE TABLE "closed_year_scale" (
	"academic_year_id" integer NOT NULL,
	"grade_id" integer NOT NULL,
	"pass_mark" numeric(5, 2) NOT NULL,
	"bands" jsonb NOT NULL,
	CONSTRAINT "closed_year_scale_academic_year_id_grade_id_pk" PRIMARY KEY("academic_year_id","grade_id")
);
--> statement-breakpoint
ALTER TABLE "closed_year_scale" ADD CONSTRAINT "closed_year_scale_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closed_year_scale" ADD CONSTRAINT "closed_year_scale_grade_id_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Years Closed before this migration keep the Scale each Grade has now: earlier versions
-- aren't recorded anywhere. Same rule as `snapshotScalesForClosing`.
INSERT INTO "closed_year_scale" ("academic_year_id", "grade_id", "pass_mark", "bands")
SELECT y."id", s."grade_id", s."pass_mark",
  (SELECT jsonb_agg(jsonb_build_object('minPercent', b."min_percent", 'label', b."label") ORDER BY b."min_percent" DESC)
   FROM "grading_band" b WHERE b."grade_id" = s."grade_id")
FROM "academic_year" y
JOIN "grading_scale" s ON s."grade_id" IN (SELECT c."grade_id" FROM "class" c WHERE c."academic_year_id" = y."id")
WHERE y."closed_at" IS NOT NULL;

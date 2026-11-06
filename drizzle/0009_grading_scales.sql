CREATE TABLE "grading_band" (
	"grade_id" integer NOT NULL,
	"min_percent" numeric(5, 2) NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "grading_band_grade_id_min_percent_pk" PRIMARY KEY("grade_id","min_percent"),
	CONSTRAINT "grading_band_min_percent_range" CHECK ("grading_band"."min_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "grading_scale" (
	"grade_id" integer PRIMARY KEY NOT NULL,
	"pass_mark" numeric(5, 2) NOT NULL,
	CONSTRAINT "grading_scale_pass_mark_range" CHECK ("grading_scale"."pass_mark" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "grading_band" ADD CONSTRAINT "grading_band_grade_id_grading_scale_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grading_scale"("grade_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_scale" ADD CONSTRAINT "grading_scale_grade_id_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grade"("id") ON DELETE no action ON UPDATE no action;
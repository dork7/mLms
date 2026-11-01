CREATE TYPE "public"."assessment_type" AS ENUM('quiz', 'assignment', 'midterm', 'final');--> statement-breakpoint
CREATE TYPE "public"."mark_status" AS ENUM('absent', 'exempt');--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_subject_id" integer NOT NULL,
	"type" "assessment_type" NOT NULL,
	"date" date NOT NULL,
	"max_marks" numeric(7, 2) NOT NULL,
	"weight" numeric(7, 2) NOT NULL,
	CONSTRAINT "assessment_max_marks_positive" CHECK ("assessment"."max_marks" > 0),
	CONSTRAINT "assessment_weight_positive" CHECK ("assessment"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "mark" (
	"assessment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"score" numeric(7, 2),
	"status" "mark_status",
	CONSTRAINT "mark_assessment_id_student_id_pk" PRIMARY KEY("assessment_id","student_id"),
	CONSTRAINT "mark_score_or_status" CHECK (("mark"."score" is null) <> ("mark"."status" is null))
);
--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark" ADD CONSTRAINT "mark_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark" ADD CONSTRAINT "mark_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_class_subject_idx" ON "assessment" USING btree ("class_subject_id","date");--> statement-breakpoint
CREATE INDEX "mark_student_idx" ON "mark" USING btree ("student_id");
CREATE TABLE "lesson" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_subject_id" integer NOT NULL,
	"date" date NOT NULL,
	"period" integer NOT NULL,
	"topic" text NOT NULL,
	"homework" text DEFAULT '' NOT NULL,
	"teacher_id" text NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	CONSTRAINT "lesson_class_subject_date_period_unique" UNIQUE("class_subject_id","date","period")
);
--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
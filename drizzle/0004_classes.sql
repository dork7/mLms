CREATE TABLE "class_subject" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" text NOT NULL,
	CONSTRAINT "class_subject_class_subject_unique" UNIQUE("class_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "class" (
	"id" serial PRIMARY KEY NOT NULL,
	"academic_year_id" integer NOT NULL,
	"grade_id" integer NOT NULL,
	"name" text NOT NULL,
	"class_teacher_id" text NOT NULL,
	CONSTRAINT "class_year_name_unique" UNIQUE("academic_year_id","name")
);
--> statement-breakpoint
ALTER TABLE "class_subject" ADD CONSTRAINT "class_subject_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject" ADD CONSTRAINT "class_subject_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject" ADD CONSTRAINT "class_subject_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_grade_id_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_class_teacher_id_user_id_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_subject_teacher_idx" ON "class_subject" USING btree ("teacher_id");
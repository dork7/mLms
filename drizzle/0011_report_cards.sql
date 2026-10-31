CREATE TABLE "overall_remark" (
	"class_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"term_last_day" date NOT NULL,
	"remark" text NOT NULL,
	CONSTRAINT "overall_remark_class_id_student_id_term_last_day_pk" PRIMARY KEY("class_id","student_id","term_last_day")
);
--> statement-breakpoint
CREATE TABLE "subject_remark" (
	"class_subject_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"term_last_day" date NOT NULL,
	"remark" text NOT NULL,
	CONSTRAINT "subject_remark_class_subject_id_student_id_term_last_day_pk" PRIMARY KEY("class_subject_id","student_id","term_last_day")
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "rank_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overall_remark" ADD CONSTRAINT "overall_remark_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overall_remark" ADD CONSTRAINT "overall_remark_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_remark" ADD CONSTRAINT "subject_remark_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_remark" ADD CONSTRAINT "subject_remark_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "overall_remark_student_idx" ON "overall_remark" USING btree ("student_id","term_last_day");--> statement-breakpoint
CREATE INDEX "subject_remark_student_idx" ON "subject_remark" USING btree ("student_id","term_last_day");
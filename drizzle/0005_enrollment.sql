CREATE TABLE "enrollment" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"class_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);
--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_one_open_per_student" ON "enrollment" USING btree ("student_id") WHERE "enrollment"."end_date" is null;--> statement-breakpoint
CREATE INDEX "enrollment_class_idx" ON "enrollment" USING btree ("class_id","start_date");
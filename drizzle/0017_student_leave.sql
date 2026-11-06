CREATE TABLE "leave_excused_mark" (
	"assessment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"leave_request_id" integer NOT NULL,
	CONSTRAINT "leave_excused_mark_assessment_id_student_id_pk" PRIMARY KEY("assessment_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "leave_excused_mark" ADD CONSTRAINT "leave_excused_mark_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_excused_mark" ADD CONSTRAINT "leave_excused_mark_mark_fk" FOREIGN KEY ("assessment_id","student_id") REFERENCES "public"."mark"("assessment_id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_excused_mark_request_idx" ON "leave_excused_mark" USING btree ("leave_request_id");
CREATE TABLE "student" (
	"user_id" text PRIMARY KEY NOT NULL,
	"student_number" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"national_id" text NOT NULL,
	"guardian_contact" text NOT NULL,
	"email" text,
	"admission_date" date NOT NULL,
	CONSTRAINT "student_student_number_unique" UNIQUE("student_number")
);
--> statement-breakpoint
CREATE TABLE "student_photo" (
	"student_id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_photo" ADD CONSTRAINT "student_photo_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE cascade ON UPDATE no action;
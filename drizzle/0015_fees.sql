CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'cheque');--> statement-breakpoint
CREATE TABLE "fee" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amount_fils" integer NOT NULL,
	"due_date" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fee_amount_positive" CHECK ("fee"."amount_fils" > 0)
);
--> statement-breakpoint
CREATE TABLE "fee_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"waived_at" timestamp with time zone,
	"waived_by" text,
	CONSTRAINT "fee_assignment_fee_student" UNIQUE("fee_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "payment_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_assignment_id" integer NOT NULL,
	"amount_fils" integer NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"recorded_by" text NOT NULL,
	CONSTRAINT "payment_record_amount_positive" CHECK ("payment_record"."amount_fils" > 0)
);
--> statement-breakpoint
ALTER TABLE "fee_assignment" ADD CONSTRAINT "fee_assignment_fee_id_fee_id_fk" FOREIGN KEY ("fee_id") REFERENCES "public"."fee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_assignment" ADD CONSTRAINT "fee_assignment_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_assignment" ADD CONSTRAINT "fee_assignment_waived_by_user_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_fee_assignment_id_fee_assignment_id_fk" FOREIGN KEY ("fee_assignment_id") REFERENCES "public"."fee_assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fee_assignment_student_idx" ON "fee_assignment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payment_record_assignment_idx" ON "payment_record" USING btree ("fee_assignment_id");
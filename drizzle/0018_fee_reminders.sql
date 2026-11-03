CREATE TYPE "public"."fee_reminder_kind" AS ENUM('upcoming', 'overdue');--> statement-breakpoint
CREATE TABLE "fee_reminder" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_assignment_id" integer NOT NULL,
	"kind" "fee_reminder_kind" NOT NULL,
	"sent_on" date NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"sent_to" text NOT NULL,
	"sent_by" text,
	CONSTRAINT "fee_reminder_one_a_day" UNIQUE("fee_assignment_id","sent_on")
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "fee_reminder_lead_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "fee_reminder_interval_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_reminder" ADD CONSTRAINT "fee_reminder_fee_assignment_id_fee_assignment_id_fk" FOREIGN KEY ("fee_assignment_id") REFERENCES "public"."fee_assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_reminder" ADD CONSTRAINT "fee_reminder_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
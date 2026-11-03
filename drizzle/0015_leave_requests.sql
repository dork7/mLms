CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "leave_attachment" (
	"leave_request_id" integer PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "leave_request_dates_in_order" CHECK ("leave_request"."end_date" >= "leave_request"."start_date"),
	CONSTRAINT "leave_request_decision" CHECK (("leave_request"."status" = 'pending') = ("leave_request"."decided_by" is null) and ("leave_request"."decided_by" is null) = ("leave_request"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "leave_attachment" ADD CONSTRAINT "leave_attachment_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_request_requester_idx" ON "leave_request" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "leave_request_status_idx" ON "leave_request" USING btree ("status");
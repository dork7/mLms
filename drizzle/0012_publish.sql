CREATE TABLE "published_report_card" (
	"publication_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"card" jsonb NOT NULL,
	CONSTRAINT "published_report_card_publication_id_student_id_pk" PRIMARY KEY("publication_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "report_card_publication" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"term_name" text NOT NULL,
	"academic_year_name" text NOT NULL,
	"term_start_date" date NOT NULL,
	"term_last_day" date NOT NULL,
	"rank_shown" boolean NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" text NOT NULL,
	"unpublished_at" timestamp with time zone,
	"unpublished_by" text
);
--> statement-breakpoint
ALTER TABLE "published_report_card" ADD CONSTRAINT "published_report_card_publication_id_report_card_publication_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."report_card_publication"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_report_card" ADD CONSTRAINT "published_report_card_student_id_student_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_publication" ADD CONSTRAINT "report_card_publication_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_publication" ADD CONSTRAINT "report_card_publication_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_publication" ADD CONSTRAINT "report_card_publication_unpublished_by_user_id_fk" FOREIGN KEY ("unpublished_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "published_report_card_student_idx" ON "published_report_card" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_card_publication_one_standing" ON "report_card_publication" USING btree ("class_id","term_last_day") WHERE "report_card_publication"."unpublished_at" is null;
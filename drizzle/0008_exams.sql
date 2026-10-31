CREATE TABLE "exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"start_time" time(0) NOT NULL,
	"duration_minutes" integer NOT NULL,
	CONSTRAINT "exam_assessment_id_unique" UNIQUE("assessment_id"),
	CONSTRAINT "exam_duration_positive" CHECK ("exam"."duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_room_idx" ON "exam" USING btree ("room_id");
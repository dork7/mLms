-- Existing Grades stay with no order: names can't be trusted to sort ("Grade 10" before
-- "Grade 9"), and a guess could promote a Class into the wrong Grade. The Admin sets it.
ALTER TABLE "grade" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_sort_order_unique" UNIQUE("sort_order");--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_sort_order_positive" CHECK ("grade"."sort_order" > 0);
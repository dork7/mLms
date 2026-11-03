// Deciding a Leave Request from a decider's page (the Admin's or a Class Teacher's). Each
// page's own server action calls this with its own path: it calls the layer, then comes
// back to that page with what the decision did in the query, so the page can say how many
// Marks changed or why it was refused. Not a "use server" file, so the path can't be chosen
// by the browser.
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decideLeaveRequest, type LeaveDecision } from "@/core/leave/leave-requests";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export type DecisionPage = "/admin/leave" | "/teacher/leave/students";

export async function decideFromForm(form: FormData, page: DecisionPage): Promise<never> {
  const leaveRequestId = Number(form.get("leaveRequestId"));
  const decision = String(form.get("decision") ?? "") as LeaveDecision;
  const query = new URLSearchParams();
  try {
    const outcome = await asCurrentActor((ctx) => decideLeaveRequest(ctx, { leaveRequestId, decision }));
    query.set("decision", decision);
    if (form.get("student") === "1") {
      query.set("exempted", String(outcome.marksExempted));
      query.set("restored", String(outcome.marksRestored));
      query.set("frozen", String(outcome.marksFrozen));
    }
  } catch (err) {
    query.set("refused", refusalKey(err));
  }
  revalidatePath(page);
  redirect(`${page}?${query}`);
}

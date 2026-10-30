import { redirect } from "next/navigation";
import { currentActor } from "@/web/as-current-actor";

export default async function Home() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  // Teacher and Student dashboards arrive in later tickets.
  redirect("/admin");
}

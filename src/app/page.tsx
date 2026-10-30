import { redirect } from "next/navigation";
import { currentSession } from "@/web/as-current-actor";

export default async function Home() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  // The Student dashboard arrives in a later ticket.
  redirect(session.actor.role === "admin" ? "/admin" : "/teacher");
}

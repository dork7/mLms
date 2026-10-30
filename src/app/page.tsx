import { redirect } from "next/navigation";
import { currentSession } from "@/web/as-current-actor";

export default async function Home() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  // Students land on their profile until the Student dashboard ticket.
  const home = { admin: "/admin", teacher: "/teacher", student: "/student" } as const;
  redirect(home[session.actor.role]);
}

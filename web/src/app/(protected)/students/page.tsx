import { auth } from "@/auth";
import { canViewOperations } from "@/lib/roles";
import { redirect } from "next/navigation";

/** Legacy route — student roster lives under Registrations. */
export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  redirect("/registrations/students");
}

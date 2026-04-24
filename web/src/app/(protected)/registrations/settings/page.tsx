import { auth } from "@/auth";
import { canViewOperations } from "@/lib/roles";
import { redirect } from "next/navigation";

/** Legacy hub — settings are edited from Form builder (expand a season → Settings). */
export default async function RegistrationsSettingsHubPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  redirect("/registrations/forms");
}

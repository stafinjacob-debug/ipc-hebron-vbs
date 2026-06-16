import { auth } from "@/auth";
import { canSeeMainNavLink } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function RegistrationFormsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canSeeMainNavLink(session.user.role, "/registrations/forms")) {
    redirect("/dashboard");
  }

  return children;
}

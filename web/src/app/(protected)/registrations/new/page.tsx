import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { redirect } from "next/navigation";
import { RegistrationForm } from "./registration-form";

export default async function NewRegistrationPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/registrations");

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: {
      classrooms: { orderBy: { name: "asc" } },
    },
  });

  const forForm = seasons.map((s) => ({
    id: s.id,
    name: s.name,
    year: s.year,
    classrooms: s.classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      ageMin: c.ageMin,
      ageMax: c.ageMax,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-foreground/60">
          <Link href="/registrations" className="hover:underline">
            ← Registrations
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New VBS registration
        </h1>
        <p className="mt-1 text-foreground/70">
          Enter the parent or guardian and child. This creates a new household record
          and enrolls the child in the season you select.
        </p>
      </div>

      <RegistrationForm seasons={forForm} />
    </div>
  );
}

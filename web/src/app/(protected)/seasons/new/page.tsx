import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateProgramForm } from "../create-program-form";

export default async function NewProgramPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/dashboard");

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/seasons" className="text-sm text-foreground/60 underline hover:no-underline">
          ← Programs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create program</h1>
        <p className="mt-1 text-sm text-foreground/70">
          New events get their own signup URL at <code className="text-xs">/register/your-slug</code>. Existing VBS
          programs without a slug stay on <code className="text-xs">/register</code>.
        </p>
      </div>

      <CreateProgramForm seasons={seasons} />
    </div>
  );
}

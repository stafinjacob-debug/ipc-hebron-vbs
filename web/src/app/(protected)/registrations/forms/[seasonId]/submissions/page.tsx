import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function FormSubmissionsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim().toUpperCase() ?? "";

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) notFound();

  const allowed = new Set(["PENDING", "CONFIRMED", "CANCELLED", "WAITLIST", "DRAFT", "CHECKED_OUT"]);
  const statusOk = status && allowed.has(status) ? status : "";

  const where: Prisma.FormSubmissionWhereInput = { seasonId };
  if (q) {
    where.AND = [
      {
        OR: [
          { registrationCode: { contains: q, mode: "insensitive" } },
          { guardian: { email: { contains: q, mode: "insensitive" } } },
          { guardian: { firstName: { contains: q, mode: "insensitive" } } },
          { guardian: { lastName: { contains: q, mode: "insensitive" } } },
          { guardian: { phone: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }
  if (statusOk) {
    where.registrations = { some: { status: statusOk as never } };
  }

  const rows = await prisma.formSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: {
      guardian: true,
      registrations: { include: { child: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Code, email, name, phone"
            className="mt-1 min-w-[220px] rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
            Has child status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusOk}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {["PENDING", "CONFIRMED", "WAITLIST", "CANCELLED", "CHECKED_OUT", "DRAFT"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Filter
        </button>
        <Link
          href={`/registrations/forms/${seasonId}/submissions/export`}
          className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
        >
          Export CSV
        </Link>
      </form>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Guardian</th>
              <th className="px-4 py-3 font-medium">Children</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10">
                <td className="px-4 py-3 font-mono text-xs">{s.registrationCode}</td>
                <td className="px-4 py-3">
                  {s.guardian.firstName} {s.guardian.lastName}
                  <br />
                  <span className="text-foreground/60">{s.guardian.email ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-foreground/80">
                  {s.registrations
                    .map((r) => `${r.child.firstName} (${r.status})`)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-foreground/70">{s.submittedAt.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/registrations/forms/${seasonId}/submissions/${s.id}`}
                    className="font-medium underline hover:no-underline"
                  >
                    View / edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No submissions match.</p>
        )}
      </div>
    </div>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFormDefinitionJson } from "@/lib/registration-form-definition";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { RegistrationAdminPanel } from "./registration-admin-panel";
import { RegistrationClassAssignment } from "./registration-class-assignment";

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatCapturedValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() || "—";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { registrationId } = await params;
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
      season: true,
      classroom: true,
      formSubmission: {
        select: {
          id: true,
          registrationCode: true,
          guardianResponses: true,
          form: { select: { publishedDefinitionJson: true, draftDefinitionJson: true } },
        },
      },
      waiverAgreement: { select: { pdfUrl: true, signedAt: true, signerName: true } },
    },
  });

  const seasonClassrooms = reg
    ? await prisma.classroom.findMany({
        where: { seasonId: reg.seasonId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          ageMin: true,
          ageMax: true,
          useAgeRuleForAutoAssign: true,
          ageRule: true,
        },
      })
    : [];

  if (!reg) notFound();

  const canEdit = canManageDirectory(session.user.role);
  const hasTicket = Boolean(reg.checkInToken);
  const base = getPublicAppBaseUrl();
  const ticketUrl = hasTicket ? registrationTicketUrl(reg.checkInToken!, base) : null;
  const qrDataUrl = hasTicket
    ? await QRCode.toDataURL(ticketUrl!, {
        width: 200,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
    : null;

  const g = reg.child.guardian;
  const guardianResponseMap = asRecord(reg.formSubmission?.guardianResponses);
  const childResponseMap = asRecord(reg.customResponses);
  const formDef = parseFormDefinitionJson(
    reg.formSubmission?.form?.publishedDefinitionJson ??
      reg.formSubmission?.form?.draftDefinitionJson ??
      null,
  );
  const labelByKey = new Map(
    (formDef?.fields ?? [])
      .filter((f) => f.type !== "sectionHeader" && f.type !== "staticText")
      .map((f) => [f.key, f.label?.trim() || humanizeKey(f.key)]),
  );
  const guardianCapturedRows = [
    { key: "guardianFirstName", label: labelByKey.get("guardianFirstName") ?? "Guardian first name", value: g.firstName },
    { key: "guardianLastName", label: labelByKey.get("guardianLastName") ?? "Guardian last name", value: g.lastName },
    { key: "guardianEmail", label: labelByKey.get("guardianEmail") ?? "Guardian email", value: g.email ?? "" },
    { key: "guardianPhone", label: labelByKey.get("guardianPhone") ?? "Guardian phone", value: g.phone ?? "" },
    ...Object.entries(guardianResponseMap).map(([key, value]) => ({
      key,
      label: labelByKey.get(key) ?? humanizeKey(key),
      value,
    })),
  ].filter((row) => formatCapturedValue(row.value) !== "—");

  const childCapturedRows = [
    { key: "childFirstName", label: labelByKey.get("childFirstName") ?? "Child first name", value: reg.child.firstName },
    { key: "childLastName", label: labelByKey.get("childLastName") ?? "Child last name", value: reg.child.lastName },
    {
      key: "childDateOfBirth",
      label: labelByKey.get("childDateOfBirth") ?? "Child date of birth",
      value: reg.child.dateOfBirth.toISOString().slice(0, 10),
    },
    {
      key: "allergiesNotes",
      label: labelByKey.get("allergiesNotes") ?? "Allergies or medical notes",
      value: reg.child.allergiesNotes ?? "",
    },
    ...Object.entries(childResponseMap).map(([key, value]) => ({
      key,
      label: labelByKey.get(key) ?? humanizeKey(key),
      value,
    })),
  ].filter((row) => formatCapturedValue(row.value) !== "—");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/registrations" className="text-sm font-medium text-brand underline">
          ← Registrations overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Registration detail</h1>
        <p className="mt-1 text-foreground/70">
          {reg.child.firstName} {reg.child.lastName} · {reg.season.name}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground">Registration</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-foreground/55">Registration #</dt>
                <dd className="font-mono font-semibold text-foreground">
                  {reg.registrationNumber ?? "Pending approval"}
                </dd>
              </div>
              <div>
                <dt className="text-foreground/55">Status</dt>
                <dd className="text-foreground">{reg.status}</dd>
              </div>
              <div>
                <dt className="text-foreground/55">Registered</dt>
                <dd className="text-foreground/80">{reg.registeredAt.toLocaleString()}</dd>
              </div>
              {reg.formSubmission ? (
                <div className="sm:col-span-2">
                  <dt className="text-foreground/55">Form submission</dt>
                  <dd>
                    <Link
                      href={`/registrations/forms/${reg.seasonId}/submissions/${reg.formSubmission.id}`}
                      className="font-medium text-brand underline"
                    >
                      {reg.formSubmission.registrationCode}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground">Child</h2>
            <p className="mt-2 text-sm">
              {reg.child.firstName} {reg.child.lastName}
            </p>
            <p className="text-sm text-foreground/70">
              DOB {reg.child.dateOfBirth.toLocaleDateString()}
            </p>
            {reg.child.allergiesNotes ? (
              <p className="mt-2 text-sm text-foreground/80">Medical notes on file (staff only).</p>
            ) : null}
          </section>

          {reg.waiverAgreement ? (
            <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
              <h2 className="text-sm font-semibold text-foreground">Signed waiver</h2>
              <p className="mt-2 text-sm text-foreground/80">
                Signed by <span className="font-medium text-foreground">{reg.waiverAgreement.signerName}</span> on{" "}
                {reg.waiverAgreement.signedAt.toLocaleString()}.
              </p>
              <p className="mt-3">
                <a
                  href={`/api/registrations/${reg.id}/waiver-pdf`}
                  className="inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/[0.04] px-3 py-2 text-sm font-medium text-brand underline-offset-4 hover:bg-foreground/[0.07] hover:underline"
                >
                  Download signed waiver (PDF)
                </a>
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground">Guardian</h2>
            <p className="mt-2 text-sm">
              {g.firstName} {g.lastName}
            </p>
            <p className="text-sm text-foreground/70">{g.email ?? "—"}</p>
            <p className="text-sm text-foreground/70">{g.phone ?? "—"}</p>
          </section>

          <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground">Captured form responses</h2>
            <p className="mt-1 text-xs text-foreground/60">
              Values saved from the public registration form for this family and this child.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Guardian fields</p>
                <dl className="mt-2 space-y-2 text-sm">
                  {guardianCapturedRows.map((row) => (
                    <div key={`g-${row.key}`} className="grid grid-cols-[minmax(9rem,13rem)_1fr] gap-3">
                      <dt className="text-foreground/60">{row.label}</dt>
                      <dd className="break-words text-foreground">{formatCapturedValue(row.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Child fields</p>
                <dl className="mt-2 space-y-2 text-sm">
                  {childCapturedRows.map((row) => (
                    <div key={`c-${row.key}`} className="grid grid-cols-[minmax(9rem,13rem)_1fr] gap-3">
                      <dt className="text-foreground/60">{row.label}</dt>
                      <dd className="break-words text-foreground">{formatCapturedValue(row.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <RegistrationClassAssignment
            registrationId={reg.id}
            currentClassroomId={reg.classroomId}
            currentClassroomName={reg.classroom?.name ?? null}
            method={reg.classAssignmentMethod}
            matchedAtAge={reg.classMatchedAtAge}
            overrideReason={reg.classOverrideReason}
            childDobIso={reg.child.dateOfBirth.toISOString()}
            registeredAtIso={reg.registeredAt.toISOString()}
            seasonStartIso={reg.season.startDate.toISOString()}
            classrooms={seasonClassrooms}
            canEdit={canEdit}
          />

          {reg.notes ? (
            <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
              <h2 className="text-sm font-semibold text-foreground">Staff notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{reg.notes}</p>
            </section>
          ) : null}

          {canEdit ? (
            <RegistrationAdminPanel
              registrationId={reg.id}
              status={reg.status}
              expectsPayment={reg.expectsPayment}
              paymentReceivedAt={reg.paymentReceivedAt?.toISOString() ?? null}
              guardianHasEmail={Boolean(g.email?.trim())}
              guardianHasPhone={Boolean(g.phone?.trim())}
            />
          ) : null}
        </div>

        <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
          <h2 className="text-sm font-semibold text-foreground">Check-in QR</h2>
          {hasTicket && qrDataUrl && ticketUrl ? (
            <>
              <p className="mt-1 text-xs text-foreground/60">Same code families see when confirmed.</p>
              <div className="mt-4 flex justify-center rounded-lg bg-white p-3 dark:bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} width={180} height={180} alt="QR code" />
              </div>
              <p className="mt-3 break-all text-xs text-foreground/55">{ticketUrl}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-foreground/70">
              QR/ticket will be generated when this registration is approved.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

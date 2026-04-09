import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { RegistrationAdminPanel } from "./registration-admin-panel";

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
      formSubmission: { select: { id: true, registrationCode: true } },
    },
  });

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
              <div>
                <dt className="text-foreground/55">Class</dt>
                <dd className="text-foreground/80">{reg.classroom?.name ?? "—"}</dd>
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

          <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-foreground">Guardian</h2>
            <p className="mt-2 text-sm">
              {g.firstName} {g.lastName}
            </p>
            <p className="text-sm text-foreground/70">{g.email ?? "—"}</p>
            <p className="text-sm text-foreground/70">{g.phone ?? "—"}</p>
          </section>

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

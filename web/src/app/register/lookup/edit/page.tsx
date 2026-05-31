import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { rulesFromDb } from "@/lib/public-registration";
import { readRegistrantLookupSession } from "@/lib/registrant-lookup-session";
import {
  registrantLookupRegistrationInclude,
  registrationMatchesLookupEmail,
  submissionMatchesLookupEmail,
} from "@/lib/registrant-lookup-fields";
import {
  registrantLookupRegistrationWhere,
} from "@/lib/registrant-lookup";
import {
  buildChildFieldValues,
  buildGuardianFieldValues,
} from "@/lib/registrant-edit-form";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { buildRegistrantPaymentDisplay } from "@/lib/registrant-lookup-payment";
import { getStripeClient } from "@/lib/stripe-registration-payment";
import { RegistrantEditForm } from "./registrant-edit-form";

async function loadPaymentDisplay(args: {
  expectsPayment: boolean;
  paymentReceivedAt: Date | null;
  formSubmissionId: string | null;
  stripePaymentStatus: string | null;
  stripeCheckoutSessionId: string | null;
  stripeAmountChargedCents: number | null;
}) {
  const stripeConfigured = Boolean(getStripeClient());
  return buildRegistrantPaymentDisplay({
    payment: {
      expectsPayment: args.expectsPayment,
      paymentReceivedAt: args.paymentReceivedAt,
      formSubmissionId: args.formSubmissionId,
      formSubmission: {
        stripePaymentStatus: args.stripePaymentStatus,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      },
    },
    stripeAmountChargedCents: args.stripeAmountChargedCents,
    stripeConfigured,
  });
}

async function loadSeasonFormContext(seasonId: string) {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: {
      publicRegistrationSettings: true,
      registrationForm: true,
    },
  });
  if (!season) return null;
  const form = season.registrationForm;
  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: form?.publishedDefinitionJson ?? null,
        draftDefinitionJson: form?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();
  return {
    seasonName: season.name,
    definition,
    rules: rulesFromDb(season.publicRegistrationSettings),
  };
}

export default async function RegistrantLookupEditPage({
  searchParams,
}: {
  searchParams?: Promise<{ payment?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const paymentCanceled = sp.payment === "canceled";

  const session = await readRegistrantLookupSession();
  if (!session) redirect("/register/lookup");

  if (session.kind === "registration") {
    const reg = await prisma.registration.findUnique({
      where: { id: session.registrationId },
      include: {
        season: registrantLookupRegistrationInclude.season,
        formSubmission: {
          select: {
            id: true,
            registrationCode: true,
            guardianResponses: true,
            stripePaymentStatus: true,
            stripeCheckoutSessionId: true,
            stripeAmountChargedCents: true,
            guardian: { select: { email: true, phone: true } },
          },
        },
        child: { include: { guardian: true } },
      },
    });
    if (!reg) redirect("/register/lookup");
    const active =
      reg.status === "PENDING" || reg.status === "CONFIRMED" || reg.status === "WAITLIST";
    const emailOk = registrationMatchesLookupEmail(reg, session.emailNormalized);
    if (!active || !emailOk) redirect("/register/lookup");

    const formContext = await loadSeasonFormContext(reg.seasonId);
    if (!formContext) redirect("/register/lookup");

    const guardian = reg.child.guardian;
    const guardianResponses =
      (reg.formSubmission?.guardianResponses as Record<string, unknown> | null) ?? {};
    const payment = await loadPaymentDisplay({
      expectsPayment: reg.expectsPayment,
      paymentReceivedAt: reg.paymentReceivedAt,
      formSubmissionId: reg.formSubmissionId,
      stripePaymentStatus: reg.formSubmission?.stripePaymentStatus ?? null,
      stripeCheckoutSessionId: reg.formSubmission?.stripeCheckoutSessionId ?? null,
      stripeAmountChargedCents: reg.formSubmission?.stripeAmountChargedCents ?? null,
    });
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <Link href="/register/lookup" className="text-sm text-brand underline">
            ← Look up another registration
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your registration</h1>
          <p className="mt-1 text-sm text-muted">Review and update your information below.</p>
        </div>

        <RegistrantEditForm
          registrationCode={reg.registrationNumber ?? reg.id.slice(-8).toUpperCase()}
          seasonName={formContext.seasonName}
          definition={formContext.definition}
          rules={formContext.rules}
          payment={payment}
          paymentCanceled={paymentCanceled}
          guardianValues={buildGuardianFieldValues({
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            email: guardian.email,
            phone: guardian.phone,
            guardianResponses,
          })}
          children={[
            {
              registrationId: reg.id,
              values: buildChildFieldValues({
                firstName: reg.child.firstName,
                lastName: reg.child.lastName,
                dateOfBirth: reg.child.dateOfBirth.toISOString().slice(0, 10),
                allergiesNotes: reg.child.allergiesNotes,
                customResponses: (reg.customResponses as Record<string, unknown> | null) ?? {},
              }),
            },
          ]}
        />
      </div>
    );
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: session.submissionId },
    include: {
      guardian: true,
      season: {
        select: {
          id: true,
          name: true,
          registrationForm: {
            select: {
              registrantLookupEmailFieldKey: true,
              registrantLookupPhoneFieldKey: true,
              publishedDefinitionJson: true,
              draftDefinitionJson: true,
            },
          },
        },
      },
      registrations: {
        where: registrantLookupRegistrationWhere,
        include: { child: { include: { guardian: true } } },
        orderBy: { child: { firstName: "asc" } },
      },
    },
  });

  if (!submission || submission.registrations.length === 0) redirect("/register/lookup");

  if (
    !submissionMatchesLookupEmail({
      emailNormalized: session.emailNormalized,
      form: submission.season.registrationForm,
      guardian: submission.guardian,
      guardianResponses: (submission.guardianResponses as Record<string, unknown> | null) ?? {},
      registrations: submission.registrations,
    })
  ) {
    redirect("/register/lookup");
  }

  const formContext = await loadSeasonFormContext(submission.seasonId);
  if (!formContext) redirect("/register/lookup");

  const guardianResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};
  const sampleReg = submission.registrations[0]!;
  const payment = await loadPaymentDisplay({
    expectsPayment: sampleReg.expectsPayment,
    paymentReceivedAt: sampleReg.paymentReceivedAt,
    formSubmissionId: submission.id,
    stripePaymentStatus: submission.stripePaymentStatus,
    stripeCheckoutSessionId: submission.stripeCheckoutSessionId,
    stripeAmountChargedCents: submission.stripeAmountChargedCents,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/register/lookup" className="text-sm text-brand underline">
          ← Look up another registration
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your registration</h1>
        <p className="mt-1 text-sm text-muted">Review and update your information below.</p>
      </div>

      <RegistrantEditForm
        registrationCode={submission.registrationCode}
        seasonName={formContext.seasonName}
        definition={formContext.definition}
        rules={formContext.rules}
        payment={payment}
        paymentCanceled={paymentCanceled}
        guardianValues={buildGuardianFieldValues({
          firstName: submission.guardian.firstName,
          lastName: submission.guardian.lastName,
          email: submission.guardian.email,
          phone: submission.guardian.phone,
          guardianResponses,
        })}
        children={submission.registrations.map((r) => ({
          registrationId: r.id,
          values: buildChildFieldValues({
            firstName: r.child.firstName,
            lastName: r.child.lastName,
            dateOfBirth: r.child.dateOfBirth.toISOString().slice(0, 10),
            allergiesNotes: r.child.allergiesNotes,
            customResponses: (r.customResponses as Record<string, unknown> | null) ?? {},
          }),
        }))}
      />
    </div>
  );
}

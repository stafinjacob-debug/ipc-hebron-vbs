import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySubmissionPublicToken } from "@/lib/registration-public-token";
import { CancelRegistrationForm } from "./cancel-registration-form";

export const metadata: Metadata = {
  title: "Cancel registration | IPC Hebron VBS",
  robots: { index: false, follow: false },
};

export default async function CancelRegistrationPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>This cancel link is missing or invalid.</p>
        <a href="/register" className="mt-4 inline-block font-medium text-brand underline">
          Go to registration
        </a>
      </div>
    );
  }

  const verified = verifySubmissionPublicToken(token, "cancel");
  if (!verified) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>This cancel link has expired or is not valid.</p>
        <p className="mt-2">
          Please email{" "}
          <a href="mailto:vbs@ipchouston.com" className="font-medium text-brand underline">
            vbs@ipchouston.com
          </a>{" "}
          for help.
        </p>
      </div>
    );
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: verified.submissionId },
    include: {
      season: true,
      registrations: {
        where: { status: { notIn: ["CANCELLED", "CHECKED_OUT"] } },
        include: { child: true },
      },
    },
  });

  if (!submission) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>We could not find that registration.</p>
      </div>
    );
  }

  const childNames = submission.registrations.map((r) =>
    `${r.child.firstName} ${r.child.lastName}`.trim(),
  );

  return (
    <CancelRegistrationForm
      token={token}
      seasonName={submission.season.name}
      registrationCode={submission.registrationCode}
      childNames={childNames}
    />
  );
}

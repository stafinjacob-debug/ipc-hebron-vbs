import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySubmissionPublicToken } from "@/lib/registration-public-token";
import { resolveCheckoutResumeUrlForSubmission } from "@/lib/stripe-registration-payment";

export const dynamic = "force-dynamic";

export default async function RegisterPayPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>This payment link is missing or invalid.</p>
        <Link href="/register" className="mt-4 inline-block font-medium text-brand underline">
          Go to registration
        </Link>
      </div>
    );
  }

  const verified = verifySubmissionPublicToken(token, "pay");
  if (!verified) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>This payment link has expired or is not valid.</p>
        <p className="mt-2">
          Email{" "}
          <a href="mailto:vbs@ipchouston.com" className="font-medium text-brand underline">
            vbs@ipchouston.com
          </a>{" "}
          for help.
        </p>
      </div>
    );
  }

  const resume = await resolveCheckoutResumeUrlForSubmission(verified.submissionId);
  if ("error" in resume) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-600">
        <p>{resume.error}</p>
        <Link href="/register" className="mt-4 inline-block font-medium text-brand underline">
          Back to registration
        </Link>
      </div>
    );
  }

  redirect(resume.url);
}

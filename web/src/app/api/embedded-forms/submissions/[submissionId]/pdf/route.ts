import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { renderEmbeddedApplicationPdf, embeddedPdfFilename } from "@/lib/embedded-form-pdf";

export async function GET(
  _req: Request,
  context: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { submissionId } = await context.params;
  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return new NextResponse("Not found", { status: 404 });

  const responses = (submission.responsesJson ?? {}) as Record<string, unknown>;
  const registrar = (submission.registrarResponsesJson ?? null) as Record<string, unknown> | null;

  try {
    const pdf = await renderEmbeddedApplicationPdf({
      templateKey: submission.form.pdfTemplateKey || "htc-application",
      applicationNumber: submission.applicationNumber,
      responses,
      registrarResponses: registrar,
      photoObjectKey: submission.photoObjectKey,
      signatureTypedName: submission.signatureTypedName,
      applicantFullName: submission.applicantFullName,
    });
    const fname = embeddedPdfFilename(submission.applicantFullName, submission.applicationNumber);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[embedded pdf export]", e);
    return new NextResponse("Could not generate PDF.", { status: 500 });
  }
}

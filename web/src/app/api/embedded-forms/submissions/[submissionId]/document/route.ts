import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { loadEmbeddedDocumentBytes, parseAcademicDocumentKeys } from "@/lib/embedded-document-storage";

export async function GET(
  req: Request,
  context: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { submissionId } = await context.params;
  const index = Number(new URL(req.url).searchParams.get("i") ?? "0");
  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
    select: { academicDocumentKeys: true },
  });
  const keys = parseAcademicDocumentKeys(submission?.academicDocumentKeys);
  const key = keys[index];
  if (!key) return new NextResponse("Not found", { status: 404 });

  const loaded = await loadEmbeddedDocumentBytes(key);
  if (!loaded) return new NextResponse("File missing", { status: 404 });

  const lower = key.toLowerCase();
  const contentType = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

  return new NextResponse(new Uint8Array(loaded.bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="academic-document-${index + 1}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

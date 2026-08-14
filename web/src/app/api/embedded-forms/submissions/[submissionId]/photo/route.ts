import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { loadEmbeddedPhotoBytes } from "@/lib/embedded-photo-storage";

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
    select: { photoObjectKey: true, photoContentType: true },
  });
  if (!submission?.photoObjectKey) return new NextResponse("No photo", { status: 404 });

  const bytes = await loadEmbeddedPhotoBytes(submission.photoObjectKey);
  if (!bytes) return new NextResponse("Photo missing", { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": submission.photoContentType || "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}

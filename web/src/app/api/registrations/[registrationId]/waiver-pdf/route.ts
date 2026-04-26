import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";

function safeLocalWaiverPath(pdfUrl: string): string | null {
  const u = pdfUrl.trim();
  if (!u.startsWith("/uploads/waivers/")) return null;
  if (u.includes("..")) return null;
  const rel = u.replace(/^\//, "");
  const abs = path.resolve(path.join(process.cwd(), "public", rel));
  const root = path.resolve(path.join(process.cwd(), "public", "uploads", "waivers"));
  if (!abs.startsWith(root)) return null;
  return abs;
}

function attachmentFilename(first: string, last: string, registrationId: string): string {
  const raw = `${first}-${last}`.trim();
  let base = raw.replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (base.length < 2) base = `id-${registrationId.slice(0, 12)}`;
  return `waiver-${base}.pdf`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ registrationId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { registrationId } = await context.params;
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { select: { firstName: true, lastName: true } },
      waiverAgreement: { select: { pdfUrl: true } },
    },
  });

  if (!reg?.waiverAgreement?.pdfUrl?.trim()) {
    return new NextResponse("No signed waiver on file for this registration.", { status: 404 });
  }

  const pdfUrl = reg.waiverAgreement.pdfUrl.trim();
  const fname = attachmentFilename(reg.child.firstName, reg.child.lastName, reg.id);

  const localPath = safeLocalWaiverPath(pdfUrl);
  if (localPath) {
    try {
      const buf = await readFile(localPath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    } catch {
      return new NextResponse("Waiver file is missing from server storage.", { status: 404 });
    }
  }

  if (pdfUrl.startsWith("https://") || pdfUrl.startsWith("http://")) {
    try {
      const upstream = await fetch(pdfUrl);
      if (!upstream.ok) {
        return new NextResponse("Could not retrieve waiver from storage.", { status: 502 });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    } catch {
      return new NextResponse("Could not retrieve waiver from storage.", { status: 502 });
    }
  }

  return new NextResponse("Unsupported waiver storage URL.", { status: 500 });
}

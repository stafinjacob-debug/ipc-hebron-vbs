/**
 * Read-only: download signed waiver PDFs for active registrations in a season
 * into one flat folder. Does not modify data or send email.
 *
 * Env: DATABASE_URL, AZURE_STORAGE_CONNECTION_STRING (optional AZURE_STORAGE_CONTAINER),
 *      SEASON_NAME_CONTAINS (default "United"), OUT_DIR (default ./waivers-export)
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { BlobServiceClient } from "@azure/storage-blob";
import type { RegistrationStatus } from "../src/generated/prisma";
import { prisma } from "../src/lib/prisma";

const ACTIVE_STATUSES: RegistrationStatus[] = ["PENDING", "CONFIRMED", "WAITLIST"];

function safePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

async function downloadPdf(
  pdfUrl: string,
  container: ReturnType<BlobServiceClient["getContainerClient"]> | null,
): Promise<Buffer> {
  if (container && /\.blob\.core\.windows\.net\//i.test(pdfUrl)) {
    const u = new URL(pdfUrl);
    const [, , ...rest] = u.pathname.split("/");
    const blobName = decodeURIComponent(rest.join("/"));
    return container.getBlobClient(blobName).downloadToBuffer();
  }
  const url = pdfUrl.startsWith("/") ? `https://events.ipchouston.com${pdfUrl}` : pdfUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const nameContains = process.env.SEASON_NAME_CONTAINS?.trim() || "United";
  const outDir = path.resolve(process.env.OUT_DIR?.trim() || "waivers-export");
  const pdfDir = path.join(outDir, "pdfs");
  await mkdir(pdfDir, { recursive: true });

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const container = conn
    ? BlobServiceClient.fromConnectionString(conn).getContainerClient(
        process.env.AZURE_STORAGE_CONTAINER?.trim() || "vbs-uploads",
      )
    : null;

  const season = await prisma.vbsSeason.findFirst({
    where: { name: { contains: nameContains, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!season) throw new Error(`No season matching "${nameContains}"`);
  console.log("season", season.name, season.id);

  const regs = await prisma.registration.findMany({
    where: { seasonId: season.id, status: { in: ACTIVE_STATUSES } },
    select: {
      id: true,
      status: true,
      registrationNumber: true,
      child: {
        select: {
          firstName: true,
          lastName: true,
          guardian: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      waiverAgreement: { select: { pdfUrl: true, signerName: true, signedAt: true } },
    },
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });

  const usedNames = new Set<string>();
  const manifest: string[] = [
    "child,registrationNumber,status,guardian,guardianEmail,waiverFile,signedBy,signedAt,result",
  ];
  let saved = 0;
  let missing = 0;
  let failed = 0;

  for (const r of regs) {
    const child = `${r.child.firstName} ${r.child.lastName}`.trim();
    const guardian = `${r.child.guardian.firstName} ${r.child.guardian.lastName}`.trim();
    const w = r.waiverAgreement;
    let fileName = "";
    let result: string;

    if (!w?.pdfUrl?.trim()) {
      missing += 1;
      result = "no signed waiver on file";
    } else {
      let base = `${safePart(r.child.lastName)}-${safePart(r.child.firstName)}-waiver`;
      if (usedNames.has(base.toLowerCase())) {
        base = `${base}-${safePart(r.registrationNumber ?? r.id.slice(0, 8))}`;
      }
      usedNames.add(base.toLowerCase());
      fileName = `${base}.pdf`;
      try {
        const buf = await downloadPdf(w.pdfUrl.trim(), container);
        await writeFile(path.join(pdfDir, fileName), buf);
        saved += 1;
        result = "saved";
      } catch (e) {
        failed += 1;
        result = `download failed: ${e instanceof Error ? e.message : String(e)}`;
        fileName = "";
      }
    }

    manifest.push(
      [
        csvCell(child),
        csvCell(r.registrationNumber ?? ""),
        r.status,
        csvCell(guardian),
        csvCell(r.child.guardian.email ?? ""),
        csvCell(fileName),
        csvCell(w?.signerName ?? ""),
        w?.signedAt ? w.signedAt.toISOString() : "",
        csvCell(result),
      ].join(","),
    );
    if (result !== "saved") console.log("notSaved", child, "-", result);
  }

  await writeFile(path.join(outDir, "waiver-manifest.csv"), manifest.join("\n"));
  console.log("summary", { activeRegistrations: regs.length, saved, missing, failed });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

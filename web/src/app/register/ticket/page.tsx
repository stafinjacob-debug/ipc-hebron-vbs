import { prisma } from "@/lib/prisma";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { promises as fs } from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "VBS registration ticket",
  robots: { index: false, follow: false },
};

async function loadThemeLogoDataUrl(): Promise<string | null> {
  const candidates = [
    { filePath: path.join(process.cwd(), "vbsthemelogo.png"), mime: "image/png" },
    { filePath: path.join(process.cwd(), "vbsthemelogo.webp"), mime: "image/webp" },
  ] as const;
  for (const c of candidates) {
    try {
      const bytes = await fs.readFile(c.filePath);
      if (!bytes.length) continue;
      return `data:${c.mime};base64,${bytes.toString("base64")}`;
    } catch {
      // try next format
    }
  }
  return null;
}

export default async function PublicRegistrationTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";

  if (!token) {
    return (
      <div className="min-h-[70vh] bg-slate-100 px-4 py-16 text-center">
        <p className="text-slate-600">Missing ticket link. Use the link from your confirmation email.</p>
      </div>
    );
  }

  const reg = await prisma.registration.findFirst({
    where: { checkInToken: token },
    include: { child: true, season: true, classroom: true },
  });

  if (!reg) {
    return (
      <div className="min-h-[70vh] bg-slate-100 px-4 py-16 text-center">
        <p className="text-slate-600">This ticket link is invalid or has expired. Contact the church office.</p>
      </div>
    );
  }
  if (!reg.checkInToken || !reg.registrationNumber) {
    return (
      <div className="min-h-[70vh] bg-slate-100 px-4 py-16 text-center">
        <p className="text-slate-600">
          This registration is still pending approval. Use the confirmation email ticket link after approval.
        </p>
      </div>
    );
  }

  const base = getPublicAppBaseUrl();
  const url = registrationTicketUrl(reg.checkInToken, base);
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 240,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const range = `${reg.season.startDate.toLocaleDateString()} – ${reg.season.endDate.toLocaleDateString()}`;
  const themeLogoDataUrl = await loadThemeLogoDataUrl();

  return (
    <div className="min-h-full bg-gradient-to-b from-sky-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-5 text-center text-white">
            {themeLogoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={themeLogoDataUrl}
                alt="Illumination Station theme"
                className="mx-auto mb-3 h-auto w-full max-w-[22rem]"
              />
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">VBS ticket</p>
            <h1 className="mt-1 text-xl font-bold">{reg.season.name}</h1>
            <p className="mt-1 text-sm text-white/90">{range}</p>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="rounded-xl bg-sky-50/80 px-4 py-3 ring-1 ring-sky-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">Registration #</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wide text-slate-900">{reg.registrationNumber}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Participant</p>
              <p className="text-lg font-semibold text-slate-900">
                {reg.child.firstName} {reg.child.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Class</p>
              <p className="text-slate-800">{reg.classroom?.name ?? "To be assigned"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Status</p>
              <p className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-800">
                {reg.status === "CONFIRMED"
                  ? "Confirmed"
                  : reg.status === "PENDING"
                    ? "Pending review"
                    : reg.status === "WAITLIST"
                      ? "Waitlist"
                      : reg.status === "CANCELLED"
                        ? "Cancelled"
                        : reg.status}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} width={200} height={200} alt="Check-in QR code" className="rounded-lg" />
              <p className="mt-2 max-w-[240px] text-center text-xs text-slate-500">
                Show this code at check-in. Screenshot for offline use.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          IPC Hebron VBS · Digital ticket only — not a payment receipt.
        </p>
      </div>
    </div>
  );
}

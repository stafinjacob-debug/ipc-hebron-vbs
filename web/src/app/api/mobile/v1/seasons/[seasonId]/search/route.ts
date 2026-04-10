import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { canUseCheckInActions } from "@/lib/permissions";

type RouteParams = { params: Promise<{ seasonId: string }> };

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canUseCheckInActions(auth.role)) {
    return jsonError(403, "Search is not available for your role");
  }

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const qDigits = digitsOnly(q);
  const terms = q.split(/\s+/).filter(Boolean);

  const orFilters: Prisma.RegistrationWhereInput[] = [
    { child: { firstName: { contains: q, mode: "insensitive" as const } } },
    { child: { lastName: { contains: q, mode: "insensitive" as const } } },
    {
      registrationNumber: {
        contains: q,
        mode: "insensitive" as const,
      },
    },
    {
      formSubmission: {
        registrationCode: {
          contains: q,
          mode: "insensitive" as const,
        },
      },
    },
    {
      child: {
        guardian: {
          firstName: { contains: q, mode: "insensitive" as const },
        },
      },
    },
    {
      child: {
        guardian: {
          lastName: { contains: q, mode: "insensitive" as const },
        },
      },
    },
  ];

  if (qDigits.length >= 3) {
    orFilters.push({
      child: {
        guardian: {
          phone: { contains: qDigits },
        },
      },
    });
  }

  if (terms.length >= 2) {
    const [a, b] = terms;
    orFilters.push({
      AND: [
        {
          child: {
            firstName: { contains: a, mode: "insensitive" as const },
          },
        },
        {
          child: {
            lastName: { contains: b, mode: "insensitive" as const },
          },
        },
      ],
    });
  }

  const rows = await prisma.registration.findMany({
    where: {
      seasonId,
      status: { not: "CANCELLED" },
      OR: orFilters,
    },
    take: 40,
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
    include: {
      child: {
        include: {
          guardian: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
      classroom: { select: { id: true, name: true, room: true } },
      formSubmission: { select: { registrationCode: true } },
    },
  });

  const now = new Date();
  const results = rows.map((r) => {
    const dob = r.child.dateOfBirth;
    const age =
      (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const ageYears = Math.floor(age);
    const allergies = r.child.allergiesNotes?.trim();
    return {
      registrationId: r.id,
      studentName: `${r.child.firstName} ${r.child.lastName}`,
      ageYears,
      className: r.classroom?.name ?? null,
      room: r.classroom?.room ?? null,
      registrationCode:
        r.registrationNumber ??
        r.formSubmission?.registrationCode ??
        null,
      checkedIn: !!r.checkedInAt,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
      guardianName: `${r.child.guardian.firstName} ${r.child.guardian.lastName}`,
      guardianPhone: r.child.guardian.phone,
      hasMedicalAlert: Boolean(allergies),
      allergiesNotes: allergies || null,
    };
  });

  return NextResponse.json({ results });
}

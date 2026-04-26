import { Prisma } from "../src/generated/prisma";
import { prisma } from "../src/lib/prisma";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "../src/lib/registration-identity";

type BackfillRow = {
  id: string;
  seasonId: string;
  seasonYear: number;
  registrationNumber: string | null;
  checkInToken: string | null;
};

async function loadRowsNeedingBackfill(): Promise<BackfillRow[]> {
  const rows = await prisma.registration.findMany({
    where: {
      OR: [{ registrationNumber: null }, { checkInToken: null }],
    },
    select: {
      id: true,
      seasonId: true,
      registrationNumber: true,
      checkInToken: true,
      season: { select: { year: true } },
    },
    orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    seasonId: r.seasonId,
    seasonYear: r.season.year,
    registrationNumber: r.registrationNumber,
    checkInToken: r.checkInToken,
  }));
}

async function backfillOne(row: BackfillRow): Promise<"updated" | "skipped"> {
  for (let i = 0; i < 8; i++) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.registration.findUnique({
          where: { id: row.id },
          select: {
            id: true,
            seasonId: true,
            registrationNumber: true,
            checkInToken: true,
            season: { select: { year: true } },
          },
        });
        if (!current) return "skipped" as const;
        if (current.registrationNumber && current.checkInToken) return "skipped" as const;

        const registrationNumber =
          current.registrationNumber ??
          (await makeUniqueRegistrationNumber(
            { seasonId: current.seasonId, seasonYear: current.season.year },
            tx,
          ));
        const checkInToken = current.checkInToken ?? makeCheckInToken();

        await tx.registration.update({
          where: { id: current.id },
          data: { registrationNumber, checkInToken },
        });
        return "updated" as const;
      });
      return updated;
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        i < 7
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not backfill identity for registration ${row.id}`);
}

async function main() {
  const rows = await loadRowsNeedingBackfill();
  if (rows.length === 0) {
    console.log("No registrations need identity backfill.");
    return;
  }

  console.log(`Found ${rows.length} registration(s) missing number and/or check-in token.`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await backfillOne(row);
    if (result === "updated") updated++;
    else skipped++;
  }

  console.log(`Backfill complete. Updated: ${updated}. Skipped: ${skipped}.`);
}

main()
  .catch((err) => {
    console.error("[backfill-registration-identities] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

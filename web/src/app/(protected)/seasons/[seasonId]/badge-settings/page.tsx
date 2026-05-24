import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { canManageDirectory } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import { BadgePrintSettingsForm } from "./settings-form";

type PageProps = { params: Promise<{ seasonId: string }> };

export default async function BadgePrintSettingsPage({ params }: PageProps) {
  const { seasonId } = await params;
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/seasons");

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { badgePrintSettings: true },
  });
  if (!season) notFound();

  const settings = resolveBadgePrintSettings(season.badgePrintSettings);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-foreground/60">
          <Link href="/seasons" className="hover:underline">
            ← Seasons
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Badge printing</h1>
        <p className="mt-1 text-foreground/70">
          {season.name} ({season.year}) — thermal badge layout for the check-in desk. Open{" "}
          <Link href="/check-in" className="font-medium text-brand underline">
            Check-in desk
          </Link>{" "}
          on an iPad paired to your label printer to print badges.
        </p>
      </div>

      <BadgePrintSettingsForm seasonId={season.id} settings={settings} />
    </div>
  );
}

import { redirect } from "next/navigation";

type Props = { params: Promise<{ seasonId: string }> };

/** Legacy URL — class settings live under Classes now. */
export default async function SeasonClassSettingsRedirectPage({ params }: Props) {
  const { seasonId } = await params;
  redirect(`/classes/settings?season=${seasonId}`);
}

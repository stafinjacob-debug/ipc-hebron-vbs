import type { Metadata } from "next";
import {
  hasPublicRegistrantLookupOpen,
  listOpenPublicRegistrationSummaries,
} from "@/lib/open-public-registration-summaries";
import { LoginPageClient } from "./login-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event Registration | IPC Hebron",
  description: "Browse and register for open IPC Hebron programs and events.",
};

export default async function LoginPage() {
  let seasons: Awaited<ReturnType<typeof listOpenPublicRegistrationSummaries>> = [];
  let lookupOpen = false;
  let dbUnavailable = false;
  try {
    [seasons, lookupOpen] = await Promise.all([
      listOpenPublicRegistrationSummaries(),
      hasPublicRegistrantLookupOpen(),
    ]);
  } catch (err) {
    dbUnavailable = true;
    console.error("[LoginPage] database unavailable", err);
  }
  return (
    <LoginPageClient seasons={seasons} lookupOpen={lookupOpen} dbUnavailable={dbUnavailable} />
  );
}

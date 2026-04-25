import type { Metadata } from "next";
import { listOpenPublicRegistrationSummaries } from "@/lib/open-public-registration-summaries";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = {
  title: "Register for VBS | IPC Hebron",
  description: "Sign up your children for Vacation Bible School — open programs and staff access",
};

export default async function LoginPage() {
  const seasons = await listOpenPublicRegistrationSummaries();
  return <LoginPageClient seasons={seasons} />;
}

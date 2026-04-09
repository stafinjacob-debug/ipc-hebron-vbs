"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canUseCheckInActions } from "@/lib/permissions";

export async function toggleCheckInForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.role || !canUseCheckInActions(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const registrationId = formData.get("registrationId");
  const nextChecked = formData.get("nextChecked") === "1";
  if (typeof registrationId !== "string" || !registrationId) {
    throw new Error("Invalid registration");
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { checkedInAt: nextChecked ? new Date() : null },
  });

  revalidatePath("/check-in");
  revalidatePath("/dashboard");
}

"use server";

import { prisma } from "@/lib/prisma";
import {
  formatClassPlacementBlockMessage,
  resolveRegistrationHelpContact,
  shouldBlockRegistrationWithoutClassPlacement,
  type ClassPlacementChildInput,
} from "@/lib/class-placement-gate";
import { previewClassPlacementForChildren } from "@/lib/preview-class-placement";

export type ClassPlacementCheckState = {
  ok: boolean;
  blocked: boolean;
  message: string | null;
  unplacedLabels: string[];
};

/** Review-step preview: would each child receive a class under current rules? */
export async function checkClassPlacementAction(input: {
  seasonId: string;
  children: ClassPlacementChildInput[];
}): Promise<ClassPlacementCheckState> {
  try {
    const season = await prisma.vbsSeason.findUnique({
      where: { id: input.seasonId },
      include: { publicRegistrationSettings: true, registrationForm: true },
    });
    if (!season?.registrationForm) {
      return { ok: false, blocked: false, message: "Program not found.", unplacedLabels: [] };
    }

    const formRow = season.registrationForm;
    if (
      !shouldBlockRegistrationWithoutClassPlacement({
        classroomsEnabled: season.classroomsEnabled,
        waitlistEnabled: formRow.waitlistEnabled,
      })
    ) {
      return { ok: true, blocked: false, message: null, unplacedLabels: [] };
    }

    const rows = await previewClassPlacementForChildren(prisma, {
      seasonId: input.seasonId,
      children: input.children,
    });
    const unplaced = rows.filter((r) => !r.canPlace);
    if (unplaced.length === 0) {
      return { ok: true, blocked: false, message: null, unplacedLabels: [] };
    }

    const helpContact = resolveRegistrationHelpContact({
      helpContactEmail: season.publicRegistrationSettings?.helpContactEmail,
      contactPhone: season.publicRegistrationSettings?.helpContactPhone,
    });
    const message = formatClassPlacementBlockMessage({ unplaced, helpContact });
    return {
      ok: true,
      blocked: true,
      message,
      unplacedLabels: unplaced.map((r) => r.label),
    };
  } catch (e) {
    console.error("[checkClassPlacementAction]", e);
    return {
      ok: false,
      blocked: false,
      message: "Could not verify class availability. Please try again.",
      unplacedLabels: [],
    };
  }
}

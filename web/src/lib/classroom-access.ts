import type { UserRole } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { classroomWhereForTeacher } from "@/lib/classroom-enrollment";
import { canManageDirectory } from "@/lib/roles";

export async function canUserViewClassroom(
  userId: string,
  role: UserRole,
  classroomId: string,
): Promise<boolean> {
  if (canManageDirectory(role)) return true;
  if (role === "TEACHER") {
    const c = await prisma.classroom.findFirst({
      where: { id: classroomId, ...classroomWhereForTeacher(userId) },
      select: { id: true },
    });
    return Boolean(c);
  }
  return true;
}

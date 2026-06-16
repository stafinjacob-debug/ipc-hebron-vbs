import type { UserRole } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { classroomWhereForTeacher } from "@/lib/classroom-enrollment";
import { canManageDirectory } from "@/lib/roles";
import { loadStaffAccessScope } from "@/lib/staff-access-scope";

export async function canUserViewClassroom(
  userId: string,
  role: UserRole,
  classroomId: string,
): Promise<boolean> {
  const scope = await loadStaffAccessScope(userId);

  if (canManageDirectory(role)) {
    if (scope.isRestricted && scope.classroomIds.length > 0) {
      return scope.classroomIds.includes(classroomId);
    }
    return true;
  }
  if (role === "TEACHER") {
    const c = await prisma.classroom.findFirst({
      where: { id: classroomId, ...classroomWhereForTeacher(userId) },
      select: { id: true },
    });
    return Boolean(c);
  }
  if (scope.isRestricted && scope.classroomIds.length > 0) {
    return scope.classroomIds.includes(classroomId);
  }
  return true;
}

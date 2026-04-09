-- UserStatus enum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- Replace UserRole with expanded staff roles
CREATE TYPE "UserRole_new" AS ENUM (
  'SUPER_ADMIN',
  'CHURCH_ADMIN',
  'REGISTRATION_MANAGER',
  'CHECK_IN_VOLUNTEER',
  'TEACHER',
  'CONTENT_MANAGER',
  'REPORTS_VIEWER',
  'PARENT'
);

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'SUPER_ADMIN'::"UserRole_new"
    WHEN 'COORDINATOR' THEN 'CHURCH_ADMIN'::"UserRole_new"
    WHEN 'VOLUNTEER' THEN 'CHECK_IN_VOLUNTEER'::"UserRole_new"
    WHEN 'PARENT' THEN 'PARENT'::"UserRole_new"
    ELSE 'CHECK_IN_VOLUNTEER'::"UserRole_new"
  END
);

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CHECK_IN_VOLUNTEER'::"UserRole";

-- Nullable password (invite flow)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Account lifecycle
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_inviteTokenHash_key" ON "User"("inviteTokenHash");

ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserSeasonScope" (
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,

    CONSTRAINT "UserSeasonScope_pkey" PRIMARY KEY ("userId","seasonId")
);

ALTER TABLE "UserSeasonScope" ADD CONSTRAINT "UserSeasonScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSeasonScope" ADD CONSTRAINT "UserSeasonScope_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserClassroomScope" (
    "userId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,

    CONSTRAINT "UserClassroomScope_pkey" PRIMARY KEY ("userId","classroomId")
);

ALTER TABLE "UserClassroomScope" ADD CONSTRAINT "UserClassroomScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserClassroomScope" ADD CONSTRAINT "UserClassroomScope_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffAccessAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "StaffAccessAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffAccessAuditLog" ADD CONSTRAINT "StaffAccessAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffAccessAuditLog" ADD CONSTRAINT "StaffAccessAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StaffAccessAuditLog_createdAt_idx" ON "StaffAccessAuditLog"("createdAt");

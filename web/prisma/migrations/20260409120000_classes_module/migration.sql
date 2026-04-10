-- CreateEnum
CREATE TYPE "ClassroomAgeRule" AS ENUM ('REGISTRATION_DATE', 'EVENT_START_DATE');

-- CreateEnum
CREATE TYPE "ClassroomIntakeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClassLeaderRole" AS ENUM ('PRIMARY', 'ASSISTANT', 'HELPER');

-- CreateEnum
CREATE TYPE "ClassAssignmentMethod" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "internalCode" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "ageRule" "ClassroomAgeRule" NOT NULL DEFAULT 'EVENT_START_DATE',
ADD COLUMN     "gradeLabel" TEXT,
ADD COLUMN     "eligibilityNotes" TEXT,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "intakeStatus" "ClassroomIntakeStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "room" TEXT,
ADD COLUMN     "checkInLabel" TEXT,
ADD COLUMN     "badgeDisplayName" TEXT,
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Classroom_seasonId_sortOrder_idx" ON "Classroom"("seasonId", "sortOrder");

-- CreateTable
CREATE TABLE "ClassroomLeaderAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassLeaderRole" NOT NULL DEFAULT 'ASSISTANT',

    CONSTRAINT "ClassroomLeaderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignmentAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationId" TEXT NOT NULL,
    "fromClassroomId" TEXT,
    "toClassroomId" TEXT,
    "method" "ClassAssignmentMethod" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,

    CONSTRAINT "ClassAssignmentAuditLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "classAssignmentMethod" "ClassAssignmentMethod",
ADD COLUMN     "classOverrideReason" TEXT,
ADD COLUMN     "classMatchedAtAge" INTEGER;

-- CreateIndex
CREATE INDEX "ClassAssignmentAuditLog_registrationId_idx" ON "ClassAssignmentAuditLog"("registrationId");

-- CreateIndex
CREATE INDEX "ClassAssignmentAuditLog_createdAt_idx" ON "ClassAssignmentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Registration_classroomId_idx" ON "Registration"("classroomId");

-- AddForeignKey
ALTER TABLE "ClassroomLeaderAssignment" ADD CONSTRAINT "ClassroomLeaderAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomLeaderAssignment" ADD CONSTRAINT "ClassroomLeaderAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignmentAuditLog" ADD CONSTRAINT "ClassAssignmentAuditLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignmentAuditLog" ADD CONSTRAINT "ClassAssignmentAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomLeaderAssignment_classroomId_userId_key" ON "ClassroomLeaderAssignment"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "ClassroomLeaderAssignment_userId_idx" ON "ClassroomLeaderAssignment"("userId");

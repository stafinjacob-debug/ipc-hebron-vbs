ALTER TABLE "Classroom" ADD COLUMN "birthDateMin" TIMESTAMP(3),
ADD COLUMN "birthDateMax" TIMESTAMP(3),
ADD COLUMN "roundRobinGroupKey" TEXT;

CREATE INDEX "Classroom_seasonId_roundRobinGroupKey_idx" ON "Classroom"("seasonId", "roundRobinGroupKey");

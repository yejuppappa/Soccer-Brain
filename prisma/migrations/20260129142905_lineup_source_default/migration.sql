-- AlterTable
ALTER TABLE "FixtureLineup" ALTER COLUMN "source" SET DEFAULT 'api-football';

-- CreateTable
CREATE TABLE "FixturePredictedLineup" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "predicted" JSONB NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixturePredictedLineup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixturePredictedLineup_fixtureId_idx" ON "FixturePredictedLineup"("fixtureId");

-- CreateIndex
CREATE INDEX "FixturePredictedLineup_teamId_idx" ON "FixturePredictedLineup"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FixturePredictedLineup_fixtureId_teamId_key" ON "FixturePredictedLineup"("fixtureId", "teamId");

-- AddForeignKey
ALTER TABLE "FixturePredictedLineup" ADD CONSTRAINT "FixturePredictedLineup_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixturePredictedLineup" ADD CONSTRAINT "FixturePredictedLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

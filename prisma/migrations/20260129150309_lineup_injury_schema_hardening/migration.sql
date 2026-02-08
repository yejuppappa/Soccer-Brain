/*
  Warnings:

  - A unique constraint covering the columns `[source,externalKey]` on the table `FixtureInjury` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lineupId,playerId]` on the table `FixtureLineupPlayer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalKey` to the `FixtureInjury` table without a default value. This is not possible if the table is not empty.
  - Made the column `source` on table `FixtureLineup` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "FixtureInjury_fixtureId_teamId_apiPlayerId_playerName_key";

-- DropIndex
DROP INDEX "FixtureLineupPlayer_fixtureId_teamId_playerId_key";

-- AlterTable
ALTER TABLE "FixtureInjury" ADD COLUMN     "externalKey" TEXT NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'api-football';

-- AlterTable
ALTER TABLE "FixtureLineup" ALTER COLUMN "source" SET NOT NULL;

-- AlterTable
ALTER TABLE "FixturePredictedLineup" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modelVersion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FixtureInjury_source_externalKey_key" ON "FixtureInjury"("source", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureLineupPlayer_lineupId_playerId_key" ON "FixtureLineupPlayer"("lineupId", "playerId");

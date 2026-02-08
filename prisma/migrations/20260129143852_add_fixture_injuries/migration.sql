/*
  Warnings:

  - You are about to drop the column `type` on the `FixtureInjury` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fixtureId,teamId,apiPlayerId,playerName]` on the table `FixtureInjury` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `playerName` to the `FixtureInjury` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FixtureInjury" DROP CONSTRAINT "FixtureInjury_playerId_fkey";

-- DropIndex
DROP INDEX "FixtureInjury_fixtureId_teamId_playerId_key";

-- DropIndex
DROP INDEX "FixtureInjury_playerId_idx";

-- AlterTable
ALTER TABLE "FixtureInjury" DROP COLUMN "type",
ADD COLUMN     "apiPlayerId" INTEGER,
ADD COLUMN     "playerName" TEXT NOT NULL,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "playerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FixtureInjury_apiPlayerId_idx" ON "FixtureInjury"("apiPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureInjury_fixtureId_teamId_apiPlayerId_playerName_key" ON "FixtureInjury"("fixtureId", "teamId", "apiPlayerId", "playerName");

-- AddForeignKey
ALTER TABLE "FixtureInjury" ADD CONSTRAINT "FixtureInjury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

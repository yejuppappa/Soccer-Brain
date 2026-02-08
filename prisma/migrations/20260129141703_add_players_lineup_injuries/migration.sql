-- CreateTable
CREATE TABLE "Player" (
    "id" BIGSERIAL NOT NULL,
    "apiPlayerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "position" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureLineupPlayer" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "lineupId" BIGINT NOT NULL,
    "playerId" BIGINT NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "number" INTEGER,
    "pos" TEXT,
    "grid" TEXT,
    "raw" JSONB,

    CONSTRAINT "FixtureLineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureInjury" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "playerId" BIGINT NOT NULL,
    "type" TEXT,
    "reason" TEXT,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureInjury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiPlayerId_key" ON "Player"("apiPlayerId");

-- CreateIndex
CREATE INDEX "FixtureLineupPlayer_fixtureId_idx" ON "FixtureLineupPlayer"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureLineupPlayer_teamId_idx" ON "FixtureLineupPlayer"("teamId");

-- CreateIndex
CREATE INDEX "FixtureLineupPlayer_playerId_idx" ON "FixtureLineupPlayer"("playerId");

-- CreateIndex
CREATE INDEX "FixtureLineupPlayer_lineupId_idx" ON "FixtureLineupPlayer"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureLineupPlayer_fixtureId_teamId_playerId_key" ON "FixtureLineupPlayer"("fixtureId", "teamId", "playerId");

-- CreateIndex
CREATE INDEX "FixtureInjury_fixtureId_idx" ON "FixtureInjury"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureInjury_teamId_idx" ON "FixtureInjury"("teamId");

-- CreateIndex
CREATE INDEX "FixtureInjury_playerId_idx" ON "FixtureInjury"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureInjury_fixtureId_teamId_playerId_key" ON "FixtureInjury"("fixtureId", "teamId", "playerId");

-- AddForeignKey
ALTER TABLE "FixtureLineupPlayer" ADD CONSTRAINT "FixtureLineupPlayer_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureLineupPlayer" ADD CONSTRAINT "FixtureLineupPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureLineupPlayer" ADD CONSTRAINT "FixtureLineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "FixtureLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureLineupPlayer" ADD CONSTRAINT "FixtureLineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureInjury" ADD CONSTRAINT "FixtureInjury_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureInjury" ADD CONSTRAINT "FixtureInjury_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureInjury" ADD CONSTRAINT "FixtureInjury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

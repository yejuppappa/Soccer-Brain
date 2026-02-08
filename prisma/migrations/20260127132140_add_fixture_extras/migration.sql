-- CreateTable
CREATE TABLE "FixtureWeather" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "condition" TEXT,
    "tempC" DOUBLE PRECISION,
    "icon" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureWeather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureOdds" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "home" DECIMAL(65,30),
    "draw" DECIMAL(65,30),
    "away" DECIMAL(65,30),
    "domestic" JSONB,
    "overseas" JSONB,
    "bookmaker" TEXT,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureOdds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureLineup" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "formation" TEXT,
    "coachName" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "FixtureLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureTeamStatSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureTeamStatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixtureWeather_fixtureId_key" ON "FixtureWeather"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureWeather_fetchedAt_idx" ON "FixtureWeather"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureOdds_fixtureId_key" ON "FixtureOdds"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureOdds_fetchedAt_idx" ON "FixtureOdds"("fetchedAt");

-- CreateIndex
CREATE INDEX "FixtureLineup_fixtureId_idx" ON "FixtureLineup"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureLineup_teamId_idx" ON "FixtureLineup"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureLineup_fixtureId_teamId_isConfirmed_source_key" ON "FixtureLineup"("fixtureId", "teamId", "isConfirmed", "source");

-- CreateIndex
CREATE INDEX "FixtureTeamStatSnapshot_teamId_idx" ON "FixtureTeamStatSnapshot"("teamId");

-- CreateIndex
CREATE INDEX "FixtureTeamStatSnapshot_fixtureId_idx" ON "FixtureTeamStatSnapshot"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureTeamStatSnapshot_fixtureId_teamId_key" ON "FixtureTeamStatSnapshot"("fixtureId", "teamId");

-- AddForeignKey
ALTER TABLE "FixtureWeather" ADD CONSTRAINT "FixtureWeather_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureOdds" ADD CONSTRAINT "FixtureOdds_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureLineup" ADD CONSTRAINT "FixtureLineup_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureLineup" ADD CONSTRAINT "FixtureLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureTeamStatSnapshot" ADD CONSTRAINT "FixtureTeamStatSnapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureTeamStatSnapshot" ADD CONSTRAINT "FixtureTeamStatSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

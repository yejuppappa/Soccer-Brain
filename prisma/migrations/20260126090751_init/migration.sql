-- CreateTable
CREATE TABLE "League" (
    "id" BIGSERIAL NOT NULL,
    "apiLeagueId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "season" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" BIGSERIAL NOT NULL,
    "apiTeamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" BIGSERIAL NOT NULL,
    "apiFixtureId" INTEGER NOT NULL,
    "leagueId" BIGINT NOT NULL,
    "season" INTEGER NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "homeTeamId" BIGINT NOT NULL,
    "awayTeamId" BIGINT NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchStat" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "teamId" BIGINT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "lambdaHome" DECIMAL(65,30) NOT NULL,
    "lambdaAway" DECIMAL(65,30) NOT NULL,
    "pHome" DECIMAL(65,30) NOT NULL,
    "pDraw" DECIMAL(65,30) NOT NULL,
    "pAway" DECIMAL(65,30) NOT NULL,
    "pOver25" DECIMAL(65,30) NOT NULL,
    "pUnder25" DECIMAL(65,30) NOT NULL,
    "evidenceJson" JSONB,
    "reliabilityJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_apiLeagueId_key" ON "League"("apiLeagueId");

-- CreateIndex
CREATE INDEX "League_enabled_priority_idx" ON "League"("enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Team_apiTeamId_key" ON "Team"("apiTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_apiFixtureId_key" ON "Fixture"("apiFixtureId");

-- CreateIndex
CREATE INDEX "Fixture_leagueId_kickoffAt_idx" ON "Fixture"("leagueId", "kickoffAt");

-- CreateIndex
CREATE INDEX "Fixture_kickoffAt_idx" ON "Fixture"("kickoffAt");

-- CreateIndex
CREATE INDEX "TeamMatchStat_teamId_playedAt_idx" ON "TeamMatchStat"("teamId", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchStat_fixtureId_teamId_key" ON "TeamMatchStat"("fixtureId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_fixtureId_key" ON "Prediction"("fixtureId");

-- CreateIndex
CREATE INDEX "Prediction_modelVersion_createdAt_idx" ON "Prediction"("modelVersion", "createdAt");

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchStat" ADD CONSTRAINT "TeamMatchStat_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchStat" ADD CONSTRAINT "TeamMatchStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

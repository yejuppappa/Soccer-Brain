-- CreateTable
CREATE TABLE "FixtureFeatureSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "featureVersion" INTEGER NOT NULL DEFAULT 1,
    "nMatches" INTEGER NOT NULL DEFAULT 5,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "season" INTEGER NOT NULL,
    "leagueId" BIGINT NOT NULL,
    "homeTeamId" BIGINT NOT NULL,
    "awayTeamId" BIGINT NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "homeInjuryCount" INTEGER NOT NULL DEFAULT 0,
    "awayInjuryCount" INTEGER NOT NULL DEFAULT 0,
    "tempC" DOUBLE PRECISION,
    "precipitationMm" DOUBLE PRECISION,
    "windKph" DOUBLE PRECISION,
    "humidityPct" INTEGER,
    "pressureHpa" DOUBLE PRECISION,
    "cloudCoverPct" INTEGER,
    "isDay" BOOLEAN,
    "home_shotsTotal_avg" DOUBLE PRECISION,
    "home_shotsOnTarget_avg" DOUBLE PRECISION,
    "home_possessionPct_avg" DOUBLE PRECISION,
    "home_passesTotal_avg" DOUBLE PRECISION,
    "home_passAccuracyPct_avg" DOUBLE PRECISION,
    "home_fouls_avg" DOUBLE PRECISION,
    "home_corners_avg" DOUBLE PRECISION,
    "home_yellowCards_avg" DOUBLE PRECISION,
    "home_redCards_avg" DOUBLE PRECISION,
    "home_xg_avg" DOUBLE PRECISION,
    "away_shotsTotal_avg" DOUBLE PRECISION,
    "away_shotsOnTarget_avg" DOUBLE PRECISION,
    "away_possessionPct_avg" DOUBLE PRECISION,
    "away_passesTotal_avg" DOUBLE PRECISION,
    "away_passAccuracyPct_avg" DOUBLE PRECISION,
    "away_fouls_avg" DOUBLE PRECISION,
    "away_corners_avg" DOUBLE PRECISION,
    "away_yellowCards_avg" DOUBLE PRECISION,
    "away_redCards_avg" DOUBLE PRECISION,
    "away_xg_avg" DOUBLE PRECISION,
    "home_goalsFor_avg" DOUBLE PRECISION,
    "home_goalsAgainst_avg" DOUBLE PRECISION,
    "away_goalsFor_avg" DOUBLE PRECISION,
    "away_goalsAgainst_avg" DOUBLE PRECISION,

    CONSTRAINT "FixtureFeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixtureFeatureSnapshot_fixtureId_key" ON "FixtureFeatureSnapshot"("fixtureId");

-- CreateIndex
CREATE INDEX "FixtureFeatureSnapshot_leagueId_kickoffAt_idx" ON "FixtureFeatureSnapshot"("leagueId", "kickoffAt");

-- CreateIndex
CREATE INDEX "FixtureFeatureSnapshot_featureVersion_idx" ON "FixtureFeatureSnapshot"("featureVersion");

-- AddForeignKey
ALTER TABLE "FixtureFeatureSnapshot" ADD CONSTRAINT "FixtureFeatureSnapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

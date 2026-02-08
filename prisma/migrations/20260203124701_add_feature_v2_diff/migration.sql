-- AlterTable
ALTER TABLE "FixtureFeatureSnapshot" ADD COLUMN     "corners_diff" DOUBLE PRECISION,
ADD COLUMN     "fouls_diff" DOUBLE PRECISION,
ADD COLUMN     "goalsAgainst_diff" DOUBLE PRECISION,
ADD COLUMN     "goalsFor_diff" DOUBLE PRECISION,
ADD COLUMN     "injuryCount_diff" INTEGER,
ADD COLUMN     "passAccuracyPct_diff" DOUBLE PRECISION,
ADD COLUMN     "passesTotal_diff" DOUBLE PRECISION,
ADD COLUMN     "possessionPct_diff" DOUBLE PRECISION,
ADD COLUMN     "redCards_diff" DOUBLE PRECISION,
ADD COLUMN     "shotsOnTarget_diff" DOUBLE PRECISION,
ADD COLUMN     "shotsTotal_diff" DOUBLE PRECISION,
ADD COLUMN     "xg_diff" DOUBLE PRECISION,
ADD COLUMN     "yellowCards_diff" DOUBLE PRECISION;

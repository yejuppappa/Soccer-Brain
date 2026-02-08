-- AlterTable
ALTER TABLE "FixtureWeather" ADD COLUMN     "cloudCoverPct" INTEGER,
ADD COLUMN     "humidityPct" INTEGER,
ADD COLUMN     "isDay" BOOLEAN,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lon" DOUBLE PRECISION,
ADD COLUMN     "observedAt" TIMESTAMP(3),
ADD COLUMN     "precipitationMm" DOUBLE PRECISION,
ADD COLUMN     "pressureHpa" DOUBLE PRECISION,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "weatherCode" INTEGER,
ADD COLUMN     "windDirDeg" INTEGER,
ADD COLUMN     "windGustKph" DOUBLE PRECISION,
ADD COLUMN     "windKph" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "FixtureWeather_observedAt_idx" ON "FixtureWeather"("observedAt");

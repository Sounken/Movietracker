-- CreateTable
CREATE TABLE "Series" (
    "tmdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "genres" TEXT[],
    "voteAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "numberOfSeasons" INTEGER NOT NULL DEFAULT 0,
    "numberOfEpisodes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("tmdbId")
);

-- CreateTable
CREATE TABLE "UserSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "review" TEXT,
    "watchlist" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEpisode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "runtime" INTEGER,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSeries_userId_updatedAt_idx" ON "UserSeries"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserSeries_userId_rating_idx" ON "UserSeries"("userId", "rating");

-- CreateIndex
CREATE INDEX "UserSeries_userId_watchlist_idx" ON "UserSeries"("userId", "watchlist");

-- CreateIndex
CREATE INDEX "UserSeries_tmdbId_idx" ON "UserSeries"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSeries_userId_tmdbId_key" ON "UserSeries"("userId", "tmdbId");

-- CreateIndex
CREATE INDEX "UserEpisode_userId_seriesId_idx" ON "UserEpisode"("userId", "seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEpisode_userId_seriesId_seasonNumber_episodeNumber_key" ON "UserEpisode"("userId", "seriesId", "seasonNumber", "episodeNumber");

-- AddForeignKey
ALTER TABLE "UserSeries" ADD CONSTRAINT "UserSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEpisode" ADD CONSTRAINT "UserEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

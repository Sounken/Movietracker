-- CreateTable
CREATE TABLE "PuzzleEntry" (
    "id" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "genres" TEXT[],
    "countries" TEXT[],
    "actors" TEXT[],
    "authors" TEXT[],
    "runtime" INTEGER,
    "seasons" INTEGER,
    "network" TEXT,
    "collection" TEXT,
    "voteAverage" DOUBLE PRECISION NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuzzleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPuzzle" (
    "id" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzlePlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "guesses" INTEGER[],
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuzzlePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PuzzleEntry_media_idx" ON "PuzzleEntry"("media");

-- CreateIndex
CREATE INDEX "PuzzleEntry_media_title_idx" ON "PuzzleEntry"("media", "title");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleEntry_media_tmdbId_key" ON "PuzzleEntry"("media", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPuzzle_media_day_key" ON "DailyPuzzle"("media", "day");

-- CreateIndex
CREATE INDEX "PuzzlePlay_userId_media_day_idx" ON "PuzzlePlay"("userId", "media", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzlePlay_userId_media_day_key" ON "PuzzlePlay"("userId", "media", "day");

-- AddForeignKey
ALTER TABLE "PuzzlePlay" ADD CONSTRAINT "PuzzlePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

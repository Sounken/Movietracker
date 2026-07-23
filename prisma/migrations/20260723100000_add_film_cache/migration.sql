-- CreateTable
CREATE TABLE "Film" (
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "genres" TEXT[],
    "voteAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runtime" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Film_pkey" PRIMARY KEY ("tmdbId")
);

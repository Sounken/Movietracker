-- CreateTable
CREATE TABLE "FilmProviderSnapshot" (
    "tmdbId" INTEGER NOT NULL,
    "providers" INTEGER[],
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilmProviderSnapshot_pkey" PRIMARY KEY ("tmdbId")
);


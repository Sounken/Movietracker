-- CreateTable
CREATE TABLE "FilmWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilmWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FilmWatch_userId_watchedAt_idx" ON "FilmWatch"("userId", "watchedAt");

-- CreateIndex
CREATE INDEX "FilmWatch_userId_tmdbId_idx" ON "FilmWatch"("userId", "tmdbId");

-- AddForeignKey
ALTER TABLE "FilmWatch" ADD CONSTRAINT "FilmWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise : chaque film déjà marqué vu avec une date (ajout manuel, import
-- Letterboxd) devient la première ligne de son journal. Les films vus sans
-- date restent hors journal, faute de savoir quand les placer.
INSERT INTO "FilmWatch" ("id", "userId", "tmdbId", "watchedAt", "createdAt")
SELECT gen_random_uuid()::text, "userId", "tmdbId", date_trunc('day', "watchedAt"), "createdAt"
FROM "UserFilm"
WHERE "watched" = true AND "watchedAt" IS NOT NULL;
